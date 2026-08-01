export const adminMiddleware = (req, res, next) => {
  if (req.auth?.rol !== "admin") {
    return res.status(403).json({
      ok: false,
      message: "Esta acción requiere permisos de administrador"
    });
  }
  return next();
};
