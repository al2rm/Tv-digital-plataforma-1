import { pool } from "../database/db.js";
import { scheduleSubscriptionReminders } from "../services/automation.service.js";
import {
  dispatchOutboundMessage,
  queueOutboundMessage
} from "../services/whatsappMessage.service.js";
import { env } from "../config/env.js";

const BUSINESS_DATE_SQL = "(NOW() AT TIME ZONE 'America/Asuncion')::date";
const VALID_SUBSCRIPTION_STATES = new Set(["pendiente", "activa", "vencida", "cancelada"]);
const VALID_PAYMENT_STATES = new Set(["pendiente", "confirmado", "rechazado", "reembolsado"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (value) => {
  if (!ISO_DATE.test(String(value || ""))) return false;
  const [year, month, day] = String(value).split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};
const validId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;

export const listPayments = async (req,res,next) => {
  try {
    const result = await pool.query(
      `SELECT p.*,u.nombre AS usuario_nombre,u.email AS usuario_email
       FROM payments p JOIN users u ON u.id=p.user_id
       ORDER BY p.fecha_pago DESC LIMIT 500`
    );
    res.json({ ok:true, data:result.rows });
  } catch(error){ next(error); }
};

export const listSubscriptions = async (req,res,next) => {
  try {
    const result = await pool.query(
      `SELECT s.*,u.nombre AS usuario_nombre,u.email AS usuario_email,
       pl.nombre AS plan_nombre,pl.precio
       FROM subscriptions s
       JOIN users u ON u.id=s.user_id
       JOIN plans pl ON pl.id=s.plan_id
       ORDER BY s.fecha_fin DESC LIMIT 500`
    );
    res.json({ ok:true, data:result.rows });
  } catch(error){ next(error); }
};

export const listPlans = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, slug, meses, precio, moneda, activo
       FROM plans
       ORDER BY meses`
    );
    return res.json({ ok: true, data: result.rows });
  } catch (error) {
    return next(error);
  }
};

export const createSubscription = async (req, res, next) => {
  try {
    const userId = Number(req.body.userId);
    const planId = Number(req.body.planId);
    const startDate = req.body.fechaInicio || null;
    if (!validId(userId) || !validId(planId)) {
      return res.status(400).json({
        ok: false,
        message: "Usuario y plan son obligatorios"
      });
    }
    if (startDate !== null && !validDate(startDate)) {
      return res.status(400).json({ ok: false, message: "Fecha de inicio inválida" });
    }

    const result = await pool.query(
      `INSERT INTO subscriptions(
         user_id, plan_id, estado, fecha_inicio, fecha_fin
       )
       SELECT $1, p.id, 'activa', start_date.value,
              (start_date.value + make_interval(months => p.meses))::DATE
       FROM plans p
       CROSS JOIN (SELECT COALESCE($3::DATE, ${BUSINESS_DATE_SQL}) AS value) start_date
       JOIN users u ON u.id = $1 AND u.rol = 'cliente'
       WHERE p.id = $2 AND p.activo = TRUE
       RETURNING *`,
      [userId, planId, startDate]
    );
    if (!result.rowCount) {
      return res.status(404).json({ ok: false, message: "Plan no encontrado" });
    }

    const jobs = await scheduleSubscriptionReminders(result.rows[0].id);
    return res.status(201).json({
      ok: true,
      data: { subscription: result.rows[0], reminders: jobs }
    });
  } catch (error) {
    return next(error);
  }
};

export const updateSubscription = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const userId = Number(req.body.userId);
    const planId = Number(req.body.planId);
    const state = String(req.body.estado || "");
    const startDate = String(req.body.fechaInicio || "");
    const endDate = String(req.body.fechaFin || "");
    if (!validId(id) || !validId(userId) || !validId(planId)) {
      return res.status(400).json({ ok: false, message: "Suscripción, cliente o plan inválido" });
    }
    if (!VALID_SUBSCRIPTION_STATES.has(state) || !validDate(startDate) || !validDate(endDate)) {
      return res.status(400).json({ ok: false, message: "Estado o fechas inválidas" });
    }
    if (endDate < startDate) {
      return res.status(400).json({ ok: false, message: "El vencimiento no puede ser anterior al inicio" });
    }
    const result = await pool.query(
      `UPDATE subscriptions s SET
         user_id=$2, plan_id=$3, estado=$4, fecha_inicio=$5::DATE,
         fecha_fin=$6::DATE, auto_renew=$7, fecha_actualizacion=NOW()
       FROM users u, plans p
       WHERE s.id=$1 AND u.id=$2 AND u.rol='cliente' AND p.id=$3
       RETURNING s.*`,
      [id, userId, planId, state, startDate, endDate, Boolean(req.body.autoRenew)]
    );
    if (!result.rowCount) {
      return res.status(404).json({ ok: false, message: "Suscripción, cliente o plan no encontrado" });
    }
    const reminders = await scheduleSubscriptionReminders(id);
    return res.json({ ok: true, data: { subscription: result.rows[0], reminders } });
  } catch (error) {
    return next(error);
  }
};

export const deleteSubscription = async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      "DELETE FROM subscriptions WHERE id=$1 RETURNING id,user_id,plan_id",
      [req.params.id]
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, message: "Suscripción no encontrada" });
    }
    await client.query(
      `UPDATE automation_jobs SET estado='cancelado', fecha_actualizacion=NOW()
       WHERE tipo='subscription_reminder' AND payload->>'subscriptionId'=$1
         AND estado IN ('pendiente','fallido')`,
      [String(req.params.id)]
    );
    await client.query("COMMIT");
    return res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    return next(error);
  } finally {
    client?.release();
  }
};

export const renewSubscription = async (req, res, next) => {
  let client;
  try {
    const amount = Number(req.body.monto || 0);
    if (!Number.isFinite(amount) || amount < 0 || amount > 999999999999) {
      return res.status(400).json({ok:false,message:"Monto inválido"});
    }
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE subscriptions s SET
         estado = 'activa',
         fecha_inicio = GREATEST(s.fecha_fin, ${BUSINESS_DATE_SQL}),
         fecha_fin = (
           GREATEST(s.fecha_fin, ${BUSINESS_DATE_SQL}) +
           make_interval(months => p.meses)
         )::DATE,
         fecha_actualizacion = NOW()
       FROM plans p, users u
       WHERE s.id = $1 AND p.id = s.plan_id AND u.id = s.user_id
       RETURNING s.*, p.nombre AS plan_nombre, u.nombre AS usuario_nombre,
                 TO_CHAR(s.fecha_fin, 'DD/MM/YYYY') AS vencimiento_formateado`,
      [req.params.id]
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ok:false,message:"Suscripción no encontrada"});
    }
    const subscription = result.rows[0];

    if (amount > 0) {
      await client.query(
        `INSERT INTO payments(
           user_id, subscription_id, monto, moneda, metodo,
           estado, referencia, nota
         )
         VALUES($1, $2, $3, $4, $5, 'confirmado', $6, $7)`,
        [
          subscription.user_id,
          subscription.id,
          Number(req.body.monto),
          req.body.moneda || "PYG",
          req.body.metodo || "manual",
          req.body.referencia || null,
          req.body.nota || "Renovación"
        ]
      );
    }

    await client.query("COMMIT");
    client.release();
    client = null;
    let reminders = [];
    try { reminders = await scheduleSubscriptionReminders(subscription.id); }
    catch { /* La renovación ya está confirmada; un aviso fallido no debe duplicarla. */ }
    let confirmation = null;
    try {
      const queued = await queueOutboundMessage({
        userId: subscription.user_id,
        templateKey: "renovacion_confirmada",
        parameters: {
          nombre: subscription.usuario_nombre,
          plan: subscription.plan_nombre,
          vencimiento: subscription.vencimiento_formateado
        },
        metadata: {
          automatic: true,
          reason: "subscription_renewed",
          subscriptionId: subscription.id
        }
      });
      confirmation = env.whatsapp.mode === "cloud"
        ? await dispatchOutboundMessage(queued.id)
        : { message: queued };
    } catch (error) {
      confirmation = { skipped: true, reason: error.message };
    }

    return res.json({
      ok: true,
      data: { subscription, reminders, confirmation }
    });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    return next(error);
  } finally { client?.release(); }
};

