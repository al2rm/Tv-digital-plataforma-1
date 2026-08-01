import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { env } from "../src/config/env.js";
import {
  prepareAssistedMessage,
  verifyWebhookSignature
} from "../src/services/whatsappTransport.service.js";

test("valida la firma SHA-256 del webhook de WhatsApp", () => {
  const previousSecret = env.whatsapp.appSecret;
  env.whatsapp.appSecret = "secreto-de-prueba";
  const payload = Buffer.from('{"entry":[]}');
  const signature = `sha256=${crypto
    .createHmac("sha256", env.whatsapp.appSecret)
    .update(payload)
    .digest("hex")}`;

  try {
    assert.equal(verifyWebhookSignature(payload, signature), true);
    assert.equal(
      verifyWebhookSignature(payload, `sha256=${"0".repeat(64)}`),
      false
    );
  } finally {
    env.whatsapp.appSecret = previousSecret;
  }
});

test("prepara un envío asistido sin contactar servicios externos", () => {
  const result = prepareAssistedMessage(
    "595984060513",
    "Tu servicio vence mañana"
  );
  assert.match(result.actionUrl, /^https:\/\/wa\.me\/595984060513\?text=/);
});
