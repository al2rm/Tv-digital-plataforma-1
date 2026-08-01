import crypto from "node:crypto";
import { env } from "../config/env.js";
import { buildWhatsAppLink } from "../utils/phone.js";

const requireCloudConfig = () => {
  const missing = [];
  if (!env.whatsapp.graphVersion) missing.push("WHATSAPP_GRAPH_VERSION");
  if (!env.whatsapp.phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!env.whatsapp.accessToken) missing.push("WHATSAPP_ACCESS_TOKEN");

  if (missing.length) {
    const error = new Error(
      `Configuración de WhatsApp Cloud incompleta: ${missing.join(", ")}`
    );
    error.statusCode = 503;
    throw error;
  }
};

const postCloudPayload = async (payload) => {
  requireCloudConfig();
  const url = `https://graph.facebook.com/${env.whatsapp.graphVersion}/${env.whatsapp.phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.whatsapp.accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      ...payload
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      body?.error?.message || `WhatsApp Cloud respondió ${response.status}`
    );
    error.statusCode = 502;
    error.providerResponse = body;
    throw error;
  }

  return {
    messageId: body.messages?.[0]?.id || null,
    response: body
  };
};

export const sendCloudText = (to, body) =>
  postCloudPayload({
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      preview_url: false,
      body
    }
  });

export const sendCloudTemplate = (to, template, parameters) => {
  const components = parameters.length
    ? [{
        type: "body",
        parameters: parameters.map((value) => ({
          type: "text",
          text: String(value)
        }))
      }]
    : undefined;

  return postCloudPayload({
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language },
      ...(components ? { components } : {})
    }
  });
};

export const prepareAssistedMessage = (to, body) => ({
  actionUrl: buildWhatsAppLink(to, body)
});

export const getWhatsAppConfiguration = () => ({
  mode: env.whatsapp.mode,
  assistedReady: true,
  cloudReady: Boolean(
    env.whatsapp.graphVersion &&
    env.whatsapp.phoneNumberId &&
    env.whatsapp.accessToken
  ),
  webhookReady: Boolean(env.whatsapp.verifyToken && env.whatsapp.appSecret)
});

export const verifyWebhookSignature = (rawBody, signatureHeader) => {
  if (!env.whatsapp.appSecret || !rawBody || !signatureHeader) return false;

  const expected = `sha256=${crypto
    .createHmac("sha256", env.whatsapp.appSecret)
    .update(rawBody)
    .digest("hex")}`;
  const received = String(signatureHeader);

  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
};
