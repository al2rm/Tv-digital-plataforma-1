import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/app.js";

test("GET /api/health responde correctamente", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(typeof body.message, "string");
});

test("protege el CRM cuando no existe una sesión", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/crm/leads`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.ok, false);
});
