import { env } from "../config/env.js";
import { pool } from "../database/db.js";
import {
  dispatchOutboundMessage,
  markAssistedMessageSent,
  queueOutboundMessage
} from "../services/whatsappMessage.service.js";
import {
  getWhatsAppConfiguration,
  verifyWebhookSignature
} from "../services/whatsappTransport.service.js";
import { normalizePhone } from "../utils/phone.js";

const META_STATUS = {
  sent: "enviado",
  delivered: "entregado",
  read: "leido",
  failed: "fallido"
};

const optOutWords = new Set(["STOP", "BAJA", "SALIR", "CANCELAR"]);
const optInWords = new Set(["ALTA", "ACEPTO", "ACTIVAR MENSAJES"]);

const messageText = (message) =>
  message.text?.body ||
  message.button?.text ||
  message.interactive?.button_reply?.title ||
  message.interactive?.list_reply?.title ||
  `[${message.type || "mensaje"}]`;

const upsertInboundLead = async ({
  phone,
  name,
  referral,
  optedOut,
  optedIn
}) => {
  const metadata = referral ? { referral } : {};
  const origin = referral ? "meta_ads" : "whatsapp";
  const result = await pool.query(
    `INSERT INTO leads(
       nombre, telefono, telefono_normalizado, etapa, origen,
       campaign_id, consentimiento_whatsapp, metadata, ultima_interaccion
     )
     VALUES($1, $2, $2, 'nuevo', $3, $4, $5, $6, NOW())
     ON CONFLICT(telefono_normalizado) DO UPDATE SET
       nombre = CASE
         WHEN leads.nombre = 'Contacto de WhatsApp' THEN EXCLUDED.nombre
         ELSE leads.nombre
       END,
       consentimiento_whatsapp = CASE
         WHEN $7 THEN FALSE
         WHEN $8 THEN TRUE
         ELSE leads.consentimiento_whatsapp
       END,
       campaign_id = COALESCE(EXCLUDED.campaign_id, leads.campaign_id),
       metadata = leads.metadata || EXCLUDED.metadata,
       ultima_interaccion = NOW(),
       fecha_actualizacion = NOW()
     RETURNING *`,
    [
      name || "Contacto de WhatsApp",
      phone,
      origin,
      referral?.source_id || referral?.ctwa_clid || null,
      !optedOut,
      metadata,
      optedOut,
      optedIn
    ]
  );
  return result.rows[0];
};

const registerInboundMessage = async (message, value) => {
  const phone = normalizePhone(
    message.from,
    env.whatsapp.defaultCountryCode
  );
  const content = messageText(message);
  const optedOut = optOutWords.has(content.trim().toUpperCase());
  const optedIn = optInWords.has(content.trim().toUpperCase());
  const contact = (value.contacts || []).find(
    (item) => normalizePhone(item.wa_id) === phone
  );
  const lead = await upsertInboundLead({
    phone,
    name: contact?.profile?.name,
    referral: message.referral,
    optedOut,
    optedIn
  });

  await pool.query(
    `INSERT INTO whatsapp_contacts(
       lead_id, telefono_normalizado, opt_in_at, opt_out_at,
       ultimo_mensaje_entrante, ventana_servicio_hasta, metadata
     )
     VALUES($1, $2, CASE WHEN $3 THEN NULL ELSE NOW() END,
            CASE WHEN $3 THEN NOW() ELSE NULL END,
            NOW(), NOW() + INTERVAL '24 hours', $4)
     ON CONFLICT(telefono_normalizado) DO UPDATE SET
       lead_id = EXCLUDED.lead_id,
       opt_in_at = CASE
         WHEN $3 THEN whatsapp_contacts.opt_in_at
         WHEN $5 THEN NOW()
         WHEN whatsapp_contacts.opt_out_at IS NOT NULL
           THEN whatsapp_contacts.opt_in_at
         ELSE COALESCE(whatsapp_contacts.opt_in_at, NOW())
       END,
       opt_out_at = CASE
         WHEN $3 THEN NOW()
         WHEN $5 THEN NULL
         ELSE whatsapp_contacts.opt_out_at
       END,
       ultimo_mensaje_entrante = NOW(),
       ventana_servicio_hasta = NOW() + INTERVAL '24 hours',
       metadata = whatsapp_contacts.metadata || EXCLUDED.metadata,
       fecha_actualizacion = NOW()`,
    [
      lead.id,
      phone,
      optedOut,
      { profileName: contact?.profile?.name || null },
      optedIn
    ]
  );

  const inserted = await pool.query(
    `INSERT INTO whatsapp_messages(
       lead_id, direccion, modo, telefono, contenido, estado,
       programado_para, provider_message_id, metadata
     )
     VALUES($1, 'entrante', 'cloud', $2, $3, 'recibido',
            to_timestamp($4), $5, $6)
     ON CONFLICT(provider_message_id)
       WHERE provider_message_id IS NOT NULL
       DO NOTHING
     RETURNING id`,
    [
      lead.id,
      phone,
      content,
      Number(message.timestamp || Math.floor(Date.now() / 1000)),
      message.id,
      {
        type: message.type,
        referral: message.referral || null,
        interactive: message.interactive || null
      }
    ]
  );

  if (!inserted.rowCount) return;

  await pool.query(
    `INSERT INTO lead_events(lead_id, tipo, descripcion, metadata)
     VALUES($1, $2, $3, $4)`,
    [
      lead.id,
      optedOut
        ? "whatsapp_baja"
        : optedIn
          ? "whatsapp_alta"
          : "whatsapp_entrante",
      optedOut
        ? "El contacto solicitó dejar de recibir mensajes"
        : optedIn
          ? "El contacto volvió a autorizar mensajes"
          : "Nuevo mensaje recibido por WhatsApp",
      { providerMessageId: message.id }
    ]
  );

  if (optedOut) return;

  const previousOutbound = await pool.query(
    `SELECT 1 FROM whatsapp_messages
     WHERE lead_id = $1 AND direccion = 'saliente'
     LIMIT 1`,
    [lead.id]
  );
  if (!previousOutbound.rowCount) {
    const welcome = await queueOutboundMessage({
      leadId: lead.id,
      templateKey: "bienvenida",
      parameters: { nombre: lead.nombre },
      allowWithoutConsent: true,
      metadata: { automatic: true, reason: "first_contact" }
    });
    if (env.whatsapp.mode === "cloud") {
      await dispatchOutboundMessage(welcome.id);
    }
  }
};

