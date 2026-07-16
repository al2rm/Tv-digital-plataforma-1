import { pool } from "../database/db.js";

const allowed = {
  movies: ["category_id","titulo","descripcion","poster_url","banner_url","manifest_url","license_url","drm_type","anio","duracion_min","clasificacion","destacado","activo"],
  series: ["category_id","titulo","descripcion","poster_url","banner_url","anio","clasificacion","destacado","activo"],
  live_channels: ["category_id","nombre","logo_url","manifest_url","license_url","drm_type","numero_canal","activo"],
  categories: ["nombre","slug","tipo","activo"]
};

const fieldsFor = (kind) => {
  if (!allowed[kind]) { const e = new Error("Tipo de contenido inválido"); e.statusCode = 400; throw e; }
  return allowed[kind];
};

export const listContent = async (req,res,next) => {
  try {
    fieldsFor(req.params.kind);
    const result = await pool.query(`SELECT * FROM ${req.params.kind} ORDER BY fecha_creacion DESC NULLS LAST`);
    res.json({ ok:true, data:result.rows });
  } catch(error){ next(error); }
};

export const createContent = async (req,res,next) => {
  try {
    const fields = fieldsFor(req.params.kind).filter(f => req.body[f] !== undefined);
    if (!fields.length) return res.status(400).json({ ok:false, message:"Sin datos" });
    const values = fields.map(f => req.body[f]);
    const placeholders = fields.map((_,i)=>`$${i+1}`).join(",");
    const result = await pool.query(
      `INSERT INTO ${req.params.kind} (${fields.join(",")}) VALUES (${placeholders}) RETURNING *`, values
    );
    res.status(201).json({ ok:true, data:result.rows[0] });
  } catch(error){ next(error); }
};

export const disableContent = async (req,res,next) => {
  try {
    fieldsFor(req.params.kind);
    const result = await pool.query(`UPDATE ${req.params.kind} SET activo=FALSE WHERE id=$1 RETURNING id`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ ok:false, message:"Registro no encontrado" });
    res.json({ ok:true, message:"Registro desactivado" });
  } catch(error){ next(error); }
};
