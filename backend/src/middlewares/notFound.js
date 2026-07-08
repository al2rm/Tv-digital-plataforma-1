export const notFound = (req, res, next) => {
  res.status(404).json({
    ok: false,
    message: `Ruta no encontrada: ${req.originalUrl}`
  });
};
