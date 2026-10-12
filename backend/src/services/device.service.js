import { createHash } from "node:crypto";
import { pool } from "../database/db.js";

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const cleanHeader = (value, max) => String(value || "").trim().slice(0, max);

export const registerRequestDevice = async (req) => {
  const deviceKey = cleanHeader(req.get("X-Device-Id"), 160);
  if (!deviceKey) return null;
  if (deviceKey.length < 12) throw fail("El identificador del dispositivo no es válido");

  const hash = createHash("sha256").update(deviceKey).digest("hex");
  const name = cleanHeader(req.get("X-Device-Name"), 100) || "TV Box";
  const platform = cleanHeader(req.get("X-Device-Platform"), 40) || "Android TV";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userResult = await client.query(
      "SELECT max_devices FROM users WHERE id=$1 FOR UPDATE",
      [req.auth.userId]
    );
    const user = userResult.rows[0];
    if (!user) throw fail("Usuario no encontrado", 404);
    const existing = await client.query(
      "SELECT id FROM user_devices WHERE user_id=$1 AND device_key_hash=$2",
      [req.auth.userId, hash]
    );
    if (existing.rowCount) {
      await client.query(
        "UPDATE user_devices SET device_name=$1,platform=$2,last_seen_at=NOW() WHERE id=$3",
        [name, platform, existing.rows[0].id]
      );
    } else {
      const count = await client.query(
        "SELECT COUNT(*)::INT AS total FROM user_devices WHERE user_id=$1",
        [req.auth.userId]
      );
      if (count.rows[0].total >= Number(user.max_devices)) {
        throw fail(`Límite de ${user.max_devices} dispositivo(s) alcanzado. Solicita al administrador liberar uno.`, 409);
      }
      await client.query(
        `INSERT INTO user_devices(user_id,device_key_hash,device_name,platform)
         VALUES($1,$2,$3,$4)`,
        [req.auth.userId, hash, name, platform]
      );
    }
    await client.query("COMMIT");
    return hash;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};
