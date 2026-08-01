import { env } from "../config/env.js";
import { pool } from "../database/db.js";
import {
  getWhatsAppConfiguration,
  prepareAssistedMessage,
  sendCloudTemplate,
  sendCloudText
} from "./whatsappTransport.service.js";
import { isValidPhone, normalizePhone } from "../utils/phone.js";
import {
  renderTemplate,
  unresolvedTemplateVariables
} from "../utils/template.js";

const loadRecipient = async ({ leadId, userId }) => {
  if (leadId) {
    const result = await pool.query(
      `SELECT id, nombre, telefono_normalizado AS telefono,
              consentimiento_whatsapp AS consent
       FROM leads WHERE id = $1`,
      [leadId]
    );
    return result.rows[0] || null;
  }

  if (userId) {
    const result = await pool.query(
      `SELECT id, nombre, telefono,
              (whatsapp_opt_in_at IS NOT NULL AND whatsapp_opt_out_at IS NULL) AS consent
       FROM users WHERE id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  return null;
};

const loadTemplate = async (templateKey) => {
  if (!templateKey) return null;
  const result = await pool.query(
    `SELECT clave, nombre_meta, categoria, idioma, contenido,
            variables, activa, aprobada_meta
     FROM whatsapp_templates
     WHERE clave = $1`,
    [templateKey]
  );
  return result.rows[0] || null;
};

export const queueOutboundMessage = async ({
  leadId = null,
  userId = null,
  phone,
  templateKey = null,
  content = "",
  parameters = {},
  scheduledAt = new Date(),
  consentConfirmed = false,
  allowWithoutConsent = false,
  metadata = {}
}) => {
  const recipient = await loadRecipient({ leadId, userId });
  if ((leadId || userId) && !recipient) {
    const error = new Error("Destinatario no encontrado");
    error.statusCode = 404;
    throw error;
  }

  if (
    !allowWithoutConsent &&
    !consentConfirmed &&
    recipient &&
    !recipient.consent
  ) {
    const error = new Error(
      "El contacto no tiene consentimiento activo para mensajes de WhatsApp"
    );
    error.statusCode = 409;
    throw error;
  }

  const normalizedPhone = normalizePhone(
    phone || recipient?.telefono,
    env.whatsapp.defaultCountryCode
  );
  if (!isValidPhone(normalizedPhone)) {
    const error = new Error("Número de WhatsApp inválido");
    error.statusCode = 400;
    throw error;
  }

  const template = await loadTemplate(templateKey);
  if (templateKey && (!template || !template.activa)) {
    const error = new Error("Plantilla de WhatsApp no encontrada o desactivada");
    error.statusCode = 400;
    throw error;
  }

  const rendered = template
    ? renderTemplate(template.contenido, parameters)
    : String(content || "").trim();
  if (!rendered) {
    const error = new Error("El mensaje no puede estar vacío");
    error.statusCode = 400;
    throw error;
  }

  const unresolved = unresolvedTemplateVariables(rendered);
  if (unresolved.length) {
    const error = new Error(
      `Faltan variables de plantilla: ${unresolved.join(", ")}`
    );
    error.statusCode = 400;
    throw error;
  }

  const targetDate = new Date(scheduledAt);
  if (Number.isNaN(targetDate.getTime())) {
    const error = new Error("Fecha de programación inválida");
    error.statusCode = 400;
    throw error;
  }

  const status = targetDate.getTime() > Date.now()
    ? "programado"
    : "preparado";
  const result = await pool.query(
    `INSERT INTO whatsapp_messages(
       lead_id, user_id, direccion, modo, telefono, template_key,
       contenido, parametros, estado, programado_para, metadata
     )
     VALUES($1, $2, 'saliente', $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      leadId,
      userId,
      env.whatsapp.mode,
      normalizedPhone,
      templateKey,
      rendered,
      parameters,
      status,
      targetDate,
      metadata
    ]
  );

  return result.rows[0];
};

export const dispatchOutboundMessage = async (messageId) => {
  const result = await pool.query(
    `SELECT m.*, t.nombre_meta, t.categoria, t.idioma,
            t.variables, t.aprobada_meta
     FROM whatsapp_messages m
     LEFT JOIN whatsapp_templates t ON t.clave = m.template_key
     WHERE m.id = $1 AND m.direccion = 'saliente'`,
    [messageId]
  );
  const message = result.rows[0];
  if (!message) {
    const error = new Error("Mensaje no encontrado");
    error.statusCode = 404;
    throw error;
  }
  if (["enviado", "entregado", "leido"].includes(message.estado)) {
    return { message, alreadySent: true };
  }

  const configuration = getWhatsAppConfiguration();
  if (configuration.mode === "assisted") {
    await pool.query(
      `UPDATE whatsapp_messages
       SET estado = 'preparado', fecha_actualizacion = NOW(), error = NULL
       WHERE id = $1`,
      [messageId]
    );
    return {
      message: { ...message, estado: "preparado" },
      ...prepareAssistedMessage(message.telefono, message.contenido)
    };
  }

  if (
    message.template_key &&
    message.categoria !== "service" &&
    (!message.aprobada_meta || !message.nombre_meta)
  ) {
    const error = new Error(
      "La plantilla debe estar aprobada en Meta antes del envío automático"
    );
    error.statusCode = 409;
    throw error;
  }

  await pool.query(
    `UPDATE whatsapp_messages
     SET estado = 'enviando', fecha_actualizacion = NOW(), error = NULL
     WHERE id = $1`,
    [messageId]
  );

  try {
    let providerResult;
    if (message.template_key && message.aprobada_meta && message.nombre_meta) {
      const variableNames = Array.isArray(message.variables)
        ? message.variables
        : [];
      const values = variableNames.map((key) => message.parametros?.[key] ?? "");
      providerResult = await sendCloudTemplate(
        message.telefono,
        { name: message.nombre_meta, language: message.idioma },
        values
      );
    } else {
      providerResult = await sendCloudText(message.telefono, message.contenido);
    }

    const updated = await pool.query(
      `UPDATE whatsapp_messages
       SET estado = 'enviado', enviado_at = NOW(),
           provider_message_id = $2, metadata = metadata || $3::JSONB,
           fecha_actualizacion = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        messageId,
        providerResult.messageId,
        JSON.stringify({ providerResponse: providerResult.response })
      ]
    );
    return { message: updated.rows[0] };
  } catch (error) {
    await pool.query(
      `UPDATE whatsapp_messages
       SET estado = 'fallido', error = $2, fecha_actualizacion = NOW()
       WHERE id = $1`,
      [messageId, error.message]
    );
    throw error;
  }
};

export const markAssistedMessageSent = async (messageId) => {
  const result = await pool.query(
    `UPDATE whatsapp_messages
     SET estado = 'enviado', enviado_at = NOW(), fecha_actualizacion = NOW()
     WHERE id = $1 AND direccion = 'saliente'
       AND estado IN ('preparado', 'programado', 'fallido')
     RETURNING *`,
    [messageId]
  );
  if (!result.rowCount) {
    const error = new Error("El mensaje no se puede marcar como enviado");
    error.statusCode = 409;
    throw error;
  }
  return result.rows[0];
};
