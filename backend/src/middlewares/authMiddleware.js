import { verifyAccessToken } from "../services/auth.service.js";
import { pool } from "../database/db.js";

export const authMiddleware = async (req, res, next) => {
  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      ok: false,
      message: "Debes iniciar sesión"
    });
  }

  try {
    const payload = verifyAccessToken(token);
    if (!Number.isSafeInteger(Number(payload.sub)) || Number(payload.sub) <= 0) throw new Error("Invalid subject");
    req.auth = { userId: Number(payload.sub) };
  } catch {
    return res.status(401).json({
      ok: false,
      message: "Sesión inválida o vencida"
    });
  }
  try {
    const result = await pool.query("SELECT id, rol, email, estado FROM users WHERE id=$1", [req.auth.userId]);
    const user = result.rows[0];
    if (!user || user.estado !== "activo") return res.status(401).json({ ok:false, message:"Cuenta desactivada. Contacta al administrador." });
    req.auth = { userId:Number(user.id), rol:user.rol, email:user.email };
    return next();
  } catch (error) { return next(error); }
};
