import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = randomBytes(32).toString("hex");
process.env.XTREAM_CREDENTIALS_KEY = randomBytes(32).toString("hex");

const { pool } = await import("../src/database/db.js");
const { hashPassword } = await import("../src/services/auth.service.js");
const { default: app } = await import("../src/app.js");

test("revendedores, créditos, demos y límite de dispositivos", async (t) => {
  const database = new PGlite();
  const directory = new URL("../src/database/migrations/", import.meta.url);
  for (const file of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
    await database.exec(await readFile(new URL(file, directory), "utf8"));
  }
  const query = async (sql, params) => {
    const result = await database.query(sql, params);
    return { ...result, rowCount: result.rows.length || result.affectedRows || 0 };
  };
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  pool.query = query;
  pool.connect = async () => ({ query, release() {} });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    pool.query = originalQuery;
    pool.connect = originalConnect;
    await database.close();
    await pool.end();
  });

  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (path, { method = "GET", token, body, headers = {} } = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: response.status, ...await response.json() };
  };
  const password = `Test-${randomBytes(12).toString("hex")}`;
  await query("INSERT INTO users(nombre,email,password_hash,rol) VALUES('Admin','admin@operations.test',$1,'admin')", [await hashPassword(password)]);
  const admin = (await request("/auth/login", { method: "POST", body: { email: "admin@operations.test", password } })).data.token;

  const reseller = await request("/admin/v2/operations/resellers", {
    method: "POST", token: admin,
    body: { nombre: "Revendedor prueba", email: "seller@operations.test", password, initialCredits: 2 }
  });
  assert.equal(reseller.status, 201);
  assert.equal(reseller.data.credit_balance, 2);
  assert.equal((await query("SELECT COUNT(*)::INT AS total FROM reseller_accounts")).rows[0].total, 1);
  const sellerToken = (await request("/auth/login", { method: "POST", body: { email: reseller.data.email, password } })).data.token;

  const demo = await request("/admin/v2/operations/demos", {
    method: "POST", token: sellerToken,
    body: { nombre: "Interesado", hours: 2, maxDevices: 1 }
  });
  assert.equal(demo.status, 201);
  assert.match(demo.data.password, /^Tv-/);
  const visible = await request("/admin/v2/operations/resellers", { token: sellerToken });
  assert.equal(visible.data.length, 1);
  assert.equal(visible.data[0].credit_balance, 1);

  const demoToken = (await request("/auth/login", {
    method: "POST", body: { email: demo.data.email, password: demo.data.password }
  })).data.token;
  const firstDevice = await request("/app/account", { token: demoToken, headers: {
    "X-Device-Id": "11111111-1111-4111-8111-111111111111",
    "X-Device-Name": "Sala"
  }});
  assert.equal(firstDevice.status, 200);
  assert.equal(firstDevice.data.canPlay, true);
  assert.equal(firstDevice.data.active_devices, 1);
  assert.equal(firstDevice.data.subscription.isDemo, true);

  const blocked = await request("/app/account", { token: demoToken, headers: {
    "X-Device-Id": "22222222-2222-4222-8222-222222222222",
    "X-Device-Name": "Dormitorio"
  }});
  assert.equal(blocked.status, 409);

  const devices = await request(`/admin/v2/operations/devices?userId=${demo.data.id}`, { token: sellerToken });
  assert.equal(devices.data.length, 1);
  assert.equal((await request(`/admin/v2/operations/devices/${devices.data[0].id}`, { method: "DELETE", token: sellerToken })).status, 200);
  assert.equal((await request("/app/account", { token: demoToken, headers: {
    "X-Device-Id": "22222222-2222-4222-8222-222222222222"
  }})).status, 200);
  await query("UPDATE users SET access_expires_at=NOW()-INTERVAL '1 minute' WHERE id=$1", [demo.data.id]);
  const expired = await request("/app/account", { token: demoToken, headers: {
    "X-Device-Id": "22222222-2222-4222-8222-222222222222"
  }});
  assert.equal(expired.data.canPlay, false);
  assert.equal(expired.data.subscription, null);
});
