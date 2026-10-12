import { randomBytes } from "node:crypto";
import { pool } from "../database/db.js";
import { hashPassword } from "../services/auth.service.js";

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const positiveInteger = (value, field, max = 100000) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > max) throw fail(`${field} no es válido`);
  return parsed;
};
const databaseId = (value, field) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw fail(`${field} no es válido`);
  return parsed;
};

export const listResellers = async (req, res, next) => {
  try {
    const visibility = req.auth.rol === "admin" ? "" : "WHERE u.id=$1";
    const params = req.auth.rol === "admin" ? [] : [req.auth.userId];
    const result = await pool.query(`SELECT u.id,u.nombre,u.email,u.telefono,u.estado,
      r.credit_balance,r.is_super_reseller,r.parent_user_id,parent.nombre AS parent_name,
      COUNT(DISTINCT child.id)::INT AS created_clients,
      COUNT(DISTINCT child.id) FILTER (WHERE child.is_demo AND child.access_expires_at > NOW())::INT AS active_demos
      FROM reseller_accounts r JOIN users u ON u.id=r.user_id
      LEFT JOIN users parent ON parent.id=r.parent_user_id
      LEFT JOIN users child ON child.created_by_user_id=u.id
      ${visibility}
      GROUP BY u.id,r.user_id,parent.nombre ORDER BY u.nombre`, params);
    res.json({ ok: true, data: result.rows });
  } catch (error) { next(error); }
};

export const createReseller = async (req, res, next) => {
  let client;
  try {
    const { nombre, email, password, telefono = null, initialCredits = 0, isSuperReseller = false, parentUserId = null } = req.body;
    if (!nombre?.trim() || !email?.trim() || !password || password.length < 6) throw fail("Completa nombre, correo y una contraseña de al menos 6 caracteres");
    const credits = positiveInteger(initialCredits, "El saldo inicial");
    const passwordHash = await hashPassword(password);
    client = await pool.connect();
    await client.query("BEGIN");
    const parentId = parentUserId ? databaseId(parentUserId, "El revendedor superior") : null;
    if (parentId) {
      const parent = await client.query("SELECT 1 FROM reseller_accounts WHERE user_id=$1", [parentId]);
      if (!parent.rowCount) throw fail("El revendedor superior no existe", 404);
    }
    const created = await client.query(
      `INSERT INTO users(nombre,email,password_hash,telefono,rol,estado,created_by_user_id)
       VALUES($1,$2,$3,$4,'vendedor','activo',$5)
       RETURNING id,nombre,email,telefono,estado`,
      [nombre.trim(), email.toLowerCase().trim(), passwordHash, telefono, req.auth.userId]
    );
    const reseller = created.rows[0];
    await client.query(
      `INSERT INTO reseller_accounts(user_id,parent_user_id,credit_balance,is_super_reseller)
       VALUES($1,$2,$3,$4)`,
      [reseller.id, parentId, credits, Boolean(isSuperReseller)]
    );
    if (credits) await client.query(
      `INSERT INTO credit_movements(reseller_user_id,actor_user_id,amount,balance_after,reason,note)
       VALUES($1,$2,$3,$3,'saldo_inicial','Creación del revendedor')`,
      [reseller.id, req.auth.userId, credits]
    );
    await client.query("COMMIT");
    res.status(201).json({ ok: true, data: { ...reseller, credit_balance: credits, is_super_reseller: Boolean(isSuperReseller) } });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return res.status(409).json({ ok: false, message: "El correo ya está registrado" });
    next(error);
  } finally { client?.release(); }
};

