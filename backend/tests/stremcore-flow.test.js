import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
process.env.NODE_ENV='test';process.env.ALLOW_HTTP_STREAMS='true';
process.env.JWT_SECRET=randomBytes(32).toString('hex');
const {pool}=await import('../src/database/db.js');
const {hashPassword}=await import('../src/services/auth.service.js');
const {default:app}=await import('../src/app.js');
const SOURCE='https://raw.githubusercontent.com/jexiptv07/stremcore/main/';
const film=id=>({id,titulo:`Película de prueba ${id}`,poster:'https://images.example.test/poster.jpg',overview:'Ficha ficticia para integración.',release_date:'2024-01-01',runtime:'81',genres:['drama'],servidores:[{id:1,nombre:'Ejemplo',url:'https://player.example.test/embed/demo',idioma:'Español'}]});

test('Stremcore integra panel, base de datos y catálogo Android sin ejecutar reproductores externos',async t=>{
  const db=new PGlite(),dir=new URL('../src/database/migrations/',import.meta.url);
  for(const file of(await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  const query=async(sql,params)=>{const result=await db.query(sql,params);return {...result,rowCount:result.affectedRows??result.rows.length};};
  const originalQuery=pool.query,originalConnect=pool.connect,originalFetch=globalThis.fetch;
  pool.query=query;pool.connect=async()=>({query,release(){}});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`,url=origin+'/api';
  let repositoryCalls=0;
  globalThis.fetch=async(input,options)=>{
    const target=String(input);
    if(target.startsWith(origin+'/'))return originalFetch(input,options);
    assert.ok(target.startsWith(SOURCE),'el backend no debe visitar los players de terceros');repositoryCalls++;
    const path=target.slice(SOURCE.length);let value;
    if(path==='meta.json')value={total_movies:3,total_series:1,movie_genres:[],series_genres:[]};
    else if(path==='pages/movies/all/1.json')value={page:1,total_pages:1,total:3,data:[film(11),film(12),film(13)]};
    else if(/^movies\/(11|12|13).json$/.test(path))value=film(Number(path.split('/')[1].split('.')[0]));
    else if(path==='series/22.json')value={id:22,titulo:'Serie de prueba',genres:['drama'],release_date:'2024-01-01'};
    else if(/^series\/22\/t[12].json$/.test(path))value={serie_id:22,number:Number(path.match(/t([12])/)[1]),episodios:[{number:1,titulo:'Primer episodio',servidores:[]},{number:2,titulo:'Segundo episodio',servidores:[]}]};
    else return new Response('',{status:404});
    return new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
  };
  t.after(async()=>{globalThis.fetch=originalFetch;await new Promise(resolve=>server.close(resolve));pool.query=originalQuery;pool.connect=originalConnect;await db.close();await pool.end();});
  const request=async(path,{token,body,method='GET'}={})=>{
    const response=await fetch(url+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
    return {status:response.status,...await response.json()};
  };
  const password=randomBytes(20).toString('hex'),tokens={};
  for(const role of ['admin','soporte','vendedor','cliente']){
    await query('INSERT INTO users(nombre,email,password_hash,rol) VALUES($1,$2,$3,$4)',[`Prueba ${role}`,`${role}@example.test`,await hashPassword(password),role]);
    tokens[role]=(await request('/auth/login',{method:'POST',body:{email:`${role}@example.test`,password}})).data.token;
  }
  const root='/admin/v2/content/import/stremcore';let movieId,seriesId;
  await t.test('solo administrador y soporte pueden explorar la fuente',async()=>{
    assert.equal((await request(root+'/meta')).status,401);
    for(const role of ['vendedor','cliente'])assert.equal((await request(root+'/meta',{token:tokens[role]})).status,403);
    for(const role of ['vendedor','cliente'])assert.equal((await request(root,{method:'POST',token:tokens[role],body:{type:'movies',id:'11',mode:'draft'}})).status,403);
    assert.equal(repositoryCalls,0);
    assert.equal((await request(root+'/meta',{token:tokens.soporte})).status,200);
    const page=await request(root+'/movies',{token:tokens.admin});assert.equal(page.data.items.length,3);assert.equal(page.data.items[0].existing,null);
    const detail=await request(root+'/movies/11',{token:tokens.admin});assert.equal(detail.data.servers[0].direct,false);
  });
  await t.test('un borrador sin fuente no se publica ni permite reproducción',async()=>{
    const result=await request(root,{method:'POST',token:tokens.admin,body:{type:'movies',id:'11',mode:'draft'}});
    assert.equal(result.status,201);assert.equal(result.data.active,false);movieId=result.data.id;
    const catalog=await request('/catalog/channels?kind=movie',{token:tokens.admin});assert.equal(catalog.data.items.length,0);
    assert.equal((await request(`/playback/session/movie:${movieId}`,{token:tokens.admin})).status,404);
    const detail=await request(root+'/movies/11',{token:tokens.admin});assert.equal(String(detail.data.existing.id),String(movieId));
  });
  await t.test('rechaza HTML, direcciones privadas y publicaciones sin fuente sin crear registros',async()=>{
    for(const manifestUrl of ['', 'https://player.example.test/embed/demo','http://127.0.0.1/demo.mp4']){
      const result=await request(root,{method:'POST',token:tokens.admin,body:{type:'movies',id:'12',mode:'publish',manifestUrl}});
      assert.equal(result.status,400);
    }
    assert.equal((await query("SELECT COUNT(*)::INT AS n FROM movies WHERE source_content_id='12'")).rows[0].n,0);
  });
  await t.test('una película publicada pasa al catálogo y a la sesión de Media3',async()=>{
    const result=await request(root,{method:'POST',token:tokens.soporte,body:{type:'movies',id:'12',mode:'publish',manifestUrl:'https://8.8.8.8/demo.mp4'}});
    assert.equal(result.status,201);
    const catalog=await request('/catalog/channels?kind=movie',{token:tokens.admin});assert.equal(catalog.data.items.length,1);
    assert.equal(catalog.data.items[0].groupId,`movie:${result.data.id}`);
    const playback=await request(`/playback/session/movie:${result.data.id}`,{token:tokens.admin});assert.equal(playback.data.manifestUrl,'https://8.8.8.8/demo.mp4');
  });
  await t.test('reimportar conserva modificaciones y borrar permite importar otra vez',async()=>{
    await query('UPDATE movies SET titulo=$1 WHERE id=$2',['Nombre editado',movieId]);
    const repeated=await request(root,{method:'POST',token:tokens.admin,body:{type:'movies',id:'11',mode:'draft'}});
    assert.equal(repeated.status,200);assert.equal(repeated.data.created,false);
    assert.equal((await query('SELECT titulo FROM movies WHERE id=$1',[movieId])).rows[0].titulo,'Nombre editado');
    await request(`/admin/v2/content/movies/${movieId}`,{method:'DELETE',token:tokens.admin});
    const deletedPreview=await request(root+'/movies',{token:tokens.admin});assert.equal(deletedPreview.data.items.find(item=>item.id==='11').existing,null);
    const again=await request(root,{method:'POST',token:tokens.admin,body:{type:'movies',id:'11',mode:'draft'}});assert.equal(again.status,201);assert.equal(again.data.created,true);
  });
  await t.test('valida todos los episodios antes de guardar la serie y permite un borrador completo',async()=>{
    const invalid=await request(root,{method:'POST',token:tokens.admin,body:{type:'series',id:'22',mode:'publish',season:1,episodeNumbers:[1,2],episodeUrls:{1:'https://8.8.8.8/one.mp4'}}});
    assert.equal(invalid.status,400);assert.equal((await query('SELECT COUNT(*)::INT AS n FROM series')).rows[0].n,0);
    const draft=await request(root,{method:'POST',token:tokens.admin,body:{type:'series',id:'22',mode:'draft',season:1,episodeNumbers:[1,2]}});
    assert.equal(draft.status,201);assert.equal(draft.data.episodesImported,2);seriesId=draft.data.id;
    const repeat=await request(root,{method:'POST',token:tokens.admin,body:{type:'series',id:'22',mode:'draft',season:1,episodeNumbers:[1,2]}});
    assert.equal(repeat.status,200);assert.equal(repeat.data.episodesExisting,2);
  });
  await t.test('agrega una temporada nueva conservando la serie editada y solo muestra episodios activos',async()=>{
    await query('UPDATE series SET titulo=$1 WHERE id=$2',['Serie personalizada',seriesId]);
    const result=await request(root,{method:'POST',token:tokens.admin,body:{type:'series',id:'22',mode:'publish',season:2,episodeNumbers:[1],episodeUrls:{1:'https://8.8.8.8/new.m3u8'}}});
    assert.equal(result.status,201);assert.equal(result.data.created,false);assert.equal(result.data.episodesImported,1);
    assert.equal((await query('SELECT titulo FROM series WHERE id=$1',[seriesId])).rows[0].titulo,'Serie personalizada');
    const episodes=await request(`/catalog/series/${seriesId}/episodes`,{token:tokens.admin});assert.equal(episodes.data.items.length,1);
    const playback=await request(`/playback/session/${episodes.data.items[0].groupId}`,{token:tokens.admin});assert.equal(playback.data.manifestUrl,'https://8.8.8.8/new.m3u8');
    const preview=await request(root+'/series/22/seasons/1',{token:tokens.admin});assert.ok(preview.data.episodes.every(e=>e.existing));
    assert.equal((await request(root+'/series/22/seasons/99',{token:tokens.admin})).status,404);
  });
});
