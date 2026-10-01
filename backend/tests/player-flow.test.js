import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
process.env.NODE_ENV='test';
const {pool}=await import('../src/database/db.js');
const {hashPassword}=await import('../src/services/auth.service.js');
const {default:app}=await import('../src/app.js');

test('flujo real panel → acceso Android → catálogo → suscripción y controles', async t=>{
 const db=new PGlite();
 const dir=new URL('../src/database/migrations/',import.meta.url);
 for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(f,dir),'utf8'));
 const query=async(sql,params)=>{const r=await db.query(sql,params);return {...r,rowCount:r.affectedRows??r.rows.length};};
 const originalQuery=pool.query,originalConnect=pool.connect;
 pool.query=query;pool.connect=async()=>({query,release(){}});
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 t.after(async()=>{await new Promise(r=>server.close(r));pool.query=originalQuery;pool.connect=originalConnect;await db.close();await pool.end();});
 const url=`http://127.0.0.1:${server.address().port}/api`;
 const request=async(path,{method='GET',token,body}={})=>{
  const r=await fetch(url+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
  return {status:r.status,...await r.json()};
 };
 const password='Prueba-integracion-2026';
 await query(`INSERT INTO users(nombre,email,password_hash,rol) VALUES('Admin prueba','admin@example.test',$1,'admin')`,[await hashPassword(password)]);
 const admin=(await request('/auth/login',{method:'POST',body:{email:'admin@example.test',password}})).data.token;
 let client,user,content,category,subscription;
 await t.test('el admin crea un cliente y el cliente inicia sesión',async()=>{
  const result=await request('/admin/v2/users',{method:'POST',token:admin,body:{nombre:'Cliente prueba',email:'cliente@example.test',password}});
  assert.equal(result.status,201);user=result.data;
  const bad=await request('/auth/login',{method:'POST',body:{email:user.email,password:'incorrecta'}});assert.equal(bad.status,401);
  client=(await request('/auth/login',{method:'POST',body:{email:user.email,password}})).data.token;
  assert.ok(client);
 });
 await t.test('el admin previsualiza e importa Paraguay con cabeceras de reproducción',async()=>{
  const originalFetch=globalThis.fetch;
  const playlist=`#EXTM3U\n#EXTINF:-1 tvg-id="NPY.py",NPY prueba\n#EXTVLCOPT:http-referrer=https://www.npy.com.py/\nhttps://8.8.8.8/npy/playlist.m3u8`;
  globalThis.fetch=async(input,options={})=>{
   const target=String(input);
   if(target==='https://iptv-org.github.io/api/countries.json')return new Response(JSON.stringify([{name:'Paraguay',code:'PY',flag:'🇵🇾'},{name:'Argentina',code:'AR',flag:'🇦🇷'}]),{status:200,headers:{'Content-Type':'application/json'}});
   if(target==='https://iptv-org.github.io/iptv/countries/py.m3u')return new Response(playlist,{status:200,headers:{'Content-Type':'audio/x-mpegurl'}});
   if(target==='https://iptv-org.github.io/iptv/countries/ar.m3u')return new Response('#EXTM3U\n#EXTINF:-1 tvg-id="AR.test",Señal Argentina\nhttps://8.8.4.4/ar/playlist.m3u8',{status:200,headers:{'Content-Type':'audio/x-mpegurl'}});
   if(target==='https://8.8.8.8/npy/playlist.m3u8')return new Response('#EXTM3U\n#EXT-X-TARGETDURATION:6\nsegment-1.ts',{status:200,headers:{'Content-Type':'application/vnd.apple.mpegurl'}});
   return originalFetch(input,options);
  };
  try{
   const countries=await request('/admin/v2/content/import/iptv-org/countries',{token:admin});
   assert.equal(countries.status,200);assert.equal(countries.data.some(country=>country.code==='py'),true);
   const argentina=await request('/admin/v2/content/import/iptv-org/ar/preview',{token:admin});
   assert.equal(argentina.status,200);assert.equal(argentina.data.country.code,'ar');
   const preview=await request('/admin/v2/content/import/iptv-org/py/preview',{token:admin});
   assert.equal(preview.status,200);assert.equal(preview.data.summary.importable,1);
   const imported=await request('/admin/v2/content/import/iptv-org/py',{method:'POST',token:admin,body:{sourceIds:[preview.data.items[0].sourceId]}});
   assert.equal(imported.status,201);assert.equal(imported.data.imported.length,1);
   const session=await request(`/playback/session/channel:${imported.data.imported[0].id}`,{token:admin});
   assert.equal(session.status,200);assert.equal(session.data.streamHeaders.Referer,'https://www.npy.com.py/');
   const repeated=await request('/admin/v2/content/import/iptv-org/py/preview',{token:admin});
   assert.equal(repeated.data.summary.existing,1);
  }finally{globalThis.fetch=originalFetch;}
 });
 await t.test('el cliente no puede administrar ni ver fuentes en el catálogo',async()=>{
  assert.equal((await request('/admin/v2/users',{token:client})).status,403);
  category=(await request('/admin/v2/content/categories',{method:'POST',token:admin,body:{nombre:'Pruebas',slug:'pruebas'}})).data;
  content=(await request('/admin/v2/content/live_channels',{method:'POST',token:admin,body:{nombre:'Canal autorizado de prueba',category_id:category.id,manifest_url:'https://example.test/demo.m3u8',activo:true}})).data;
  const catalog=await request('/catalog/channels',{token:client});assert.equal(catalog.status,200);
  assert.equal(catalog.data.items[0].groupId,`channel:${content.id}`);assert.equal(JSON.stringify(catalog.data).includes('manifest_url'),false);
  assert.equal((await request('/catalog/channels')).status,401);
  assert.equal((await request(`/playback/session/channel:${content.id}`,{token:client})).status,403);
 });
 await t.test('suscripción activa permite reproducir y devuelve estado de cuenta',async()=>{
  const date=(await query("SELECT TO_CHAR(NOW() AT TIME ZONE 'America/Asuncion','YYYY-MM-DD') AS date")).rows[0].date;
  const result=await request('/admin/v2/subscriptions',{method:'POST',token:admin,body:{userId:user.id,planId:1,fechaInicio:date}});
  assert.equal(result.status,201);subscription=result.data.subscription;
  assert.equal((await request('/app/account',{token:client})).data.canPlay,true);
  const playback=await request(`/playback/session/channel:${content.id}`,{token:client});assert.equal(playback.status,200);assert.equal(playback.data.manifestUrl,'https://example.test/demo.m3u8');
 });
 await t.test('HTTPS, DRM y ocultación se validan',async()=>{
  const invalid=await request('/admin/v2/content/movies',{method:'POST',token:admin,body:{titulo:'Invalid',manifest_url:'http://example.test/video.mp4'}});assert.equal(invalid.status,400);
  const missingLicense=await request('/admin/v2/content/movies',{method:'POST',token:admin,body:{titulo:'DRM',drm_type:'widevine'}});assert.equal(missingLicense.status,400);
  assert.equal((await request(`/admin/v2/content/live_channels/${content.id}`,{method:'PUT',token:admin,body:{nombre:'Canal actualizado',activo:false}})).status,200);
  assert.equal((await request(`/playback/session/channel:${content.id}`,{token:client})).status,404);
  await request(`/admin/v2/content/live_channels/${content.id}`,{method:'PUT',token:admin,body:{nombre:'Canal actualizado',activo:true}});
  await request(`/admin/v2/content/categories/${category.id}`,{method:'PUT',token:admin,body:{nombre:'Pruebas',slug:'pruebas',activo:false}});
  assert.equal((await request('/catalog/channels',{token:client})).data.items.some(item=>item.groupId===`channel:${content.id}`),false);
  assert.equal((await request(`/playback/session/channel:${content.id}`,{token:client})).status,404);
  await request(`/admin/v2/content/categories/${category.id}`,{method:'PUT',token:admin,body:{nombre:'Pruebas',slug:'pruebas',activo:true}});
 });
 await t.test('vencimiento y fecha futura bloquean nuevas reproducciones',async()=>{
  await query("UPDATE subscriptions SET fecha_inicio=(NOW() AT TIME ZONE 'America/Asuncion')::date-50,fecha_fin=(NOW() AT TIME ZONE 'America/Asuncion')::date-1 WHERE id=$1",[subscription.id]);
  assert.equal((await request(`/playback/session/channel:${content.id}`,{token:client})).status,403);
  await query("UPDATE subscriptions SET fecha_inicio=(NOW() AT TIME ZONE 'America/Asuncion')::date+5,fecha_fin=(NOW() AT TIME ZONE 'America/Asuncion')::date+35 WHERE id=$1",[subscription.id]);
  assert.equal((await request('/app/account',{token:client})).data.canPlay,false);
  await query("UPDATE subscriptions SET fecha_inicio=(NOW() AT TIME ZONE 'America/Asuncion')::date-1,fecha_fin=(NOW() AT TIME ZONE 'America/Asuncion')::date+20 WHERE id=$1",[subscription.id]);
 });
 await t.test('un error al guardar un cobro revierte la renovación',async()=>{
  const before=(await query('SELECT fecha_fin::text FROM subscriptions WHERE id=$1',[subscription.id])).rows[0].fecha_fin;
  const failed=await request(`/admin/v2/subscriptions/${subscription.id}/renew`,{method:'POST',token:admin,body:{monto:30000,metodo:'x'.repeat(100)}});
  assert.equal(failed.status,500);
  const after=(await query('SELECT fecha_fin::text FROM subscriptions WHERE id=$1',[subscription.id])).rows[0].fecha_fin;
  assert.equal(after,before);
  assert.equal((await request(`/admin/v2/subscriptions/${subscription.id}/renew`,{method:'POST',token:admin,body:{monto:-1}})).status,400);
  const renewed=await request(`/admin/v2/subscriptions/${subscription.id}/renew`,{method:'POST',token:admin,body:{monto:30000,metodo:'transferencia'}});
  assert.equal(renewed.status,200);
  assert.equal((await request('/admin/v2/payments',{token:admin})).data.length,1);
 });
 await t.test('registra cobros independientes y precios, rechaza monto cero',async()=>{
  assert.equal((await request('/admin/v2/payments',{method:'POST',token:admin,body:{userId:user.id,monto:0}})).status,400);
  assert.equal((await request('/admin/v2/payments',{method:'POST',token:admin,body:{userId:user.id,monto:30000}})).status,201);
  const price=await request('/admin/v2/plans/1',{method:'PUT',token:admin,body:{precio:30000}});assert.equal(price.status,200);assert.equal(Number(price.data.precio),30000);
 });
 await t.test('bloqueo y cambio de rol se aplican incluso con token previo',async()=>{
  await request(`/admin/v2/users/${user.id}`,{method:'PUT',token:admin,body:{estado:'bloqueado'}});
  assert.equal((await request('/catalog/channels',{token:client})).status,401);
  await query("UPDATE users SET rol='cliente' WHERE email='admin@example.test'");
  assert.equal((await request('/admin/v2/users',{token:admin})).status,403);
 });
});
