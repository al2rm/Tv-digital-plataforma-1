import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeSync } from 'node:fs';
import { backupDatabase, connectionEnvironment, verifyBackup } from '../scripts/database-backup.js';

test('respaldo no coloca credenciales en argumentos y respeta SSL',()=>{
  const env=connectionEnvironment('postgresql://usuario:pass%40word@db.test:5433/tv?sslmode=verify-full',{});
  assert.equal(env.PGPASSWORD,'pass@word');assert.equal(env.PGPORT,'5433');assert.equal(env.PGSSLMODE,'verify-full');
  assert.throws(()=>connectionEnvironment('https://invalid.test/db'),/PostgreSQL/);
  assert.throws(()=>connectionEnvironment(''),/DATABASE_URL/);
});
test('respaldo es privado, verificado y nunca sobreescribe una copia',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'tv-backup-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const output=path.join(dir,'database.dump');let calls=0;
  const run=(name,args,options)=>{
    calls++;assert.equal(args.some(a=>a.includes('password')),false);
    if(name==='pg_dump')writeSync(options.stdio[1],Buffer.from('PGDMPfixture'));
    else assert.equal(name,'pg_restore');
    return {status:0};
  };
  await backupDatabase(output,{environment:{DATABASE_URL:'postgres://user:password@db.test/tv'},run});
  assert.equal((await stat(output)).mode&0o777,0o600);assert.equal(calls,2);
  await assert.rejects(backupDatabase(output,{environment:{DATABASE_URL:'postgres://user:password@db.test/tv'},run}),/EEXIST/);
  assert.equal((await readFile(output)).toString(),'PGDMPfixture');
});
test('verificación rechaza un JSON de exportación y respaldos inválidos',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'tv-backup-invalid-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const output=path.join(dir,'database.dump');await writeFile(output,'{"version":1}');
  await assert.rejects(verifyBackup(output),/formato custom/);
  await writeFile(output,'PGDMPinvalid');
  await assert.rejects(verifyBackup(output,{run:()=>({status:1})}),/No se pudo leer/);
});
