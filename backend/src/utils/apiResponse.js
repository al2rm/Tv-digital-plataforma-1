export const successResponse = (res, data = {}, message = "Operación exitosa", status = 200) => {
  return res.status(status).json({
    ok: true,
    message,
    data
  });
};

export const errorResponse = (res, message = "Error", status = 400) => {
  return res.status(status).json({
    ok: false,
    message
  });
};
