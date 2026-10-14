import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { open, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// No se coloca la URL ni la contraseña en argumentos, archivos o registros.
export function connectionEnvironment(value, environment = process.env) {
  if (!value) throw new Error('Configura DATABASE_URL en el entorno seguro antes de ejecutar el respaldo.');
  let url;
  try { url = new URL(value); } catch { throw new Error('DATABASE_URL no es válida.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error('DATABASE_URL debe identificar una base PostgreSQL.');
  }
  return {
    ...environment,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: url.searchParams.get('sslmode') || environment.PGSSLMODE || (environment.DB_SSL === 'true' ? 'require' : 'prefer'),
    PGCONNECT_TIMEOUT: '15'
  };
}

export async function backupDatabase(output, { environment = process.env, run = spawnSync } = {}) {
  if (!output) throw new Error('Indica una ruta nueva: npm run db:backup -- /ruta/privada/copia.dump');
  const destination = path.resolve(output);
  const childEnv = connectionEnvironment(environment.DATABASE_URL, environment);
  // wx evita sobrescribir un respaldo; 0600 limita acceso a datos privados.
  const file = await open(destination, 'wx', 0o600);
  let result;
  try {
    result = run('pg_dump', ['--format=custom', '--no-owner', '--no-acl'], {
      env: childEnv, stdio: ['ignore', file.fd, 'pipe'], timeout: 30 * 60 * 1000
    });
  } finally { await file.close(); }
  if (result.error || result.status !== 0) {
    throw new Error('No se completó el respaldo. Instala pg_dump compatible con el servidor y comprueba acceso. El archivo parcial NO es un respaldo válido.');
  }
  if ((await stat(destination)).size < 5) throw new Error('El respaldo está vacío.');
  await verifyBackup(destination, { run });
  return destination;
}

export async function verifyBackup(input, { run = spawnSync } = {}) {
  if (!input) throw new Error('Indica una copia .dump: npm run db:backup:verify -- /ruta/copia.dump');
  const source = path.resolve(input);
  const file = await open(source, 'r');
  try {
    const magic = Buffer.alloc(5);await file.read(magic, 0, 5, 0);
    if (magic.toString() !== 'PGDMP') throw new Error('El archivo no es un respaldo PostgreSQL en formato custom.');
  } finally { await file.close(); }
  const result = run('pg_restore', ['--list', source], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
  if (result.error || result.status !== 0) throw new Error('No se pudo leer el respaldo. Instala pg_restore y verifica que la copia sea válida.');
  return source;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const verify = process.argv[2] === '--verify';
    const output = verify ? await verifyBackup(process.argv[3]) : await backupDatabase(process.argv[2]);
    console.log(`${verify ? 'Archivo de respaldo legible' : 'Respaldo completo generado'}: ${output}`);
    console.log('La verificación de archivo no reemplaza una prueba de restauración en una base vacía.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
