import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Film, Library, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { AppLink } from '../context/RouterContext';
import api, { apiError } from '../services/api';
import './stremcore.css';

const BASE = '/admin/v2/content/import/stremcore';
const directUrl = item => item?.servers?.find(server => server.direct)?.url || '';

export default function StremcorePage() {
  const [type,setType] = useState('movies'), [genre,setGenre] = useState('all'), [page,setPage] = useState(1);
  const [query,setQuery] = useState(''), [search,setSearch] = useState(''), [meta,setMeta] = useState(null), [categories,setCategories] = useState([]);
  const [catalog,setCatalog] = useState(null), [loading,setLoading] = useState(true), [error,setError] = useState(''), [notice,setNotice] = useState(''), [refresh,setRefresh] = useState(0);
  const [target,setTarget] = useState(null), [detail,setDetail] = useState(null), [detailError,setDetailError] = useState(''), [saving,setSaving] = useState(false);
  const [season,setSeason] = useState(1), [seasonInput,setSeasonInput] = useState('1'), [seasonRefresh,setSeasonRefresh] = useState(0), [seasonData,setSeasonData] = useState(null), [seasonError,setSeasonError] = useState(''), [seasonLoading,setSeasonLoading] = useState(false);
  const [selected,setSelected] = useState(new Set()), [urls,setUrls] = useState({}), [manifest,setManifest] = useState(''), [category,setCategory] = useState(''), [mode,setMode] = useState('draft'), [rating,setRating] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([api.get(`${BASE}/meta`,{signal:controller.signal}),api.get('/admin/v2/content/categories',{signal:controller.signal})])
      .then(([m,c])=>{setMeta(m.data.data);setCategories(c.data.data.filter(item=>item.activo));})
      .catch(e=>{if(!controller.signal.aborted)setError(apiError(e));});
    return ()=>controller.abort();
  },[refresh]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);setError('');setCatalog(null);
    api.get(`${BASE}/${type}`,{params:{genre,page,q:search},signal:controller.signal})
      .then(r=>setCatalog(r.data.data)).catch(e=>{if(!controller.signal.aborted)setError(apiError(e));})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[type,genre,page,search,refresh]);
  useEffect(() => {
    if(!target)return;
    const controller = new AbortController();
    setDetail(null);setDetailError('');setManifest('');setMode('draft');setCategory('');setRating(0);
    setSeason(1);setSeasonInput('1');setSeasonData(null);setSeasonError('');setSelected(new Set());setUrls({});
    api.get(`${BASE}/${target.type}/${target.id}`,{signal:controller.signal}).then(r=>{
      setDetail(r.data.data);setManifest(directUrl(r.data.data));
    }).catch(e=>{if(!controller.signal.aborted)setDetailError(apiError(e));});
    return ()=>controller.abort();
  },[target]);
  useEffect(() => {
    if(!detail||detail.type!=='series')return;
    const controller = new AbortController();
    setSeasonLoading(true);setSeasonError('');setSeasonData(null);setSelected(new Set());setUrls({});
    api.get(`${BASE}/series/${detail.id}/seasons/${season}`,{signal:controller.signal}).then(r=>{
      setSeasonData(r.data.data);
      setUrls(Object.fromEntries(r.data.data.episodes.map(e=>[e.number,directUrl(e)])));
    }).catch(e=>{if(!controller.signal.aborted)setSeasonError(apiError(e));})
      .finally(()=>{if(!controller.signal.aborted)setSeasonLoading(false);});
    return ()=>controller.abort();
  },[detail,season,seasonRefresh]);

  const changeType = value => {setType(value);setGenre('all');setPage(1);setSearch('');setQuery('');};
  const toggle = number => setSelected(current=>{const next=new Set(current);if(next.has(number))next.delete(number);else if(next.size<50)next.add(number);return next;});
  const importContent = async event => {
    event.preventDefault();setSaving(true);setDetailError('');
    try {
      const response = await api.post(BASE,{type:detail.type,id:detail.id,mode,categoryId:category||null,parentalRating:rating,
        ...(detail.type==='movies'?{manifestUrl:manifest}:{season,episodeNumbers:[...selected],episodeUrls:Object.fromEntries([...selected].map(number=>[number,urls[number]||'']))})});
      setNotice(response.data.message);setTarget(null);setRefresh(value=>value+1);
    } catch(e){setDetailError(apiError(e));} finally{setSaving(false);}
  };
  const genres = meta?.[type==='movies'?'movieGenres':'seriesGenres'] || [];
  const availableEpisodes = seasonData?.episodes.filter(e=>!e.existing) || [];
  const publishingReady = detail?.type==='movies'?Boolean(manifest.trim()):selected.size>0&&[...selected].every(number=>urls[number]?.trim());
  const alreadyMovie = detail?.type==='movies'&&Boolean(detail.existing);

  return <>
    <PageHeader eyebrow="Fuentes del catálogo" title="Stremcore" description="Explora películas y series, revisa sus fuentes e importa lo que quieras administrar en TV Digital Pro."
      action={<button className="secondary-button" disabled={loading} onClick={()=>setRefresh(value=>value+1)}>Actualizar lista</button>}/>
    {notice&&<div role="status" className="alert alert--success">{notice} <AppLink to={type==='movies'?'/catalogo':'/programacion'}>Administrar contenido</AppLink></div>}
    {error&&<div role="alert" className="alert alert--error">{error} <button className="mini-button" onClick={()=>setRefresh(value=>value+1)}>Reintentar</button></div>}
    <div className="toolbar"><button className={type==='movies'?'primary-button':'secondary-button'} onClick={()=>changeType('movies')}><Film size={18}/>Películas{meta?` (${meta.movies.toLocaleString('es-PY')})`:''}</button><button className={type==='series'?'primary-button':'secondary-button'} onClick={()=>changeType('series')}><Library size={18}/>Series{meta?` (${meta.series.toLocaleString('es-PY')})`:''}</button></div>
    <form className="strem-filters" onSubmit={event=>{event.preventDefault();setPage(1);setSearch(query.trim());}}>
      <label>Género<select value={genre} onChange={event=>{setGenre(event.target.value);setPage(1);}}><option value="all">Todos los géneros</option>{genres.map(g=><option key={g.slug} value={g.slug}>{g.label}</option>)}</select></label>
      <label>Buscar por título<input maxLength={100} minLength={2} value={query} placeholder="Nombre de una película o serie" onChange={event=>setQuery(event.target.value)}/></label>
      <button className="primary-button" disabled={loading}><Search size={17}/>Buscar</button>
      {search&&<button type="button" className="secondary-button" onClick={()=>{setQuery('');setSearch('');setPage(1);}}>Limpiar búsqueda</button>}
    </form>
    <p className="strem-note">Las fichas pueden incluir páginas de reproductores externos. Para ver un título en la app necesitas una fuente directa compatible. Puedes importar su información como borrador y configurarla después.</p>
    {loading?<div role="status" className="loading-panel">{search?'Buscando títulos en Stremcore…':'Cargando catálogo de Stremcore…'}</div>:<>
      {catalog?.items.length?<div className="strem-grid">{catalog.items.map(item=><button key={item.id} className="strem-card" onClick={()=>setTarget({type,id:item.id})} aria-label={`Ver ficha de ${item.title}`}>
        <div className="strem-poster">{item.poster?<img src={item.poster} alt="" loading="lazy" referrerPolicy="no-referrer"/>:<Film size={40}/>}</div>
        <div className="strem-card-info"><strong>{item.title}</strong><small>{item.date?.slice(0,4)||'Sin año'}{item.rating?` · ★ ${item.rating}`:''}</small>{item.existing&&<span className="status-pill status-pill--muted">{item.existing.activo?'Ya publicado':'Borrador importado'}</span>}</div>
      </button>)}</div>:!error&&<div className="empty-inline">No se encontraron títulos. Prueba otra búsqueda o género.</div>}
      {catalog&&<nav className="strem-pagination" aria-label="Páginas de Stremcore"><button className="secondary-button" disabled={page<=1} onClick={()=>setPage(value=>value-1)}><ChevronLeft size={18}/>Anterior</button><span>Página {catalog.page} de {catalog.totalPages} · {catalog.total.toLocaleString('es-PY')} resultados</span><button className="secondary-button" disabled={page>=catalog.totalPages} onClick={()=>setPage(value=>value+1)}>Siguiente<ChevronRight size={18}/></button></nav>}
      {catalog?.truncated&&<p className="strem-note">Se muestran los primeros 500 resultados. Escribe un título más concreto para afinar la búsqueda.</p>}
    </>}
    {target&&<Modal wide title={detail?.title||'Ficha de Stremcore'} onClose={()=>!saving&&setTarget(null)}>
      {detailError&&<div role="alert" className="alert alert--error">{detailError}</div>}
      {!detail?!detailError&&<div className="loading-panel">Cargando ficha…</div>:<form onSubmit={importContent}>
        <div className="strem-detail">{detail.poster&&<img src={detail.poster} alt="" referrerPolicy="no-referrer"/>}<div><p>{detail.overview||'Sin descripción disponible.'}</p><small>{detail.date?.slice(0,4)}{detail.runtime?` · ${detail.runtime} min`:''}</small></div></div>
        {detail.type==='movies'&&<ServerList servers={detail.servers} onSelect={setManifest}/>}
        {detail.existing&&<p className="strem-note">Esta {detail.type==='movies'?'película':'serie'} ya está en tu catálogo. Sus cambios se conservan. <AppLink to={detail.type==='movies'?'/catalogo':'/programacion'}>Editar o eliminar en el panel</AppLink>{detail.type==='series'?' · Puedes agregar episodios nuevos.':''}</p>}
        {!alreadyMovie&&<>
          {detail.type==='series'?<section className="strem-seasons">
            <div className="strem-season-picker"><label>Temporada<input type="number" min={1} max={1000} value={seasonInput} onChange={event=>setSeasonInput(event.target.value)}/></label><button type="button" className="secondary-button" disabled={seasonLoading||!Number.isInteger(Number(seasonInput))||Number(seasonInput)<1||Number(seasonInput)>1000} onClick={()=>{setSeason(Number(seasonInput));setSeasonRefresh(value=>value+1);}}>Ver temporada</button></div>
            {seasonError&&<p role="alert" className="alert alert--error">{seasonError} Puedes guardar la ficha de la serie sin episodios.</p>}
            {seasonLoading?<div className="loading-panel">Cargando episodios…</div>:seasonData&&<>
              <label className="strem-check"><input type="checkbox" disabled={!availableEpisodes.length} checked={selected.size>0&&selected.size===Math.min(50,availableEpisodes.length)} onChange={event=>setSelected(new Set(event.target.checked?availableEpisodes.slice(0,50).map(e=>e.number):[]))}/>Seleccionar todos los disponibles (máximo 50)</label>
              <div className="strem-episodes">{seasonData.episodes.map(episode=><div key={episode.number} className="strem-episode"><label className="strem-check"><input type="checkbox" disabled={Boolean(episode.existing)||(!selected.has(episode.number)&&selected.size>=50)} checked={selected.has(episode.number)} onChange={()=>toggle(episode.number)}/><strong>E{episode.number} · {episode.title}</strong>{episode.existing&&<small>Ya importado</small>}</label>
                {selected.has(episode.number)&&<><ServerList servers={episode.servers} onSelect={url=>setUrls(current=>({...current,[episode.number]:url}))}/><label>URL directa del episodio<input type="url" maxLength={4096} placeholder="https://tu-servidor/episodio.m3u8" value={urls[episode.number]||''} onChange={event=>setUrls(current=>({...current,[episode.number]:event.target.value}))}/></label></>}
              </div>)}</div>
              <p className="strem-note">{selected.size} episodios seleccionados. Los episodios ya importados se editan desde Series y EPG.</p>
            </>}
          </section>:<label className="strem-url">URL directa de la película<input type="url" maxLength={4096} value={manifest} placeholder="https://tu-servidor/pelicula.mp4" onChange={event=>setManifest(event.target.value)}/><small>HLS (.m3u8), DASH (.mpd), MP4, M4V, WebM o TS.</small></label>}
          <div className="form-grid strem-import-options">
            <label>Categoría de destino<select value={category} onChange={event=>setCategory(event.target.value)}><option value="">Sin categoría</option>{categories.map(item=><option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
            <label>Clasificación parental<select value={rating} onChange={event=>setRating(Number(event.target.value))}><option value={0}>Todo público</option><option value={12}>12 años</option><option value={16}>16 años</option><option value={18}>18 años</option></select></label>
            <label className="form-grid__full">Guardar contenido<select value={mode} onChange={event=>setMode(event.target.value)}><option value="draft">Borrador: configurar antes de mostrar en la app</option><option value="publish">Publicar en la app con fuentes directas</option></select></label>
          </div>
          {mode==='publish'&&!publishingReady&&<p className="strem-note">{detail.type==='movies'?'Agrega una URL directa para publicar.':'Selecciona episodios nuevos y agrega la URL directa de cada uno para publicar.'}</p>}
        </>}
        <div className="form-actions"><button type="button" className="secondary-button" disabled={saving} onClick={()=>setTarget(null)}>Cerrar</button>{!alreadyMovie&&<button className="primary-button" disabled={saving||(mode==='publish'&&!publishingReady)||(detail.type==='series'&&seasonLoading&&selected.size>0)}>{saving?'Importando…':mode==='publish'?'Importar y publicar':'Guardar borrador'}</button>}</div>
      </form>}
    </Modal>}
  </>;
}

function ServerList({servers,onSelect}) {
  return <div className="strem-servers"><strong>Fuentes del catálogo</strong>{servers.length?<ul>{servers.map((server,index)=><li key={`${server.id}-${index}`}><span>{server.name} · {server.language||'Sin idioma'}{server.quality?` · ${server.quality}`:''}</span><small>{server.direct?'Fuente directa detectada':server.url?'Página de reproductor externo: requiere una fuente directa':'Sin enlace disponible'}</small>{server.direct&&onSelect&&<button type="button" className="mini-button" onClick={()=>onSelect(server.url)}>Usar fuente directa de {server.name}</button>}</li>)}</ul>:<p>No hay fuentes disponibles en esta ficha. Puedes indicar tu URL directa.</p>}</div>;
}