const registerStatus = async (status) => {
  const mappedStatus = META_STATUS[status.status];
  if (!mappedStatus) return;

  await pool.query(
    `UPDATE whatsapp_messages SET
       estado = $2,
       error = CASE
         WHEN $2 = 'fallido' THEN $3
         ELSE error
       END,
       metadata = metadata || $4::JSONB,
       fecha_actualizacion = NOW()
     WHERE provider_message_id = $1`,
    [
      status.id,
      mappedStatus,
      status.errors?.[0]?.title || status.errors?.[0]?.message || null,
      JSON.stringify({ lastProviderStatus: status.status })
    ]
  );
};

export const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    env.whatsapp.verifyToken &&
    token === env.whatsapp.verifyToken
  ) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
};

export const receiveWebhook = async (req, res, next) => {
  try {
    if (
      !verifyWebhookSignature(
        req.rawBody,
        req.get("x-hub-signature-256")
      )
    ) {
      return res.status(401).json({
        ok: false,
        message: "Firma de webhook inválida"
      });
    }

    for (const entry of req.body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const status of value.statuses || []) {
          await registerStatus(status);
        }
        for (const message of value.messages || []) {
          await registerInboundMessage(message, value);
        }
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
};

export const configurationStatus = (req, res) =>
  res.json({ ok: true, data: getWhatsAppConfiguration() });

export const listTemplates = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM whatsapp_templates
       ORDER BY categoria, nombre`
    );
    return res.json({ ok: true, data: result.rows });
  } catch (error) {
    return next(error);
  }
};

export const updateTemplateMeta = async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE whatsapp_templates SET
         nombre_meta = $2,
         idioma = COALESCE($3, idioma),
         aprobada_meta = $4,
         fecha_actualizacion = NOW()
       WHERE clave = $1
       RETURNING *`,
      [
        req.params.key,
        req.body.nombreMeta || null,
        req.body.idioma || null,
        Boolean(req.body.aprobadaMeta)
      ]
    );
    if (!result.rowCount) {
      return res.status(404).json({ ok: false, message: "Plantilla no encontrada" });
    }
    return res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
};

export const listMessages = async (req, res, next) => {
  try {
    const status = String(req.query.status || "").trim();
    const values = [];
    let where = "";
    if (status) {
      values.push(status);
      where = "WHERE m.estado = $1";
    }
    values.push(Math.min(Math.max(Number(req.query.limit) || 100, 1), 300));

    const result = await pool.query(
      `SELECT m.*, l.nombre AS lead_nombre, u.nombre AS usuario_nombre,
              t.nombre AS template_nombre
       FROM whatsapp_messages m
       LEFT JOIN leads l ON l.id = m.lead_id
       LEFT JOIN users u ON u.id = m.user_id
       LEFT JOIN whatsapp_templates t ON t.clave = m.template_key
       ${where}
       ORDER BY
         CASE WHEN m.estado IN ('preparado','programado','fallido') THEN 0 ELSE 1 END,
         m.programado_para ASC,
         m.fecha_creacion DESC
       LIMIT $${values.length}`,
      values
    );
    return res.json({ ok: true, data: result.rows });
  } catch (error) {
    return next(error);
  }
};

export const createMessage = async (req, res, next) => {
  try {
    const message = await queueOutboundMessage({
      leadId: req.body.leadId || null,
      userId: req.body.userId || null,
      phone: req.body.telefono,
      templateKey: req.body.templateKey || null,
      content: req.body.contenido,
      parameters: req.body.parametros || {},
      scheduledAt: req.body.programadoPara || new Date(),
      consentConfirmed: Boolean(req.body.consentimientoConfirmado),
      metadata: { createdBy: req.auth.userId }
    });

    if (req.body.enviarAhora) {
      const dispatch = await dispatchOutboundMessage(message.id);
      return res.status(201).json({ ok: true, data: dispatch });
    }
    return res.status(201).json({ ok: true, data: { message } });
  } catch (error) {
    return next(error);
  }
};

export const dispatchMessage = async (req, res, next) => {
  try {
    const result = await dispatchOutboundMessage(req.params.id);
    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

export const markMessageSent = async (req, res, next) => {
  try {
    const message = await markAssistedMessageSent(req.params.id);
    return res.json({ ok: true, data: message });
  } catch (error) {
    return next(error);
  }
};
