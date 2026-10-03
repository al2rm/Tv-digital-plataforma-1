import { Router } from 'express';
import { pool } from '../database/db.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { env } from '../config/env.js';
import { assertPublicChannelUrl } from '../services/iptvOrg.service.js';
import {
 buildXtreamStreamUrl,
 signXtreamPlayback,
 verifyXtreamPlayback
} from '../services/xtream.service.js';

const router = Router();
const fail = (message,statusCode=400) => Object.assign(new Error(message),{statusCode});
router.get('/xtream/stream/:channelId.:extension',async(req,res,next)=>{
 try {
  if(!['ts','m3u8'].includes(req.params.extension))throw fail('Formato Xtream inválido');
  verifyXtreamPlayback(req.query.token,req.params.channelId);
  const result=await pool.query(`SELECT c.xtream_stream_id,p.base_url,p.username_encrypted,p.password_encrypted
   FROM live_channels c JOIN xtream_providers p ON p.id=c.xtream_provider_id
   WHERE c.id=$1 AND c.activo AND p.activo`,[req.params.channelId]);
  const channel=result.rows[0];
  if(!channel)throw fail('Canal Xtream no disponible',404);
  const target=buildXtreamStreamUrl(channel,Number(channel.xtream_stream_id),req.params.extension);
  await assertPublicChannelUrl(target,{allowHttp:env.allowHttpStreams});
  res.set('Cache-Control','no-store').redirect(302,target);
 }catch(e){next(e);}
});
router.use(['/app','/catalog','/playback'],authMiddleware);
const catalogSql = `SELECT 'channel:' || c.id AS "groupId", c.nombre AS name,
 COALESCE(k.nombre,'TV en vivo') AS category, COALESCE(c.logo_url,'') AS logo,
 COALESCE(c.logo_url,'') AS "squareLogo", 'channel' AS kind
 FROM live_channels c LEFT JOIN categories k ON k.id=c.category_id
 WHERE c.activo AND (k.id IS NULL OR k.activo)
 UNION ALL
 SELECT 'movie:' || c.id, c.titulo, COALESCE(k.nombre,'Películas'),
 COALESCE(c.poster_url,''), COALESCE(c.poster_url,''), 'movie'
 FROM movies c LEFT JOIN categories k ON k.id=c.category_id
 WHERE c.activo AND (k.id IS NULL OR k.activo)`;
const activeSubscription = async userId => (await pool.query(`SELECT s.id,p.nombre AS plan,
 TO_CHAR(s.fecha_fin,'YYYY-MM-DD') AS vencimiento FROM subscriptions s JOIN plans p ON p.id=s.plan_id
 WHERE s.user_id=$1 AND s.estado='activa'
 AND s.fecha_inicio <= (NOW() AT TIME ZONE 'America/Asuncion')::date
 AND s.fecha_fin >= (NOW() AT TIME ZONE 'America/Asuncion')::date
 ORDER BY s.fecha_fin DESC LIMIT 1`,[userId])).rows[0] || null;
