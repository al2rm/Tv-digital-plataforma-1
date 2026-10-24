import test from 'node:test';
import assert from 'node:assert/strict';
import { createStremcoreClient, isDirectStremcoreMedia, stremcoreId, STREMCORE_BASE_URL } from '../src/services/stremcore.service.js';

const json = value => new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
const meta = {total_movies:2,total_series:1,movie_genres:[{slug:'accion',label:'Acción',total:2}],series_genres:[]};
const item = {id:17,titulo:'Película de prueba',poster:'https://images.example.test/poster.jpg',release_date:'2024-01-01',genres:['accion']};

test('Stremcore limita las rutas al catálogo configurado y valida los identificadores',async()=>{
  const paths=[];
  const client=createStremcoreClient({fetchImpl:async(url,options)=>{paths.push(url);assert.equal(options.redirect,'error');return json({page:2,total_pages:3,total:90,data:[item]});}});
  assert.equal((await client.list('movies',{genre:'accion',page:2})).items[0].id,'17');
  assert.deepEqual(paths,[`${STREMCORE_BASE_URL}/pages/movies/accion/2.json`]);
  for(const id of ['../meta','https://other.test','0','17?x=1',Number.MAX_SAFE_INTEGER+1])assert.throws(()=>stremcoreId(id));
  await assert.rejects(client.list('users'),{statusCode:400});
  await assert.rejects(client.list('movies',{genre:'../../state'}),{statusCode:400});
  await assert.rejects(client.season('17','../1'),{statusCode:400});
  assert.equal(paths.length,1);
});
test('Stremcore distingue vídeos directos, páginas embed y URLs no válidas',()=>{
  assert.equal(isDirectStremcoreMedia('https://video.example.test/demo.m3u8?token=example'),true);
  assert.equal(isDirectStremcoreMedia('https://video.example.test/demo.MP4'),true);
  assert.equal(isDirectStremcoreMedia('http://video.example.test/demo.mp4'),false);
  assert.equal(isDirectStremcoreMedia('http://video.example.test/demo.mp4',true),true);
  for(const url of ['https://player.example.test/e/video','https://player.example.test/embed/a','javascript:alert(1)','https://user:password@example.test/demo.mp4'])assert.equal(isDirectStremcoreMedia(url,true),false);
});
test('el cliente comparte solicitudes simultáneas y renueva la caché caducada',async()=>{
  let calls=0,clock=0;
  const client=createStremcoreClient({now:()=>clock,ttl:50,fetchImpl:async()=>{calls++;return json(meta);}});
  await Promise.all([client.meta(),client.meta(),client.meta()]);assert.equal(calls,1);
  clock=20;await client.meta();assert.equal(calls,1);
  clock=51;await client.meta();assert.equal(calls,2);
});
test('una respuesta fallida no queda almacenada y una temporada ausente conserva el 404',async()=>{
  let calls=0;
  const client=createStremcoreClient({fetchImpl:async()=>++calls===1?new Response('not found',{status:404}):json(meta)});
  await assert.rejects(client.meta(),{statusCode:404});
  assert.equal((await client.meta()).movies,2);assert.equal(calls,2);
  const missing=createStremcoreClient({fetchImpl:async()=>new Response('',{status:404})});
  await assert.rejects(missing.season('17',9),{statusCode:404});
});
test('limita el tamaño del cuerpo aunque el servidor omita Content-Length',async()=>{
  let cancelled=false;
  const client=createStremcoreClient({fetchImpl:async()=>new Response(new ReadableStream({
    start(controller){for(let i=0;i<3;i++)controller.enqueue(new Uint8Array(1024*1024));},
    cancel(){cancelled=true;}
  }))});
  await assert.rejects(client.meta(),/2 MB/);assert.equal(cancelled,true);
});
test('busca por título en varios bloques, ignora acentos y evita resultados duplicados',async()=>{
  const client=createStremcoreClient({fetchImpl:async url=>{
    if(url.endsWith('/1.json'))return json({total_chunks:2,data:[{id:1,t:'Corazón de prueba',to:'',g:['drama']}]});
    return json({total_chunks:2,data:[{id:1,t:'Corazón de prueba',g:['drama']},{id:2,t:'Otro título',to:'Corazon original',g:['comedia']}]});
  }});
  const result=await client.list('movies',{q:'corazon'});assert.equal(result.total,2);
  assert.equal((await client.list('movies',{q:'corazon',genre:'drama'})).total,1);
});
test('comprueba que las fichas y temporadas coincidan con el ID pedido',async()=>{
  const client=createStremcoreClient({fetchImpl:async url=>url.includes('/movies/')?json({...item,id:18}):json({serie_id:17,number:1,episodios:[{number:1,titulo:'Uno'},{number:1,titulo:'Duplicado'}]})});
  await assert.rejects(client.detail('movies',17),/no coincide/);
  await assert.rejects(client.season(17,1),/repetidos/);
});
test('acota búsquedas amplias a 500 fichas y mantiene la paginación',async()=>{
  const data=Array.from({length:501},(_,i)=>({id:i+1,t:`Película ${String(i+1).padStart(4,'0')}`}));
  const client=createStremcoreClient({fetchImpl:async()=>json({total_chunks:1,data})});
  const page=await client.list('movies',{q:'pelicula',page:13});
  assert.equal(page.total,500);assert.equal(page.totalPages,13);assert.equal(page.items.length,20);assert.equal(page.truncated,true);
  assert.equal(page.items.at(-1).id,'500');
});
test('rechaza JSON de forma incorrecta y omite campos externos inválidos',async()=>{
  for(const value of [null,[],0,'html']){
    const client=createStremcoreClient({fetchImpl:async()=>json(value)});
    await assert.rejects(client.meta(),{statusCode:502});
  }
  const client=createStremcoreClient({fetchImpl:async()=>json({...item,poster:'https://example.test/'+'x'.repeat(4096),servidores:[null]})});
  const detail=await client.detail('movies','17');assert.equal(detail.poster,null);assert.deepEqual(detail.servers,[]);
});
