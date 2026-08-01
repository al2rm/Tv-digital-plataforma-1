import { env } from "../config/env.js";
import { pool } from "../database/db.js";
import { isValidPhone, normalizePhone } from "../utils/phone.js";

const VALID_STAGES = new Set([
  "nuevo",
  "contactado",
  "interesado",
  "esperando_pago",
  "activo",
  "perdido"
]);

const recordEvent = (leadId, type, description, userId, metadata = {}) =>
  pool.query(
    `INSERT INTO lead_events(lead_id, tipo, descripcion, creado_por, metadata)
     VALUES($1, $2, $3, $4, $5)`,
    [leadId, type, description, userId || null, metadata]
  );

export const listLeads = async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const stage = String(req.query.stage || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
    const values = [];
    const conditions = [];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(
        `(l.nombre ILIKE $${values.length} OR l.telefono ILIKE $${values.length})`
      );
    }
    if (stage) {
      if (!VALID_STAGES.has(stage)) {
        return res.status(400).json({ ok: false, message: "Etapa inválida" });
      }
      values.push(stage);
      conditions.push(`l.etapa = $${values.length}`);
    }
    values.push(limit);

    const result = await pool.query(
      `SELECT l.*,
              COUNT(m.id) FILTER (WHERE m.direccion = 'saliente')::INT AS mensajes_salientes,
              COUNT(m.id) FILTER (WHERE m.direccion = 'entrante')::INT AS mensajes_entrantes
       FROM leads l
       LEFT JOIN whatsapp_messages m ON m.lead_id = l.id
       ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
       GROUP BY l.id
       ORDER BY COALESCE(l.ultima_interaccion, l.fecha_creacion) DESC
       LIMIT $${values.length}`,
      values
    );
    return res.json({ ok: true, data: result.rows });
  } catch (error) {
    return next(error);
  }
};

export const getLead = async (req, res, next) => {
  try {
    const [leadResult, eventsResult] = await Promise.all([
      pool.query("SELECT * FROM leads WHERE id = $1", [req.params.id]),
      pool.query(
        `SELECT e.*, u.nombre AS creado_por_nombre
         FROM lead_events e
         LEFT JOIN users u ON u.id = e.creado_por
         WHERE e.lead_id = $1
         ORDER BY e.fecha_creacion DESC
         LIMIT 100`,
        [req.params.id]
      )
    ]);
    if (!leadResult.rowCount) {
      return res.status(404).json({ ok: false, message: "Lead no encontrado" });
    }
    return res.json({
      ok: true,
      data: { ...leadResult.rows[0], eventos: eventsResult.rows }
    });
  } catch (error) {
    return next(error);
  }
};

export const createLead = async (req, res, next) => {
  try {
    const nombre = String(req.body.nombre || "").trim();
    const telefono = String(req.body.telefono || "").trim();
    const normalized = normalizePhone(
      telefono,
      env.whatsapp.defaultCountryCode
    );
    if (!nombre || !isValidPhone(normalized)) {
      return res.status(400).json({
        ok: false,
        message: "Nombre y número de WhatsApp válido son obligatorios"
      });
    }

    const stage = req.body.etapa || "nuevo";
    if (!VALID_STAGES.has(stage)) {
      return res.status(400).json({ ok: false, message: "Etapa inválida" });
    }

    const result = await pool.query(
      `INSERT INTO leads(
         nombre, telefono, telefono_normalizado, etapa, origen,
         plan_interes, campaign_id, adset_id, ad_id, utm_source,
         utm_campaign, consentimiento_whatsapp, notas, asignado_a,
         ultima_interaccion
       )
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
       RETURNING *`,
      [
        nombre,
        telefono,
        normalized,
        stage,
        req.body.origen || "manual",
        req.body.planInteres || null,
        req.body.campaignId || null,
        req.body.adsetId || null,
        req.body.adId || null,
        req.body.utmSource || null,
        req.body.utmCampaign || null,
        Boolean(req.body.consentimientoWhatsapp),
        req.body.notas || null,
        req.auth.userId
      ]
    );
    await recordEvent(
      result.rows[0].id,
      "lead_creado",
      "Lead creado en el panel",
      req.auth.userId,
      { origen: req.body.origen || "manual" }
    );
    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        ok: false,
        message: "Ya existe un lead con ese número de WhatsApp"
      });
    }
    return next(error);
  }
};

