import { pool } from "../src/database/db.js";
import { hashPassword } from "../src/services/auth.service.js";

const nombre = String(process.env.ADMIN_NAME || "Administrador").trim();
const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || "");

try {
  if (!email || password.length < 8) {
    throw new Error(
      "Configura ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 8 caracteres) en .env"
    );
  }

  const passwordHash = await hashPassword(password);
  await pool.query(
    `INSERT INTO users(nombre, email, password_hash, rol, estado)
     VALUES($1, $2, $3, 'admin', 'activo')
     ON CONFLICT(email) DO UPDATE SET
       nombre = EXCLUDED.nombre,
       password_hash = EXCLUDED.password_hash,
       rol = 'admin',
       estado = 'activo',
       fecha_actualizacion = NOW()`,
    [nombre, email, passwordHash]
  );
  console.log(`Administrador listo: ${email}`);
} catch (error) {
  console.error("No se pudo crear el administrador:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