export const createPayment = async (req,res,next) => {
 try {
  const amount=Number(req.body.monto), userId=Number(req.body.userId);
  if(!Number.isSafeInteger(userId)||userId<=0||!Number.isFinite(amount)||amount<=0||amount>999999999999) return res.status(400).json({ok:false,message:"Cliente y monto válido son obligatorios"});
  const result=await pool.query(`INSERT INTO payments(user_id,monto,moneda,metodo,referencia,nota)
   SELECT id,$2,'PYG',$3,$4,$5 FROM users WHERE id=$1 RETURNING *`,
   [userId,amount,String(req.body.metodo||'manual').slice(0,40),String(req.body.referencia||'').slice(0,160),String(req.body.nota||'').slice(0,2000)]);
  if(!result.rowCount)return res.status(404).json({ok:false,message:"Cliente no encontrado"});
  res.status(201).json({ok:true,data:result.rows[0]});
 }catch(e){next(e);}
};

export const updatePayment = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const userId = Number(req.body.userId);
    const amount = Number(req.body.monto);
    const state = String(req.body.estado || "");
    const paidAt = String(req.body.fechaPago || "");
    if (!validId(id) || !validId(userId) || !Number.isFinite(amount) || amount <= 0 || amount > 999999999999) {
      return res.status(400).json({ ok: false, message: "Cliente o monto inválido" });
    }
    if (!VALID_PAYMENT_STATES.has(state) || (paidAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(paidAt))) {
      return res.status(400).json({ ok: false, message: "Estado o fecha de pago inválida" });
    }
    const result = await pool.query(
      `UPDATE payments p SET user_id=$2, monto=$3, metodo=$4, estado=$5,
         referencia=$6, nota=$7,
         fecha_pago=COALESCE($8::TIMESTAMP AT TIME ZONE 'America/Asuncion',fecha_pago)
       FROM users u WHERE p.id=$1 AND u.id=$2
       RETURNING p.*`,
      [
        id, userId, amount, String(req.body.metodo || "manual").slice(0, 40), state,
        String(req.body.referencia || "").slice(0, 160) || null,
        String(req.body.nota || "").slice(0, 2000) || null,
        paidAt || null
      ]
    );
    if (!result.rowCount) return res.status(404).json({ ok: false, message: "Pago o cliente no encontrado" });
    return res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
};

