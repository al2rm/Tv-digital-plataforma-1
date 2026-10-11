import { pool } from '../database/db.js';

const restorable={users:'users',subscriptions:'subscriptions',payments:'payments',plans:'plans',categories:'categories',movies:'movies',series:'series',live_channels:'live_channels'};
const labels={users:'Cliente',subscriptions:'Suscripción',payments:'Pago',plans:'Plan',categories:'Categoría',movies:'Película',series:'Serie',live_channels:'Canal'};
const validId=value=>Number.isSafeInteger(Number(value))&&Number(value)>0;

export const listActivity=async(req,res,next)=>{try{
 const result=await pool.query(`SELECT id,user_id,user_name,action,resource,status_code,details,created_at FROM audit_log ORDER BY created_at DESC LIMIT 300`);
 res.json({ok:true,data:result.rows});
}catch(error){next(error);}};

export const listRecycleBin=async(req,res,next)=>{try{
 const result=await pool.query(`SELECT id,entity_type,entity_id,snapshot,deleted_at FROM recycle_bin WHERE restored_at IS NULL ORDER BY deleted_at DESC LIMIT 300`);
 res.json({ok:true,data:result.rows.map(row=>({...row,entity_label:labels[row.entity_type]||row.entity_type}))});
}catch(error){next(error);}};

export const restoreRecycleItem=async(req,res,next)=>{try{
 if(!validId(req.params.id))return res.status(400).json({ok:false,message:'Elemento inválido'});
 const archived=(await pool.query(`SELECT * FROM recycle_bin WHERE id=$1 AND restored_at IS NULL`,[req.params.id])).rows[0];
 if(!archived)return res.status(404).json({ok:false,message:'El elemento ya no está en la papelera'});
 const table=restorable[archived.entity_type];
 if(!table)return res.status(409).json({ok:false,message:'Este tipo de registro no se puede restaurar'});
 const restored=await pool.query(`INSERT INTO ${table} SELECT (jsonb_populate_record(NULL::${table},$1::JSONB)).* ON CONFLICT DO NOTHING RETURNING *`,[JSON.stringify(archived.snapshot)]);
 if(!restored.rowCount)return res.status(409).json({ok:false,message:'No se puede restaurar porque ya existe un registro con el mismo identificador o dato único'});
 await pool.query(`UPDATE recycle_bin SET restored_at=NOW() WHERE id=$1`,[archived.id]);
 res.json({ok:true,data:{id:archived.entity_id,type:archived.entity_type}});
}catch(error){next(error);}};

export const purgeRecycleItem=async(req,res,next)=>{try{
 if(!validId(req.params.id))return res.status(400).json({ok:false,message:'Elemento inválido'});
 const result=await pool.query(`DELETE FROM recycle_bin WHERE id=$1 RETURNING id`,[req.params.id]);
 if(!result.rowCount)return res.status(404).json({ok:false,message:'Elemento no encontrado'});
 res.json({ok:true,data:result.rows[0]});
}catch(error){next(error);}};

export const downloadBackup=async(req,res,next)=>{try{
 const [users,subscriptions,payments,plans,categories,channels,movies,series]=await Promise.all([
  pool.query(`SELECT id,nombre,email,telefono,rol,estado,fecha_creacion,fecha_actualizacion,ultimo_acceso,whatsapp_opt_in_at,whatsapp_opt_out_at FROM users ORDER BY id`),
  pool.query(`SELECT * FROM subscriptions ORDER BY id`),pool.query(`SELECT * FROM payments ORDER BY id`),
  pool.query(`SELECT * FROM plans ORDER BY id`),pool.query(`SELECT * FROM categories ORDER BY id`),
  pool.query(`SELECT id,category_id,nombre,logo_url,manifest_url,fallback_manifest_url,license_url,drm_type,numero_canal,activo,fecha_creacion,source,source_channel_id FROM live_channels ORDER BY id`),
  pool.query(`SELECT * FROM movies ORDER BY id`),pool.query(`SELECT * FROM series ORDER BY id`)
 ]);
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 res.set('Content-Disposition',`attachment; filename="tv-digital-backup-${stamp}.json"`);
 res.set('Content-Type','application/json; charset=utf-8');
 res.send(JSON.stringify({version:1,generatedAt:new Date().toISOString(),data:{users:users.rows,subscriptions:subscriptions.rows,payments:payments.rows,plans:plans.rows,categories:categories.rows,live_channels:channels.rows,movies:movies.rows,series:series.rows}},null,2));
}catch(error){next(error);}};
