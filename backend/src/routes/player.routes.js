import { Router } from 'express';
import { pool } from '../database/db.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { env } from '../config/env.js';
import { assertPublicChannelUrl } from '../services/iptvOrg.service.js';
import { verifyPassword } from '../services/auth.service.js';
import { registerRequestDevice } from '../services/device.service.js';
import {
 buildXtreamStreamUrl,
 preferredXtreamContainer,
 providerPlaybackHeaders,
 signXtreamPlayback,
 verifyXtreamPlayback
} from '../services/xtream.service.js';

const router = Router();
const fail = (message,statusCode=400) => Object.assign(new Error(message),{statusCode});
router.get('/xtream/stream/:channelId.:extension',async(req,res,next)=>{
 try {
  if(!['ts','m3u8'].includes(req.params.extension))throw fail('Formato Xtream inválido');
  verifyXtreamPlayback(req.query.token,req.params.channelId);
  const result=await pool.query(`SELECT c.xtream_stream_id,p.base_url,p.username_encrypted,p.password_encrypted,
   p.user_agent,p.referer,p.preferred_output
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
router.use(['/app','/catalog'],(req,res,next)=>{
 res.set('Cache-Control','private, no-store, max-age=0');
 res.set('Pragma','no-cache');
 next();
});
const catalogSql = `SELECT 'channel:' || c.id AS "groupId", c.nombre AS name,
 COALESCE(k.nombre,'TV en vivo') AS category, COALESCE(c.logo_url,'') AS logo,
 COALESCE(c.logo_url,'') AS "squareLogo", 'channel' AS kind,
 (c.parental_rating>=18) AS restricted,
 COALESCE((SELECT e.titulo FROM epg_programs e WHERE e.channel_id=c.id AND e.starts_at<=NOW() AND e.ends_at>NOW() ORDER BY e.starts_at DESC LIMIT 1),'') AS "epgNow",
 COALESCE((SELECT e.titulo FROM epg_programs e WHERE e.channel_id=c.id AND e.starts_at>NOW() ORDER BY e.starts_at LIMIT 1),'') AS "epgNext"
 FROM live_channels c LEFT JOIN categories k ON k.id=c.category_id
 WHERE c.activo AND (k.id IS NULL OR k.activo)
 UNION ALL
 SELECT 'movie:' || c.id, c.titulo, COALESCE(k.nombre,'Películas'),
 COALESCE(c.poster_url,''), COALESCE(c.poster_url,''), 'movie',(c.parental_rating>=18),'',''
 FROM movies c LEFT JOIN categories k ON k.id=c.category_id
 WHERE c.activo AND (k.id IS NULL OR k.activo)
 UNION ALL
 SELECT 'series:' || c.id,c.titulo,COALESCE(k.nombre,'Series'),
 COALESCE(c.poster_url,''),COALESCE(c.poster_url,''),'series',(c.parental_rating>=18),'',''
 FROM series c LEFT JOIN categories k ON k.id=c.category_id
 WHERE c.activo AND (k.id IS NULL OR k.activo)`;
const activeSubscription = async userId => {
 const trial=(await pool.query(`SELECT access_expires_at FROM users
  WHERE id=$1 AND is_demo AND access_expires_at>NOW()`,[userId])).rows[0];
 if(trial)return {id:null,plan:'Demo',vencimiento:new Date(trial.access_expires_at).toISOString(),isDemo:true};
 return (await pool.query(`SELECT s.id,p.nombre AS plan,
 TO_CHAR(s.fecha_fin,'YYYY-MM-DD') AS vencimiento FROM subscriptions s JOIN plans p ON p.id=s.plan_id
 WHERE s.user_id=$1 AND s.estado='activa'
 AND s.fecha_inicio <= (NOW() AT TIME ZONE 'America/Asuncion')::date
 AND s.fecha_fin >= (NOW() AT TIME ZONE 'America/Asuncion')::date
 ORDER BY s.fecha_fin DESC LIMIT 1`,[userId])).rows[0] || null;
};
router.get('/app/account', async (req,res,next) => {
 try {
  await registerRequestDevice(req);
  const result=await pool.query(`SELECT id,nombre,email,max_devices,
   (SELECT COUNT(*)::INT FROM user_devices d WHERE d.user_id=users.id) AS active_devices
   FROM users WHERE id=$1`,[req.auth.userId]);
  const subscription=await activeSubscription(req.auth.userId);
  const user=result.rows[0];
  res.json({ok:true,data:{user,subscription,canPlay:req.auth.rol==='admin'||Boolean(subscription),
   max_devices:user.max_devices,active_devices:user.active_devices,
   provider:{name:'TV Digital Pro',mode:'propio',connected:true}}});
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
  const kind=['channel','movie','series'].includes(req.query.kind)?req.query.kind:'';
  const filter=`FROM (${catalogSql}) catalog WHERE ($1='' OR category=$1) AND name ILIKE $2 AND ($3='' OR kind=$3)`;
  const params=[category,`%${search}%`,kind];
  const result=await pool.query(`SELECT * ${filter} ORDER BY name,"groupId" LIMIT $4 OFFSET $5`,[...params,limit,offset]);
  const count=await pool.query(`SELECT COUNT(*)::int AS total ${filter}`,params);
  const total=count.rows[0].total;
  res.json({ok:true,data:{items:result.rows,pagination:{total,offset,limit,hasMore:offset+result.rows.length<total}}});
 }catch(e){next(e);}
});
router.get('/catalog/series/:seriesId/episodes',async(req,res,next)=>{
 try{
  if(!/^[1-9][0-9]{0,14}$/.test(req.params.seriesId))throw fail('Serie inválida');
  const result=await pool.query(`SELECT 'episode:'||e.id AS "groupId",e.titulo AS name,
   'Temporada '||e.season_number AS category,COALESCE(e.poster_url,s.poster_url,'') AS logo,
   COALESCE(e.poster_url,s.poster_url,'') AS "squareLogo",'episode' AS kind,
   (GREATEST(e.parental_rating,s.parental_rating)>=18) AS restricted,'' AS "epgNow",'' AS "epgNext"
   FROM series_episodes e JOIN series s ON s.id=e.series_id LEFT JOIN categories k ON k.id=s.category_id
   WHERE e.series_id=$1 AND e.activo AND s.activo AND (k.id IS NULL OR k.activo)
   ORDER BY e.season_number,e.episode_number,e.id`,[req.params.seriesId]);
  res.json({ok:true,data:{items:result.rows,pagination:{total:result.rowCount,offset:0,limit:result.rowCount,hasMore:false}}});
 }catch(e){next(e);}
});
router.get('/playback/session/:contentId',async(req,res,next)=>{
 try {
  await registerRequestDevice(req);
  if(req.auth.rol!=='admin' && !await activeSubscription(req.auth.userId)) throw fail('Tu suscripción no está activa. Contacta a tu proveedor para renovarla.',403);
  const match=/^(channel|movie|episode):([1-9][0-9]{0,14})$/.exec(req.params.contentId);
  if(!match) throw fail('Contenido inválido');
  const table=match[1]==='channel'?'live_channels':match[1]==='movie'?'movies':'series_episodes';
  const providerColumns=table==='live_channels'?`,c.xtream_provider_id,c.xtream_stream_id,c.xtream_container,
   p.base_url,p.username_encrypted,p.password_encrypted,p.user_agent,p.referer,p.preferred_output`:'';
  const providerJoin=table==='live_channels'?' LEFT JOIN xtream_providers p ON p.id=c.xtream_provider_id AND p.activo':'';
  const contentSql=table==='series_episodes'
   ?`SELECT c.manifest_url,c.fallback_manifest_url,c.license_url,c.drm_type,NULL::JSONB AS stream_headers,
      GREATEST(c.parental_rating,s.parental_rating) AS parental_rating
      FROM series_episodes c JOIN series s ON s.id=c.series_id LEFT JOIN categories k ON k.id=s.category_id
      WHERE c.id=$1 AND c.activo AND s.activo AND (k.id IS NULL OR k.activo)`
   :`SELECT c.manifest_url,c.fallback_manifest_url,c.license_url,c.drm_type,c.stream_headers,c.parental_rating${providerColumns}
      FROM ${table} c LEFT JOIN categories k ON k.id=c.category_id${providerJoin}
      WHERE c.id=$1 AND c.activo AND (k.id IS NULL OR k.activo)`;
  const result=await pool.query(contentSql,[match[2]]);
  const content=result.rows[0];
  if(!content) throw fail('Contenido no disponible',404);
  if(Number(content.parental_rating)>=18&&req.auth.rol!=='admin'){
   const user=(await pool.query('SELECT parental_pin_hash FROM users WHERE id=$1',[req.auth.userId])).rows[0];
   if(!user?.parental_pin_hash)throw fail('Este contenido requiere un PIN parental configurado por el administrador.',403);
   const pin=String(req.get('X-Parental-Pin')||'');
   if(!/^\d{4}$/.test(pin)||!await verifyPassword(pin,user.parental_pin_hash))throw fail('PIN parental incorrecto.',403);
  }
  let manifest,mimeType;
  if(content.xtream_provider_id&&content.xtream_stream_id){
   if(!content.base_url)throw fail('El proveedor Xtream está inactivo',409);
   const token=signXtreamPlayback({channelId:match[2],userId:req.auth.userId});
   const origin=(env.publicBaseUrl||`${req.protocol}://${req.get('host')}`).replace(/\/$/,'');
   const container=preferredXtreamContainer(content,content.xtream_container);
   manifest=`${origin}/api/xtream/stream/${match[2]}.${container}?token=${encodeURIComponent(token)}`;
   mimeType=content.preferred_output==='auto'?null:container==='m3u8'?'application/x-mpegURL':'video/mp2t';
  }else{
   if(!content.manifest_url) throw fail('Este contenido todavía no tiene una fuente de reproducción configurada.',409);
   manifest=validMediaUrl(content.manifest_url,env.allowHttpStreams);
   mimeType=manifest.split('?')[0].endsWith('.mpd')?'application/dash+xml':manifest.split('?')[0].endsWith('.m3u8')?'application/x-mpegURL':null;
  }
  const license=content.drm_type==='widevine'?validMediaUrl(content.license_url,false):null;
  const fallbackUrls=[];
  if(!content.xtream_provider_id&&content.fallback_manifest_url){
   const fallback=validMediaUrl(content.fallback_manifest_url,env.allowHttpStreams);
   if(fallback!==manifest)fallbackUrls.push(fallback);
  }
  res.json({ok:true,data:{contentId:req.params.contentId,manifestUrl:manifest,fallbackUrls,
   mimeType,
   streamHeaders:content.xtream_provider_id?providerPlaybackHeaders(content):validStreamHeaders(content.stream_headers),drm:license?{scheme:'widevine',licenseUrl:license,licenseHeaders:{}}:null}});
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
