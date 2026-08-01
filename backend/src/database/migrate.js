import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const currentFile = fileURLToPath(import.meta.url);
const migrationsDir = path.join(path.dirname(currentFile), "migrations");

const ensureMigrationsTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

export const runMigrations = async () => {
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const client = await pool.connect();
  const applied = [];

  try {
    await ensureMigrationsTable(client);

    for (const filename of files) {
      const exists = await client.query(
        "SELECT 1 FROM schema_migrations WHERE filename = $1",
        [filename]
      );
      if (exists.rowCount) continue;

      const sql = await fs.readFile(path.join(migrationsDir, filename), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations(filename) VALUES($1)",
          [filename]
        );
        await client.query("COMMIT");
        applied.push(filename);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
  }

  return applied;
};

if (process.argv[1] === currentFile) {
  try {
    const applied = await runMigrations();
    console.log(applied.length
      ? `Migraciones aplicadas: ${applied.join(", ")}`
      : "Base de datos actualizada; no había migraciones pendientes.");
  } catch (error) {
    console.error("No se pudieron aplicar las migraciones:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
