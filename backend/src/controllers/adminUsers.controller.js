import { pool } from "../database/db.js";
import { hashPassword } from "../services/auth.service.js";

export const listUsers = async (req, res, next) => {
  try {
    const { search = "" } = req.query;
    const result = await pool.query(
      `SELECT id,nombre,email,telefono,rol,estado,fecha_creacion,ultimo_acceso,
              whatsapp_opt_in_at, whatsapp_opt_out_at
       FROM users
       WHERE nombre ILIKE $1 OR email ILIKE $1
       ORDER BY fecha_creacion DESC LIMIT 200`,
      [`%${search.trim()}%`]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) { next(error); }
};

export const createUser = async (req, res, next) => {
  try {
    const {
      nombre,
      email,
      password,
      telefono = null,
      rol = "cliente",
      estado = "activo",
      consentimientoWhatsapp = false
    } = req.body;
    if (!nombre || !email || !password || password.length < 6) {
      return res.status(400).json({ ok:false, message:"Datos inválidos" });
    }
    if (!["cliente", "admin"].includes(rol) ||
        !["activo", "inactivo", "bloqueado"].includes(estado)) {
      return res.status(400).json({ ok:false, message:"Rol o estado inválido" });
    }
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users(
         nombre,email,password_hash,telefono,rol,estado,whatsapp_opt_in_at
       )
       VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $7 THEN NOW() ELSE NULL END)
       RETURNING id,nombre,email,telefono,rol,estado,fecha_creacion,
                 whatsapp_opt_in_at`,
      [
        nombre.trim(),
        email.toLowerCase().trim(),
        passwordHash,
        telefono,
        rol,
        estado,
        consentimientoWhatsapp
      ]
    );
    res.status(201).json({ ok:true, data:result.rows[0] });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ ok:false, message:"El email ya está registrado" });
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { nombre, telefono, rol, estado, consentimientoWhatsapp } = req.body;
    if (rol && !["cliente", "admin"].includes(rol)) {
      return res.status(400).json({ ok:false, message:"Rol inválido" });
    }
    if (estado && !["activo", "inactivo", "bloqueado"].includes(estado)) {
      return res.status(400).json({ ok:false, message:"Estado inválido" });
    }
    const result = await pool.query(
      `UPDATE users SET nombre=COALESCE($1,nombre), telefono=COALESCE($2,telefono),
       rol=COALESCE($3,rol), estado=COALESCE($4,estado), fecha_actualizacion=NOW()
       , whatsapp_opt_in_at = CASE
           WHEN $5::BOOLEAN IS TRUE THEN COALESCE(whatsapp_opt_in_at, NOW())
           WHEN $5::BOOLEAN IS FALSE THEN NULL
           ELSE whatsapp_opt_in_at
         END,
         whatsapp_opt_out_at = CASE
           WHEN $5::BOOLEAN IS TRUE THEN NULL
           WHEN $5::BOOLEAN IS FALSE THEN NOW()
           ELSE whatsapp_opt_out_at
         END
       WHERE id=$6
       RETURNING id,nombre,email,telefono,rol,estado,fecha_creacion,
                 whatsapp_opt_in_at,whatsapp_opt_out_at`,
      [nombre, telefono, rol, estado, consentimientoWhatsapp, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ ok:false, message:"Usuario no encontrado" });
    res.json({ ok:true, data:result.rows[0] });
  } catch (error) { next(error); }
};

export const deleteUser = async (req, res, next) => {
  let client;
  try {
    const userId = Number(req.params.id);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(400).json({ ok: false, message: "Usuario inválido" });
    }
    if (userId === req.auth.userId) {
      return res.status(409).json({
        ok: false,
        message: "No puedes eliminar la cuenta con la que has iniciado sesión"
      });
    }

    const current = await pool.query(
      `SELECT u.id, u.nombre, u.rol,
              EXISTS(SELECT 1 FROM payments p WHERE p.user_id = u.id) AS tiene_pagos
       FROM users u WHERE u.id = $1`,
      [userId]
    );
    const user = current.rows[0];
    if (!user) {
      return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
    }
    if (user.tiene_pagos) {
      return res.status(409).json({
        ok: false,
        message: "Este cliente tiene pagos registrados. Bloquéalo para conservar el historial financiero."
      });
    }
    if (user.rol === "admin") {
      const admins = await pool.query(
        "SELECT COUNT(*)::INT AS total FROM users WHERE rol='admin' AND estado='activo'"
      );
      if (admins.rows[0].total <= 1) {
        return res.status(409).json({
          ok: false,
          message: "Debe quedar al menos un administrador activo"
        });
      }
    }

    client = await pool.connect();
    await client.query("BEGIN");
    await client.query(
      `UPDATE automation_jobs SET estado='cancelado', fecha_actualizacion=NOW()
       WHERE tipo='subscription_reminder'
         AND payload->>'subscriptionId' IN (
           SELECT id::TEXT FROM subscriptions WHERE user_id=$1
         )
         AND estado IN ('pendiente','fallido')`,
      [userId]
    );
    const result = await client.query(
      "DELETE FROM users WHERE id=$1 RETURNING id,nombre,email",
      [userId]
    );
    await client.query("COMMIT");
    return res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    return next(error);
  } finally {
    client?.release();
  }
};
