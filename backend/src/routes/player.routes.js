import { Router } from 'express';
import { pool } from '../database/db.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();
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
const fail = (message,statusCode=400) => Object.assign(new Error(message),{statusCode});
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
  const result=await pool.query(`SELECT c.manifest_url,c.license_url,c.drm_type FROM ${table} c LEFT JOIN categories k ON k.id=c.category_id WHERE c.id=$1 AND c.activo AND (k.id IS NULL OR k.activo)`,[match[2]]);
  const content=result.rows[0];
  if(!content) throw fail('Contenido no disponible',404);
  if(!content.manifest_url) throw fail('Este contenido todavía no tiene una fuente de reproducción configurada.',409);
  const manifest=validHttps(content.manifest_url);
  const license=content.drm_type==='widevine'?validHttps(content.license_url):null;
  res.json({ok:true,data:{contentId:req.params.contentId,manifestUrl:manifest,
   mimeType:manifest.split('?')[0].endsWith('.mpd')?'application/dash+xml':manifest.split('?')[0].endsWith('.m3u8')?'application/x-mpegURL':null,
   streamHeaders:{},drm:license?{scheme:'widevine',licenseUrl:license,licenseHeaders:{}}:null}});
 }catch(e){next(e);}
});
function validHttps(value){
 try {const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw new Error();return url.href;}
 catch {throw fail('La fuente debe tener una URL HTTPS válida.',409);}
}
export default router;
