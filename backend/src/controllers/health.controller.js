export const healthCheck = (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Backend TV Digital funcionando",
    timestamp: new Date().toISOString()
  });
};
import { pool } from '../database/db.js';


export const readinessCheck = async (req, res) => {
  res.set('Cache-Control','no-store');
  try {
    await pool.query('SELECT 1 AS ready');
    res.status(200).json({ok:true,database:'ready'});
  } catch {
    res.status(503).json({ok:false,database:'unavailable',message:'La base de datos no está disponible.'});
  }
};
