import { verifyAccessToken } from "../services/auth.service.js";

export const authMiddleware = (req, res, next) => {
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
    req.auth = {
      userId: Number(payload.sub),
      rol: payload.rol,
      email: payload.email
    };
    return next();
  } catch {
    return res.status(401).json({
      ok: false,
      message: "Sesión inválida o vencida"
    });
  }
};
