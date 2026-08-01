import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pool } from "../src/database/db.js";
import {
  processDueJobs,
  scheduleSubscriptionReminders
} from "../src/services/automation.service.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.join(
  currentDirectory,
  "..",
  "src",
  "database",
  "migrations"
);

const applyMigrations = async (database) => {
  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await database.exec(
      await readFile(path.join(migrationsDirectory, file), "utf8")
    );
  }
};

test("programa y procesa un recordatorio en modo asistido", async () => {
  const database = new PGlite();
  const originalQuery = pool.query;

  pool.query = async (text, parameters = []) => {
    const result = await database.query(text, parameters);
    return {
      ...result,
      rows: result.rows || [],
      rowCount: result.affectedRows ?? result.rows?.length ?? 0
    };
  };

  try {
    await applyMigrations(database);
    const user = await database.query(
      `INSERT INTO users(
         nombre, email, password_hash, telefono, rol, estado,
         whatsapp_opt_in_at
       )
       VALUES('Cliente Prueba', 'cliente@test.local', 'hash',
              '0984060513', 'cliente', 'activo', NOW())
       RETURNING id`
    );
    const plan = await database.query(
      "SELECT id FROM plans WHERE slug = 'mensual'"
    );
    const subscription = await database.query(
      `INSERT INTO subscriptions(
         user_id, plan_id, estado, fecha_inicio, fecha_fin
       )
       VALUES($1, $2, 'activa', CURRENT_DATE - 30, CURRENT_DATE)
       RETURNING id`,
      [user.rows[0].id, plan.rows[0].id]
    );

    const jobs = await scheduleSubscriptionReminders(subscription.rows[0].id);
    assert.equal(jobs.length, 3);

    await database.query(
      `UPDATE automation_jobs SET
         ejecutar_at = CASE
           WHEN payload->>'templateKey' = 'vence_3_dias'
             THEN NOW() - INTERVAL '1 minute'
           ELSE NOW() + INTERVAL '1 day'
         END`
    );

    const summary = await processDueJobs(10);
    assert.equal(summary.completed, 1);
    assert.equal(summary.failed, 0);

    const messages = await database.query(
      `SELECT telefono, template_key, estado, contenido
       FROM whatsapp_messages`
    );
    assert.equal(messages.rows.length, 1);
    assert.equal(messages.rows[0].telefono, "595984060513");
    assert.equal(messages.rows[0].template_key, "vence_3_dias");
    assert.equal(messages.rows[0].estado, "preparado");
    assert.match(messages.rows[0].contenido, /Cliente Prueba/);
  } finally {
    pool.query = originalQuery;
    await database.close();
  }
});
