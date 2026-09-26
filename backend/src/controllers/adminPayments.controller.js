import { pool } from "../database/db.js";
import { scheduleSubscriptionReminders } from "../services/automation.service.js";
import {
  dispatchOutboundMessage,
  queueOutboundMessage
} from "../services/whatsappMessage.service.js";
import { env } from "../config/env.js";

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
    const startDate = req.body.fechaInicio || new Date().toISOString().slice(0, 10);
    if (!userId || !planId) {
      return res.status(400).json({
        ok: false,
        message: "Usuario y plan son obligatorios"
      });
    }

    const result = await pool.query(
      `INSERT INTO subscriptions(
         user_id, plan_id, estado, fecha_inicio, fecha_fin
       )
       SELECT $1, p.id, 'activa', $3::DATE,
              ($3::DATE + make_interval(months => p.meses))::DATE
       FROM plans p
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
         fecha_inicio = GREATEST(s.fecha_fin, CURRENT_DATE),
         fecha_fin = (
           GREATEST(s.fecha_fin, CURRENT_DATE) +
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
export const updatePlan = async(req,res,next)=>{
 try {
  const price=Number(req.body.precio);
  if(!Number.isFinite(price)||price<0||price>999999999999)return res.status(400).json({ok:false,message:"Precio inválido"});
  const result=await pool.query('UPDATE plans SET precio=$1,fecha_actualizacion=NOW() WHERE id=$2 RETURNING *',[price,req.params.id]);
  if(!result.rowCount)return res.status(404).json({ok:false,message:"Plan no encontrado"});
  res.json({ok:true,data:result.rows[0]});
 }catch(e){next(e);}
};