export const deletePayment = async (req, res, next) => {
  try {
    const result = await pool.query(
      "DELETE FROM payments WHERE id=$1 RETURNING id,user_id,monto",
      [req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ ok: false, message: "Pago no encontrado" });
    return res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
};

export const createPlan = async (req, res, next) => {
  try {
    const name = String(req.body.nombre || "").trim().slice(0, 100);
    const slug = String(req.body.slug || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
    const months = Number(req.body.meses);
    const price = Number(req.body.precio);
    if (!name || !slug || !Number.isSafeInteger(months) || months <= 0 || months > 120 || !Number.isFinite(price) || price < 0) {
      return res.status(400).json({ ok: false, message: "Nombre, identificador, meses y precio válidos son obligatorios" });
    }
    const result = await pool.query(
      `INSERT INTO plans(nombre,slug,meses,precio,moneda,activo)
       VALUES($1,$2,$3,$4,'PYG',$5) RETURNING *`,
      [name, slug, months, price, req.body.activo !== false]
    );
    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ ok: false, message: "Ya existe un plan con ese identificador" });
    return next(error);
  }
};

export const updatePlan = async(req,res,next)=>{
 try {
  const current=(await pool.query('SELECT * FROM plans WHERE id=$1',[req.params.id])).rows[0];
  if(!current)return res.status(404).json({ok:false,message:"Plan no encontrado"});
  const price=Number(req.body.precio??current.precio), months=Number(req.body.meses??current.meses);
  const name=String(req.body.nombre??current.nombre).trim().slice(0,100);
  if(!name||!Number.isSafeInteger(months)||months<=0||months>120||!Number.isFinite(price)||price<0||price>999999999999)return res.status(400).json({ok:false,message:"Datos del plan inválidos"});
  const result=await pool.query('UPDATE plans SET nombre=$1,meses=$2,precio=$3,activo=$4,fecha_actualizacion=NOW() WHERE id=$5 RETURNING *',[name,months,price,req.body.activo??current.activo,req.params.id]);
  if(!result.rowCount)return res.status(404).json({ok:false,message:"Plan no encontrado"});
  res.json({ok:true,data:result.rows[0]});
 }catch(e){next(e);}
};

export const deletePlan = async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM plans WHERE id=$1 RETURNING id,nombre", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ ok: false, message: "Plan no encontrado" });
    return res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(409).json({ ok: false, message: "Este plan tiene suscripciones. Desactívalo en lugar de eliminarlo." });
    }
    return next(error);
  }
};
