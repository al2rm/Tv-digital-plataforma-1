export const healthCheck = (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Backend TV Digital funcionando",
    timestamp: new Date().toISOString()
  });
};
