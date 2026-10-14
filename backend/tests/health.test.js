import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/app.js";
import { pool } from '../src/database/db.js';

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

test('readiness comprueba la base y no expone detalles de conexión',async t=>{
  const server=app.listen(0);t.after(()=>server.close());
  const original=pool.query;t.after(()=>{pool.query=original;});
  const url=`http://127.0.0.1:${server.address().port}/api/health/ready`;
  pool.query=async()=>({rows:[{ready:1}]});
  const good=await fetch(url);assert.equal(good.status,200);assert.equal((await good.json()).database,'ready');
  pool.query=async()=>{throw new Error('postgres://user:secret@private/database');};
  const bad=await fetch(url);assert.equal(bad.status,503);
  assert.equal(bad.headers.get('cache-control'),'no-store');assert.equal((await bad.text()).includes('secret'),false);
});
