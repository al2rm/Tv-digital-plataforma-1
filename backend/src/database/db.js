import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

const connectionConfig = env.db.connectionString
  ? { connectionString: env.db.connectionString }
  : {
      host: env.db.host,
      port: env.db.port,
      database: env.db.database,
      user: env.db.user,
      password: env.db.password
    };

if (env.db.ssl) {
  connectionConfig.ssl = { rejectUnauthorized: false };
}

export const pool = new Pool(connectionConfig);

export const testConnection = async () => {
  const result = await pool.query("SELECT NOW()");
  return result.rows[0];
};
