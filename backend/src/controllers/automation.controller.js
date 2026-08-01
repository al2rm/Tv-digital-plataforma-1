import { pool } from "../database/db.js";
import { processDueJobs } from "../services/automation.service.js";

export const listAutomationJobs = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM automation_jobs
       ORDER BY
         CASE estado
           WHEN 'fallido' THEN 0
           WHEN 'pendiente' THEN 1
           WHEN 'procesando' THEN 2
           ELSE 3
         END,
         ejecutar_at ASC
       LIMIT 300`
    );
    return res.json({ ok: true, data: result.rows });
  } catch (error) {
    return next(error);
  }
};

export const runAutomations = async (req, res, next) => {
  try {
    const summary = await processDueJobs(req.body.batchSize);
    return res.json({ ok: true, data: summary });
  } catch (error) {
    return next(error);
  }
};
