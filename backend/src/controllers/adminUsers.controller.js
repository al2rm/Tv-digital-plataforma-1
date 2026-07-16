import { pool } from "../database/db.js";
import { hashPassword } from "../services/auth.service.js";

export const listUsers = async (req, res, next) => {
  try {
    const { search = "" } = req.query;
    const result = await pool.query(
      `SELECT id,nombre,email,telefono,rol,estado,fecha_creacion,ultimo_acceso
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
    const { nombre, email, password, telefono = null, rol = "cliente", estado = "activo" } = req.body;
    if (!nombre || !email || !password || password.length < 6) {
      return res.status(400).json({ ok:false, message:"Datos inválidos" });
    }
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users(nombre,email,password_hash,telefono,rol,estado)
       VALUES($1,$2,$3,$4,$5,$6)
       RETURNING id,nombre,email,telefono,rol,estado,fecha_creacion`,
      [nombre.trim(), email.toLowerCase().trim(), passwordHash, telefono, rol, estado]
    );
    res.status(201).json({ ok:true, data:result.rows[0] });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ ok:false, message:"El email ya está registrado" });
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { nombre, telefono, rol, estado } = req.body;
    const result = await pool.query(
      `UPDATE users SET nombre=COALESCE($1,nombre), telefono=COALESCE($2,telefono),
       rol=COALESCE($3,rol), estado=COALESCE($4,estado), fecha_actualizacion=NOW()
       WHERE id=$5 RETURNING id,nombre,email,telefono,rol,estado,fecha_creacion`,
      [nombre, telefono, rol, estado, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ ok:false, message:"Usuario no encontrado" });
    res.json({ ok:true, data:result.rows[0] });
  } catch (error) { next(error); }
};
