import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.join(
  currentDirectory,
  "..",
  "src",
  "database",
  "migrations"
);

test("aplica todas las migraciones en orden", async () => {
  const database = new PGlite();
  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  try {
    for (const file of files) {
      const sql = await readFile(path.join(migrationsDirectory, file), "utf8");
      await database.exec(sql);
    }

    const tables = await database.query(`
      SELECT COUNT(*)::INT AS total
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    const templates = await database.query(
      "SELECT COUNT(*)::INT AS total FROM whatsapp_templates"
    );

    assert.ok(tables.rows[0].total >= 15);
    assert.equal(templates.rows[0].total, 7);
  } finally {
    await database.close();
  }
});
