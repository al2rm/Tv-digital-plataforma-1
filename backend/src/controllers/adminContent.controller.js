import { pool } from '../database/db.js';
const allowed={
 movies:['category_id','titulo','descripcion','poster_url','banner_url','manifest_url','license_url','drm_type','anio','duracion_min','clasificacion','destacado','activo'],
 series:['category_id','titulo','descripcion','poster_url','banner_url','anio','clasificacion','destacado','activo'],
 live_channels:['category_id','nombre','logo_url','manifest_url','license_url','drm_type','numero_canal','activo'],
 categories:['nombre','slug','tipo','activo']
};
const fail=message=>Object.assign(new Error(message),{statusCode:400});
function fieldsFor(kind){if(!allowed[kind])throw fail('Tipo de contenido inválido');return allowed[kind];}
function validate(kind,body){
 fieldsFor(kind);
 const title=['movies','series'].includes(kind)?'titulo':'nombre';
 if(typeof body[title]!=='string'||!body[title].trim())throw fail('El nombre es obligatorio');
 if(kind==='categories'&&!/^[a-z0-9-]+$/.test(body.slug||''))throw fail('El identificador debe usar letras minúsculas, números o guiones');
 for(const key of ['manifest_url','license_url','logo_url','poster_url','banner_url']){
  if(!body[key])continue;
  try{const u=new URL(body[key]);if(u.protocol!=='https:'||u.username||u.password)throw new Error();}
  catch{throw fail(`${key}: utiliza una URL HTTPS sin credenciales`);}
 }
 if(body.drm_type&&!['none','widevine'].includes(body.drm_type))throw fail('DRM no compatible');
 if(body.drm_type==='widevine'&&!body.license_url)throw fail('Widevine requiere una URL de licencia');
 if(body.category_id!==undefined&&body.category_id!==null&&(!Number.isSafeInteger(Number(body.category_id))||Number(body.category_id)<=0))throw fail('Categoría inválida');
 if(body.activo!==undefined&&typeof body.activo!=='boolean')throw fail('Estado inválido');
}
export const listContent=async(req,res,next)=>{try{fieldsFor(req.params.kind);const r=await pool.query(`SELECT * FROM ${req.params.kind} ORDER BY fecha_creacion DESC NULLS LAST,id DESC`);res.json({ok:true,data:r.rows});}catch(e){next(e);}};
export const createContent=async(req,res,next)=>{try{
 validate(req.params.kind,req.body);const fields=fieldsFor(req.params.kind).filter(f=>req.body[f]!==undefined);
 const r=await pool.query(`INSERT INTO ${req.params.kind} (${fields.join(',')}) VALUES (${fields.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`,fields.map(f=>req.body[f]));
 res.status(201).json({ok:true,data:r.rows[0]});
}catch(e){if(e.code==='23505')e=fail('Ya existe una categoría con ese identificador');next(e);}};
export const updateContent=async(req,res,next)=>{try{
 validate(req.params.kind,req.body);const fields=fieldsFor(req.params.kind).filter(f=>req.body[f]!==undefined);
 const r=await pool.query(`UPDATE ${req.params.kind} SET ${fields.map((f,i)=>`${f}=$${i+1}`).join(',')} WHERE id=$${fields.length+1} RETURNING *`,[...fields.map(f=>req.body[f]),req.params.id]);
 if(!r.rowCount)return res.status(404).json({ok:false,message:'Contenido no encontrado'});res.json({ok:true,data:r.rows[0]});
}catch(e){next(e);}};
export const disableContent=async(req,res,next)=>{try{fieldsFor(req.params.kind);const r=await pool.query(`UPDATE ${req.params.kind} SET activo=FALSE WHERE id=$1 RETURNING id`,[req.params.id]);if(!r.rowCount)return res.status(404).json({ok:false,message:'Registro no encontrado'});res.json({ok:true,message:'Registro desactivado'});}catch(e){next(e);}};
