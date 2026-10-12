import { pool } from '../database/db.js';

const hidden=/password|token|secret|authorization|username/i;
const safeDetails=body=>Object.fromEntries(Object.entries(body&&typeof body==='object'?body:{}).filter(([key])=>!hidden.test(key)).slice(0,20));

export const auditMiddleware=(req,res,next)=>{
 if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return next();
 res.once('finish',()=>{
  if(res.statusCode>=400)return;
  pool.query(`INSERT INTO audit_log(user_id,user_name,action,resource,status_code,details)
   SELECT id,nombre,$2,$3,$4,$5::JSONB FROM users WHERE id=$1`,[
    req.auth.userId,req.method,req.originalUrl.split('?')[0],res.statusCode,JSON.stringify(safeDetails(req.body))
  ]).catch(()=>{});
 });
 next();
};
