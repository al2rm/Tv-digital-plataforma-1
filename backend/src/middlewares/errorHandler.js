export const errorHandler = (err, req, res, next) => {
  console.error(err);

  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";

  res.status(statusCode).json({
    ok: false,
    message: statusCode >= 500 && isProduction
      ? "Error interno del servidor"
      : err.message || "Error interno del servidor"
  });
};
