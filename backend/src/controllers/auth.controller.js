import { pool } from "../database/db.js";
import {
  signAccessToken,
  verifyPassword
} from "../services/auth.service.js";

const publicUser = (user) => ({
  id: user.id,
  nombre: user.nombre,
  email: user.email,
  telefono: user.telefono,
  rol: user.rol,
  estado: user.estado
});

export const login = async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        message: "Correo y contraseña son obligatorios"
      });
    }

    const result = await pool.query(
      `SELECT id, nombre, email, telefono, rol, estado, password_hash
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );
    const user = result.rows[0];
    const passwordMatches = user
      ? await verifyPassword(password, user.password_hash)
      : false;

    if (!user || !passwordMatches || user.estado !== "activo") {
      return res.status(401).json({
        ok: false,
        message: "Correo o contraseña incorrectos"
      });
    }

    await pool.query(
      "UPDATE users SET ultimo_acceso = NOW() WHERE id = $1",
      [user.id]
    );

    return res.json({
      ok: true,
      data: {
        token: signAccessToken(user),
        user: publicUser(user)
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const me = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, email, telefono, rol, estado
       FROM users
       WHERE id = $1`,
      [req.auth.userId]
    );
    if (!result.rowCount) {
      return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
    }
    return res.json({ ok: true, data: publicUser(result.rows[0]) });
  } catch (error) {
    return next(error);
  }
};
