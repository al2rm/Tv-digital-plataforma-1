import { env } from "../config/env.js";
import { pool } from "../database/db.js";
import {
  dispatchOutboundMessage,
  queueOutboundMessage
} from "./whatsappMessage.service.js";

export const scheduleSubscriptionReminders = async (subscriptionId) => {
  await pool.query(
    `UPDATE automation_jobs
     SET estado = 'cancelado', fecha_actualizacion = NOW()
     WHERE tipo = 'subscription_reminder'
       AND estado IN ('pendiente', 'fallido')
       AND payload->>'subscriptionId' = $1`,
    [String(subscriptionId)]
  );

  const result = await pool.query(
    `INSERT INTO automation_jobs(
       tipo, unique_key, estado, ejecutar_at, payload
     )
     SELECT
       'subscription_reminder',
       CONCAT('subscription:', s.id, ':', s.fecha_fin, ':', reminder.offset_days),
       'pendiente',
       (s.fecha_fin + reminder.offset_days + TIME '09:00')
         AT TIME ZONE 'America/Asuncion',
       jsonb_build_object(
         'subscriptionId', s.id,
         'userId', u.id,
         'fechaFin', s.fecha_fin,
         'templateKey', reminder.template_key,
         'parameters', jsonb_build_object(
           'nombre', u.nombre,
           'plan', p.nombre,
           'vencimiento', TO_CHAR(s.fecha_fin, 'DD/MM/YYYY')
         )
       )
     FROM subscriptions s
     JOIN users u ON u.id = s.user_id
     JOIN plans p ON p.id = s.plan_id
     CROSS JOIN (
       VALUES
         (-3, 'vence_3_dias'),
         (0, 'vence_hoy'),
         (3, 'vencido_3_dias')
     ) AS reminder(offset_days, template_key)
     WHERE s.id = $1
       AND u.telefono IS NOT NULL
       AND u.whatsapp_opt_in_at IS NOT NULL
       AND u.whatsapp_opt_out_at IS NULL
     ON CONFLICT(unique_key) DO UPDATE SET
       ejecutar_at = EXCLUDED.ejecutar_at,
       payload = EXCLUDED.payload,
       estado = CASE
         WHEN automation_jobs.estado = 'completado' THEN 'completado'
         ELSE 'pendiente'
       END,
       fecha_actualizacion = NOW()
     RETURNING id, unique_key, ejecutar_at`,
    [subscriptionId]
  );
  return result.rows;
};

const processSubscriptionReminder = async (job) => {
  const subscriptionId = Number(job.payload.subscriptionId);
  const subscriptionResult = await pool.query(
    `SELECT s.id, s.estado, s.fecha_fin,
            TO_CHAR(s.fecha_fin, 'YYYY-MM-DD') AS fecha_fin_iso,
            u.id AS user_id,
            u.whatsapp_opt_in_at, u.whatsapp_opt_out_at
     FROM subscriptions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1`,
    [subscriptionId]
  );
  const subscription = subscriptionResult.rows[0];
  if (!subscription) return { skipped: "subscription_not_found" };
  if (subscription.estado === "cancelada") return { skipped: "cancelled" };
  if (
    subscription.fecha_fin_iso !==
    String(job.payload.fechaFin).slice(0, 10)
  ) {
    return { skipped: "renewed" };
  }
  if (
    !subscription.whatsapp_opt_in_at ||
    subscription.whatsapp_opt_out_at
  ) {
    return { skipped: "no_consent" };
  }

  const message = await queueOutboundMessage({
    userId: subscription.user_id,
    templateKey: job.payload.templateKey,
    parameters: job.payload.parameters || {},
    metadata: {
      automatic: true,
      automationJobId: job.id,
      subscriptionId
    }
  });

  if (env.whatsapp.mode === "cloud") {
    await dispatchOutboundMessage(message.id);
  }
  return { messageId: message.id };
};

const processJob = async (job) => {
  if (job.tipo === "subscription_reminder") {
    return processSubscriptionReminder(job);
  }
  const error = new Error(`Tipo de automatización no soportado: ${job.tipo}`);
  error.statusCode = 400;
  throw error;
};

export const processDueJobs = async (batchSize = env.automation.batchSize) => {
  await pool.query(
    `UPDATE subscriptions
     SET estado = 'vencida', fecha_actualizacion = NOW()
     WHERE estado = 'activa' AND fecha_fin < CURRENT_DATE`
  );

  const claimed = await pool.query(
    `UPDATE automation_jobs jobs SET
       estado = 'procesando',
       intentos = jobs.intentos + 1,
       fecha_actualizacion = NOW()
     WHERE jobs.id IN (
       SELECT id
       FROM automation_jobs
       WHERE estado IN ('pendiente', 'fallido')
         AND ejecutar_at <= NOW()
         AND intentos < max_intentos
       ORDER BY ejecutar_at
       FOR UPDATE SKIP LOCKED
       LIMIT $1
     )
     RETURNING jobs.*`,
    [Math.min(Math.max(Number(batchSize) || 1, 1), 100)]
  );

  const summary = { claimed: claimed.rowCount, completed: 0, failed: 0 };
  for (const job of claimed.rows) {
    try {
      const result = await processJob(job);
      await pool.query(
        `UPDATE automation_jobs SET
           estado = 'completado',
           completado_at = NOW(),
           ultimo_error = NULL,
           payload = payload || $2::JSONB,
           fecha_actualizacion = NOW()
         WHERE id = $1`,
        [job.id, JSON.stringify({ result })]
      );
      summary.completed += 1;
    } catch (error) {
      const finalFailure = job.intentos >= job.max_intentos;
      await pool.query(
        `UPDATE automation_jobs SET
           estado = $2,
           ultimo_error = $3,
           ejecutar_at = CASE
             WHEN $2 = 'fallido' THEN NOW() + ($4 * INTERVAL '5 minutes')
             ELSE ejecutar_at
           END,
           fecha_actualizacion = NOW()
         WHERE id = $1`,
        [
          job.id,
          finalFailure ? "cancelado" : "fallido",
          error.message,
          Math.max(job.intentos, 1)
        ]
      );
      summary.failed += 1;
    }
  }
  return summary;
};

let timer = null;
let running = false;

export const startAutomationWorker = () => {
  if (timer) return;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processDueJobs();
    } catch (error) {
      console.error("Error en trabajador de automatización:", error.message);
    } finally {
      running = false;
    }
  };

  void tick();
  timer = setInterval(tick, Math.max(env.automation.intervalMs, 10000));
  timer.unref();
};

export const stopAutomationWorker = () => {
  if (timer) clearInterval(timer);
  timer = null;
};
