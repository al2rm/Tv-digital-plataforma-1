import { pool } from '../database/db.js';
import { env } from '../config/env.js';
import { assertPublicChannelUrl } from '../services/iptvOrg.service.js';
import { isDirectStremcoreMedia, STREMCORE_SOURCE, stremcoreClient, stremcoreId, stremcoreNumber, stremcoreType } from '../services/stremcore.service.js';
const fail = (message,statusCode=400) => Object.assign(new Error(message),{statusCode});
const year = date => /^\d{4}-/.test(date) && Number(date.slice(0,4)) >= 1800 && Number(date.slice(0,4)) <= 2200 ? Number(date.slice(0,4)) : null;
const wrap = fn => async (req,res,next) => { try { await fn(req,res); } catch(error) { next(error); } };

export function createStremcoreControllers({ db = pool, client = stremcoreClient, validateUrl = assertPublicChannelUrl } = {}) {
  const existing = async (type,id,connection=db) => (await connection.query(`SELECT id,activo FROM ${stremcoreType(type)} WHERE source=$1 AND source_content_id=$2`,[STREMCORE_SOURCE,stremcoreId(id)])).rows[0] || null;
  const media = async value => {
    if (!value) return null;
    if (typeof value !== 'string' || value.length > 4096 || !isDirectStremcoreMedia(value,env.allowHttpStreams)) throw fail('Usa una URL directa .m3u8, .mpd, .mp4, .m4v, .webm o .ts. Las páginas de reproductores externos no son vídeos directos.');
    return validateUrl(value,{allowHttp:env.allowHttpStreams});
  };
  return {
    meta:wrap(async(req,res) => res.json({ok:true,data:await client.meta()})),
    list:wrap(async(req,res) => {
      const type=stremcoreType(req.params.type), data=await client.list(type,req.query);
      const ids=data.items.map(item=>item.id);
      const rows=ids.length?(await db.query(`SELECT id,activo,source_content_id FROM ${type} WHERE source=$1 AND source_content_id IN (${ids.map((_,i)=>`$${i+2}`).join(',')})`,[STREMCORE_SOURCE,...ids])).rows:[];
      const index=new Map(rows.map(row=>[row.source_content_id,row]));
      res.json({ok:true,data:{...data,items:data.items.map(item=>({...item,existing:index.get(item.id)||null}))}});
    }),
    detail:wrap(async(req,res) => {
      const data=await client.detail(req.params.type,req.params.sourceId);
      res.json({ok:true,data:{...data,existing:await existing(data.type,data.id)}});
    }),
    season:wrap(async(req,res) => {
      const data=await client.season(req.params.sourceId,req.params.season);
      const parent=await existing('series',data.seriesId);
      const rows=parent?(await db.query('SELECT id,episode_number,activo FROM series_episodes WHERE series_id=$1 AND season_number=$2',[parent.id,data.number])).rows:[];
      const index=new Map(rows.map(row=>[row.episode_number,row]));
      res.json({ok:true,data:{...data,episodes:data.episodes.map(item=>({...item,existing:index.get(item.number)||null}))}});
    }),
    import:wrap(async(req,res) => {
      const body=req.body||{}, type=stremcoreType(body.type), id=stremcoreId(body.id);
      if (!['draft','publish'].includes(body.mode)) throw fail('Selecciona guardar como borrador o publicar.');
      const publish=body.mode==='publish';
      const rating=body.parentalRating ?? 0;
      if (!Number.isInteger(rating)||rating<0||rating>21) throw fail('Clasificación parental inválida.');
      const category=body.categoryId?stremcoreNumber(body.categoryId,Number.MAX_SAFE_INTEGER):null;
      const info=await client.detail(type,id);
      let manifest=null, seasonNumber=null, episodes=[];
      if (type==='movies') {
        manifest=await media(body.manifestUrl);
        if (publish&&!manifest) throw fail('Para publicar la película necesitas una URL directa de reproducción. Puedes guardar su ficha como borrador.');
      } else {
        if (!Array.isArray(body.episodeNumbers)||body.episodeNumbers.length>50) throw fail('Selecciona hasta 50 episodios por importación.');
        const numbers=[...new Set(body.episodeNumbers.map(n=>stremcoreNumber(n)))];
        if(publish&&!numbers.length) throw fail('Selecciona al menos un episodio con URL directa para publicar.');
        if(numbers.length) {
          seasonNumber=stremcoreNumber(body.season,1000);
          const season=await client.season(id,seasonNumber);
          for(const number of numbers) {
            const episode=season.episodes.find(e=>e.number===number);
            if(!episode) throw fail('Uno de los episodios ya no existe en la temporada. Recarga la ficha.');
            const url=await media(body.episodeUrls?.[String(number)]);
            if(publish&&!url) throw fail(`El episodio ${number} necesita una URL directa para publicarse.`);
            episodes.push({...episode,manifest:url});
          }
        }
      }
      const connection=await db.connect();
      try {
        await connection.query('BEGIN');
        if(category && !(await connection.query('SELECT id FROM categories WHERE id=$1 AND activo',[category])).rows.length) throw fail('La categoría ya no está disponible.');
        let record, created=false, imported=0, skipped=0;
        const common=[category,info.title,info.overview||null,info.poster,info.backdrop,year(info.date),rating,publish,STREMCORE_SOURCE,id];
        if(type==='movies') {
          const result=await connection.query(`INSERT INTO movies(category_id,titulo,descripcion,poster_url,banner_url,anio,parental_rating,activo,source,source_content_id,manifest_url,duracion_min)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT(source,source_content_id) WHERE source IS NOT NULL AND source_content_id IS NOT NULL DO NOTHING RETURNING id,activo`,[...common,manifest,info.runtime]);
          created=Boolean(result.rows.length); record=result.rows[0]||await existing(type,id,connection);
        } else {
          const result=await connection.query(`INSERT INTO series(category_id,titulo,descripcion,poster_url,banner_url,anio,parental_rating,activo,source,source_content_id)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT(source,source_content_id) WHERE source IS NOT NULL AND source_content_id IS NOT NULL DO NOTHING RETURNING id,activo`,common);
          created=Boolean(result.rows.length); record=result.rows[0]||await existing(type,id,connection);
          for(const episode of episodes) {
            const result=await connection.query(`INSERT INTO series_episodes(series_id,titulo,season_number,episode_number,poster_url,manifest_url,parental_rating,activo)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(series_id,season_number,episode_number) DO NOTHING RETURNING id`,[record.id,episode.title,seasonNumber,episode.number,episode.poster,episode.manifest,rating,publish]);
            if(result.rows.length) imported++; else skipped++;
          }
          if(publish && imported && !record.activo) record=(await connection.query('UPDATE series SET activo=TRUE WHERE id=$1 RETURNING id,activo',[record.id])).rows[0];
        }
        await connection.query('COMMIT');
        res.status(created||imported?201:200).json({ok:true,data:{type,id:record.id,created,active:record.activo,episodesImported:imported,episodesExisting:skipped},message:created||imported?(publish?'Contenido importado y publicado en la app.':'Ficha guardada como borrador. Configura las fuentes antes de activarla.'): 'El contenido ya estaba importado. Sus modificaciones se conservaron.'});
      } catch(error) { await connection.query('ROLLBACK'); throw error; }
      finally { connection.release(); }
    })
  };
}
export const stremcoreControllers=createStremcoreControllers();
