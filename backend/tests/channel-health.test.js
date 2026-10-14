import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDirectChannel } from '../src/controllers/adminChannelHealth.controller.js';

test('diagnóstico no confunde ausencia de fuente con disponibilidad', async()=>{
  const result=await checkDirectChannel({},()=>{throw new Error('No debe consultar');});
  assert.equal(result.status,'failed');
});
test('diagnóstico intenta respaldo después de falla principal y conserva cabeceras', async()=>{
  const calls=[];
  const result=await checkDirectChannel({manifest_url:'https://primary.test/live.m3u8',fallback_manifest_url:'https://backup.test/live.m3u8',stream_headers:{Referer:'https://portal.test/'}},async source=>{
    calls.push(source);return {available:calls.length===2,reason:'HTTP 404'};
  });
  assert.equal(result.status,'fallback');assert.equal(calls.length,2);
  assert.equal(calls[1].headers.Referer,'https://portal.test/');
});
test('diagnóstico no consulta respaldo si el principal es válido',async()=>{
  let calls=0;
  const result=await checkDirectChannel({manifest_url:'https://primary.test/live.m3u8',fallback_manifest_url:'https://backup.test/live.m3u8'},async()=>{calls++;return {available:true};});
  assert.equal(result.status,'ok');assert.equal(calls,1);
});
test('diagnóstico conserva causas de ambas fallas',async()=>{
  const result=await checkDirectChannel({manifest_url:'https://primary.test/live.m3u8',fallback_manifest_url:'https://backup.test/live.m3u8'},async()=>({available:false,reason:'HTTP 403'}));
  assert.equal(result.status,'failed');assert.match(result.error,/principal: HTTP 403/);assert.match(result.error,/alternativa: HTTP 403/);
});
