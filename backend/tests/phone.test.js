import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWhatsAppLink,
  isValidPhone,
  normalizePhone
} from "../src/utils/phone.js";

test("normaliza números paraguayos para WhatsApp", () => {
  assert.equal(normalizePhone("0984 060 513"), "595984060513");
  assert.equal(normalizePhone("+595 984 060 513"), "595984060513");
  assert.equal(normalizePhone("00595 984 060 513"), "595984060513");
  assert.equal(isValidPhone("595984060513"), true);
});

test("genera enlace asistido con mensaje codificado", () => {
  const link = buildWhatsAppLink("595984060513", "Hola Aldo 👋");
  assert.equal(
    link,
    "https://wa.me/595984060513?text=Hola%20Aldo%20%F0%9F%91%8B"
  );
});