export const adjustCredits = async (req, res, next) => {
  let client;
  try {
    const resellerUserId = databaseId(req.params.userId, "El revendedor");
    const amount = Number(req.body.amount);
    if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 100000) throw fail("Indica una cantidad entera distinta de cero");
    const note = String(req.body.note || "Ajuste manual").trim().slice(0, 240);
    client = await pool.connect();
    await client.query("BEGIN");
    const current = await client.query("SELECT credit_balance FROM reseller_accounts WHERE user_id=$1 FOR UPDATE", [resellerUserId]);
    if (!current.rowCount) throw fail("Revendedor no encontrado", 404);
    const balance = Number(current.rows[0].credit_balance) + amount;
    if (balance < 0) throw fail("El revendedor no tiene créditos suficientes", 409);
    await client.query("UPDATE reseller_accounts SET credit_balance=$1,updated_at=NOW() WHERE user_id=$2", [balance, resellerUserId]);
    const movement = await client.query(
      `INSERT INTO credit_movements(reseller_user_id,actor_user_id,amount,balance_after,reason,note)
       VALUES($1,$2,$3,$4,'ajuste',$5) RETURNING *`,
      [resellerUserId, req.auth.userId, amount, balance, note]
    );
    await client.query("COMMIT");
    res.json({ ok: true, data: movement.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client?.release(); }
};

export const listCreditMovements = async (req, res, next) => {
  try {
    const resellerUserId = databaseId(req.params.userId, "El revendedor");
    const result = await pool.query(`SELECT m.id,m.amount,m.balance_after,m.reason,m.note,m.created_at,
      u.nombre AS actor_name FROM credit_movements m LEFT JOIN users u ON u.id=m.actor_user_id
      WHERE m.reseller_user_id=$1 ORDER BY m.created_at DESC LIMIT 100`, [resellerUserId]);
    res.json({ ok: true, data: result.rows });
  } catch (error) { next(error); }
};

export const createDemo = async (req, res, next) => {
  let client;
  try {
    const hours = positiveInteger(req.body.hours ?? 24, "La duración", 168);
    if (hours < 1) throw fail("La demo debe durar al menos una hora");
    const maxDevices = positiveInteger(req.body.maxDevices ?? 1, "El límite de dispositivos", 10);
    if (maxDevices < 1) throw fail("Debe permitirse al menos un dispositivo");
    const ownerUserId = req.auth.rol === "vendedor" ? req.auth.userId : (req.body.resellerUserId ? databaseId(req.body.resellerUserId, "El revendedor") : null);
    const code = randomBytes(5).toString("hex");
    const email = `demo-${code}@tvdigital.local`;
    const password = `Tv-${randomBytes(6).toString("base64url")}`;
    const name = String(req.body.nombre || `Demo ${code.slice(0, 6).toUpperCase()}`).trim().slice(0, 120);
    const passwordHash = await hashPassword(password);
    client = await pool.connect();
    await client.query("BEGIN");
    if (ownerUserId) {
      const reseller = await client.query("SELECT credit_balance FROM reseller_accounts WHERE user_id=$1 FOR UPDATE", [ownerUserId]);
      if (!reseller.rowCount) throw fail("La cuenta no está habilitada como revendedor", 409);
      const balance = Number(reseller.rows[0].credit_balance) - 1;
      if (balance < 0) throw fail("No hay créditos suficientes para crear la demo", 409);
      await client.query("UPDATE reseller_accounts SET credit_balance=$1,updated_at=NOW() WHERE user_id=$2", [balance, ownerUserId]);
      await client.query(
        `INSERT INTO credit_movements(reseller_user_id,actor_user_id,amount,balance_after,reason,note)
         VALUES($1,$2,-1,$3,'demo','Creación de acceso demo')`,
        [ownerUserId, req.auth.userId, balance]
      );
    }
    const result = await client.query(
      `INSERT INTO users(nombre,email,password_hash,rol,estado,is_demo,access_expires_at,max_devices,created_by_user_id)
       VALUES($1,$2,$3,'cliente','activo',TRUE,NOW()+($4::TEXT || ' hours')::INTERVAL,$5,$6)
       RETURNING id,nombre,email,access_expires_at,max_devices`,
      [name, email, passwordHash, hours, maxDevices, ownerUserId || req.auth.userId]
    );
    await client.query("COMMIT");
    const demo = result.rows[0];
    const accessMessage = `TV Digital Pro\nUsuario: ${email}\nContraseña: ${password}\nDemo válida hasta: ${new Date(demo.access_expires_at).toLocaleString("es-PY", { timeZone: "America/Asuncion" })}`;
    res.status(201).json({ ok: true, data: { ...demo, password, accessMessage } });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client?.release(); }
};

export const listDevices = async (req, res, next) => {
  try {
    const userId = req.query.userId ? databaseId(req.query.userId, "El cliente") : null;
    const conditions = [];
    const params = [];
    if (userId) { params.push(userId); conditions.push(`d.user_id=$${params.length}`); }
    if (req.auth.rol === "vendedor") { params.push(req.auth.userId); conditions.push(`u.created_by_user_id=$${params.length}`); }
    const filter = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(`SELECT d.id,d.user_id,d.device_name,d.platform,d.first_seen_at,d.last_seen_at,
      u.nombre AS user_name,u.email FROM user_devices d JOIN users u ON u.id=d.user_id
      ${filter} ORDER BY d.last_seen_at DESC LIMIT 300`, params);
    res.json({ ok: true, data: result.rows });
  } catch (error) { next(error); }
};

export const deleteDevice = async (req, res, next) => {
  try {
    const deviceId = databaseId(req.params.id, "El dispositivo");
    const result = req.auth.rol === "vendedor"
      ? await pool.query(`DELETE FROM user_devices d USING users u
          WHERE d.id=$1 AND u.id=d.user_id AND u.created_by_user_id=$2
          RETURNING d.id,d.user_id,d.device_name`, [deviceId, req.auth.userId])
      : await pool.query("DELETE FROM user_devices WHERE id=$1 RETURNING id,user_id,device_name", [deviceId]);
    if (!result.rowCount) throw fail("Dispositivo no encontrado", 404);
    res.json({ ok: true, data: result.rows[0] });
  } catch (error) { next(error); }
};