export const updateLead = async (req, res, next) => {
  try {
    const currentResult = await pool.query(
      "SELECT * FROM leads WHERE id = $1",
      [req.params.id]
    );
    const current = currentResult.rows[0];
    if (!current) {
      return res.status(404).json({ ok: false, message: "Lead no encontrado" });
    }

    const stage = req.body.etapa ?? current.etapa;
    if (!VALID_STAGES.has(stage)) {
      return res.status(400).json({ ok: false, message: "Etapa inválida" });
    }

    const rawPhone = req.body.telefono ?? current.telefono;
    const normalized = normalizePhone(
      rawPhone,
      env.whatsapp.defaultCountryCode
    );
    if (!isValidPhone(normalized)) {
      return res.status(400).json({ ok: false, message: "WhatsApp inválido" });
    }

    const result = await pool.query(
      `UPDATE leads SET
         nombre = $1,
         telefono = $2,
         telefono_normalizado = $3,
         etapa = $4,
         origen = $5,
         plan_interes = $6,
         consentimiento_whatsapp = $7,
         notas = $8,
         fecha_actualizacion = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        String(req.body.nombre ?? current.nombre).trim(),
        rawPhone,
        normalized,
        stage,
        req.body.origen ?? current.origen,
        req.body.planInteres ?? current.plan_interes,
        req.body.consentimientoWhatsapp ??
          current.consentimiento_whatsapp,
        req.body.notas ?? current.notas,
        req.params.id
      ]
    );

    if (stage !== current.etapa) {
      await recordEvent(
        current.id,
        "etapa_cambiada",
        `${current.etapa} → ${stage}`,
        req.auth.userId,
        { anterior: current.etapa, nueva: stage }
      );
    } else {
      await recordEvent(
        current.id,
        "lead_actualizado",
        "Datos del lead actualizados",
        req.auth.userId
      );
    }
    return res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        ok: false,
        message: "Ese número ya pertenece a otro lead"
      });
    }
    return next(error);
  }
};

export const crmDashboard = async (req, res, next) => {
  try {
    const [stages, pendingMessages, expiring, revenue, sources] =
      await Promise.all([
        pool.query(
          `SELECT etapa, COUNT(*)::INT AS total
           FROM leads GROUP BY etapa`
        ),
        pool.query(
          `SELECT COUNT(*)::INT AS total
           FROM whatsapp_messages
           WHERE direccion = 'saliente'
             AND estado IN ('preparado', 'programado', 'fallido')`
        ),
        pool.query(
          `SELECT COUNT(*)::INT AS total
           FROM subscriptions
           WHERE estado = 'activa'
             AND fecha_fin BETWEEN CURRENT_DATE AND CURRENT_DATE + 5`
        ),
        pool.query(
          `SELECT COALESCE(SUM(monto), 0) AS total
           FROM payments
           WHERE estado = 'confirmado'
             AND fecha_pago >= date_trunc('month', NOW())`
        ),
        pool.query(
          `SELECT origen, COUNT(*)::INT AS total
           FROM leads GROUP BY origen ORDER BY total DESC LIMIT 10`
        )
      ]);

    const byStage = Object.fromEntries(
      stages.rows.map((row) => [row.etapa, row.total])
    );
    return res.json({
      ok: true,
      data: {
        leads: {
          total: Object.values(byStage).reduce((sum, value) => sum + value, 0),
          porEtapa: byStage
        },
        mensajesPendientes: pendingMessages.rows[0].total,
        suscripcionesPorVencer: expiring.rows[0].total,
        ingresosMes: Number(revenue.rows[0].total),
        origenes: sources.rows
      }
    });
  } catch (error) {
    return next(error);
  }
};
