export const adminMiddleware = (req, res, next) => {
  if (req.auth?.rol !== "admin") {
    return res.status(403).json({
      ok: false,
      message: "Esta acción requiere permisos de administrador"
    });
  }
  return next();
};

export const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.auth?.rol)) {
    return res.status(403).json({ ok:false, message:"No tienes permiso para realizar esta acción" });
  }
  return next();
};

export const staffMiddleware = requireRoles("admin", "vendedor", "soporte");