router.get('/app/account', async (req,res,next) => {
 try {
  const result=await pool.query('SELECT id,nombre,email FROM users WHERE id=$1',[req.auth.userId]);
  const subscription=await activeSubscription(req.auth.userId);
  res.json({ok:true,data:{user:result.rows[0],subscription,canPlay:req.auth.rol==='admin'||Boolean(subscription),provider:{name:'LumixTV',mode:'manual',connected:false}}});
 } catch(e){next(e);}
});
router.get('/catalog/categories',async(req,res,next)=>{
 try { const result=await pool.query(`SELECT category AS name,COUNT(*)::int AS "channelCount" FROM (${catalogSql}) catalog GROUP BY category ORDER BY category`);res.json({ok:true,data:result.rows}); }catch(e){next(e);}
});
router.get('/catalog/channels',async(req,res,next)=>{
 try {
  const limit=Math.min(100,Math.max(1,parseInt(req.query.limit,10)||50));
  const offset=Math.max(0,parseInt(req.query.offset,10)||0);
  const category=String(req.query.category||'').slice(0,120), search=String(req.query.search||'').slice(0,200);
  const kind=['channel','movie'].includes(req.query.kind)?req.query.kind:'';
  const filter=`FROM (${catalogSql}) catalog WHERE ($1='' OR category=$1) AND name ILIKE $2 AND ($3='' OR kind=$3)`;
  const params=[category,`%${search}%`,kind];
  const result=await pool.query(`SELECT * ${filter} ORDER BY name,"groupId" LIMIT $4 OFFSET $5`,[...params,limit,offset]);
  const count=await pool.query(`SELECT COUNT(*)::int AS total ${filter}`,params);
  const total=count.rows[0].total;
  res.json({ok:true,data:{items:result.rows,pagination:{total,offset,limit,hasMore:offset+result.rows.length<total}}});
 }catch(e){next(e);}
});
router.get('/playback/session/:contentId',async(req,res,next)=>{
 try {
  if(req.auth.rol!=='admin' && !await activeSubscription(req.auth.userId)) throw fail('Tu suscripción no está activa. Contacta a tu proveedor para renovarla.',403);
  const match=/^(channel|movie):([1-9][0-9]{0,14})$/.exec(req.params.contentId);
  if(!match) throw fail('Contenido inválido');
  const table=match[1]==='channel'?'live_channels':'movies';
  const providerColumns=table==='live_channels'?`,c.xtream_provider_id,c.xtream_stream_id,c.xtream_container,
   p.base_url,p.username_encrypted,p.password_encrypted`:'';
  const providerJoin=table==='live_channels'?' LEFT JOIN xtream_providers p ON p.id=c.xtream_provider_id AND p.activo':'';
  const result=await pool.query(`SELECT c.manifest_url,c.license_url,c.drm_type,c.stream_headers${providerColumns}
   FROM ${table} c LEFT JOIN categories k ON k.id=c.category_id${providerJoin}
   WHERE c.id=$1 AND c.activo AND (k.id IS NULL OR k.activo)`,[match[2]]);
  const content=result.rows[0];
  if(!content) throw fail('Contenido no disponible',404);
  let manifest,mimeType;
  if(content.xtream_provider_id&&content.xtream_stream_id){
   if(!content.base_url)throw fail('El proveedor Xtream está inactivo',409);
   const token=signXtreamPlayback({channelId:match[2],userId:req.auth.userId});
   const origin=(env.publicBaseUrl||`${req.protocol}://${req.get('host')}`).replace(/\/$/,'');
   manifest=`${origin}/api/xtream/stream/${match[2]}.ts?token=${encodeURIComponent(token)}`;
   mimeType=null;
  }else{
   if(!content.manifest_url) throw fail('Este contenido todavía no tiene una fuente de reproducción configurada.',409);
   manifest=validMediaUrl(content.manifest_url,env.allowHttpStreams);
   mimeType=manifest.split('?')[0].endsWith('.mpd')?'application/dash+xml':manifest.split('?')[0].endsWith('.m3u8')?'application/x-mpegURL':null;
  }
  const license=content.drm_type==='widevine'?validMediaUrl(content.license_url,false):null;
  res.json({ok:true,data:{contentId:req.params.contentId,manifestUrl:manifest,
   mimeType,
   streamHeaders:validStreamHeaders(content.stream_headers),drm:license?{scheme:'widevine',licenseUrl:license,licenseHeaders:{}}:null}});
 }catch(e){next(e);}
});
function validMediaUrl(value,allowHttp=false){
 try {const url=new URL(value);if(!(url.protocol==='https:'||(allowHttp&&url.protocol==='http:'))||url.username||url.password)throw new Error();return url.href;}
 catch {throw fail(`La fuente debe tener una URL ${allowHttp?'HTTP o HTTPS':'HTTPS'} válida.`,409);}
}
function validStreamHeaders(value){
 const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 return Object.fromEntries(Object.entries(source).filter(([key,item])=>['Referer','User-Agent'].includes(key)&&typeof item==='string'&&item.length<=300));
}
export default router;
