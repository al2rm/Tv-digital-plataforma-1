import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

export const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.database,
  user: env.db.user,
  password: env.db.password
});

export const testConnection = async () => {
  const result = await pool.query("SELECT NOW()");
  return result.rows[0];
};
