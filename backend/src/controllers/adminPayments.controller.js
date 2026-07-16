import { pool } from "../database/db.js";

export const listPayments = async (req,res,next) => {
  try {
    const result = await pool.query(
      `SELECT p.*,u.nombre AS usuario_nombre,u.email AS usuario_email
       FROM payments p JOIN users u ON u.id=p.user_id
       ORDER BY p.fecha_pago DESC LIMIT 500`
    );
    res.json({ ok:true, data:result.rows });
  } catch(error){ next(error); }
};

export const listSubscriptions = async (req,res,next) => {
  try {
    const result = await pool.query(
      `SELECT s.*,u.nombre AS usuario_nombre,u.email AS usuario_email,
       pl.nombre AS plan_nombre,pl.precio
       FROM subscriptions s
       JOIN users u ON u.id=s.user_id
       JOIN plans pl ON pl.id=s.plan_id
       ORDER BY s.fecha_fin DESC LIMIT 500`
    );
    res.json({ ok:true, data:result.rows });
  } catch(error){ next(error); }
};
