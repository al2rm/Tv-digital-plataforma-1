import { useCallback, useEffect, useState } from 'react';
import { Download, Film, Layers, Pencil, Plus, Tv } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import api, { apiError } from '../services/api';
const kinds={live_channels:'TV en vivo',movies:'Películas',categories:'Categorías'};
const blank={nombre:'',titulo:'',category_id:'',manifest_url:'',license_url:'',drm_type:'none',logo_url:'',poster_url:'',slug:'',tipo:'general',activo:true};
export default function ContentPage(){
 const [kind,setKind]=useState('live_channels'),[rows,setRows]=useState([]),[categories,setCategories]=useState([]),[form,setForm]=useState(null),[error,setError]=useState(''),[saving,setSaving]=useState(false),[notice,setNotice]=useState('');
 const [importer,setImporter]=useState(null),[selected,setSelected]=useState(new Set()),[importing,setImporting]=useState(false),[importError,setImportError]=useState('');
 const load=useCallback(async()=>{try{const [r,c]=await Promise.all([api.get(`/admin/v2/content/${kind}`),api.get('/admin/v2/content/categories')]);setRows(r.data.data);setCategories(c.data.data);}catch(e){setError(apiError(e));}},[kind]);
 useEffect(()=>{setRows([]);setError('');void load();},[load]);
 const change=(key,value)=>setForm({...form,[key]:value});
 const save=async e=>{e.preventDefault();setSaving(true);setError('');try{
  const data=kind==='categories'?{nombre:form.nombre,slug:form.slug,tipo:'general',activo:form.activo}:{category_id:form.category_id?Number(form.category_id):null,manifest_url:form.manifest_url||null,license_url:form.drm_type==='widevine'?form.license_url:null,drm_type:form.drm_type,activo:form.activo,...(kind==='movies'?{titulo:form.titulo,poster_url:form.poster_url||null}:{nombre:form.nombre,logo_url:form.logo_url||null})};
  if(form.id)await api.put(`/admin/v2/content/${kind}/${form.id}`,data);else await api.post(`/admin/v2/content/${kind}`,data);
  setForm(null);setNotice('Catálogo actualizado. Los cambios ya están disponibles para la app.');await load();
 }catch(err){setError(apiError(err));}finally{setSaving(false);}};
 const loadCountryPreview=async(countryCode,countries)=>{setImporter(current=>({...current,countries,countryCode,loading:true,items:[],summary:null,source:null}));setSelected(new Set());setImportError('');try{
  const response=await api.get(`/admin/v2/content/import/iptv-org/${countryCode}/preview`);const data=response.data.data;const limit=data.limits?.maxSelection||50;
  setImporter({...data,countries,countryCode,loading:false});setSelected(new Set(data.items.filter(item=>item.compatible&&!item.existing).slice(0,limit).map(item=>item.sourceId)));
 }catch(err){setImporter(current=>({...current,countries,countryCode,loading:false}));setImportError(apiError(err));}};
 const openImporter=async()=>{setImporter({loading:true,items:[],summary:null,source:null,countries:[],countryCode:'py'});setSelected(new Set());setImportError('');try{
  const response=await api.get('/admin/v2/content/import/iptv-org/countries');const countries=response.data.data;const initial=countries.some(country=>country.code==='py')?'py':countries[0]?.code;
  if(!initial)throw new Error('iptv-org no devolvió países disponibles');await loadCountryPreview(initial,countries);
 }catch(err){setImporter(current=>({...current,loading:false}));setImportError(apiError(err));}};
 const toggleChannel=sourceId=>setSelected(current=>{const next=new Set(current);if(next.has(sourceId))next.delete(sourceId);else if(next.size<(importer.limits?.maxSelection||50))next.add(sourceId);else setImportError(`Puedes importar hasta ${importer.limits?.maxSelection||50} canales por lote.`);return next;});
 const importChannels=async()=>{setImporting(true);setImportError('');try{
  const response=await api.post(`/admin/v2/content/import/iptv-org/${importer.countryCode}`,{sourceIds:[...selected]},{timeout:90000});
  const result=response.data.data;const unavailable=result.unavailable.length;const reasons=result.unavailable.slice(0,2).map(item=>`${item.name}: ${item.reason}`).join(' · ');const remaining=Math.max(0,unavailable-2);
  setNotice(`${result.imported.length} canal${result.imported.length===1?'':'es'} de ${result.country.name} importado${result.imported.length===1?'':'s'}${unavailable?`; ${unavailable} omitido${unavailable===1?'':'s'} (${reasons}${remaining?` · y ${remaining} más`:''})`:''}.`);
  setImporter(null);setSelected(new Set());await load();
 }catch(err){setImportError(apiError(err));}finally{setImporting(false);}};
 return <><PageHeader eyebrow="App Android" title="Tu catálogo" description="Administra las categorías, canales y películas que verán tus clientes." action={<button className="primary-button" onClick={()=>{setError('');setForm({...blank});}}><Plus size={18}/>Agregar</button>}/>
 {notice&&<div className="alert alert--success">{notice}</div>}{error&&!form&&<div className="alert alert--error">{error}</div>}
 <div className="toolbar">{Object.entries(kinds).map(([key,title])=><button key={key} className={kind===key?'primary-button':'secondary-button'} onClick={()=>setKind(key)}>{key==='live_channels'?<Tv size={18}/>:key==='movies'?<Film size={18}/>:<Layers size={18}/>} {title}</button>)}{kind==='live_channels'&&<button className="secondary-button toolbar__import" onClick={openImporter}><Download size={18}/>Importar iptv-org</button>}</div>
 <section className="panel-card panel-card--table"><DataTable rows={rows} columns={[{key:'nombre',label:'Nombre',render:r=><strong>{r.nombre||r.titulo}</strong>},{key:'activo',label:'Estado',render:r=><span className={`status-pill ${r.activo?'status-pill--ok':'status-pill--muted'}`}>{r.activo?'Visible':'Oculto'}</span>},...(kind!=='categories'?[{key:'manifest_url',label:'Reproducción',render:r=>r.manifest_url?'Fuente configurada':'Pendiente de fuente'}]:[{key:'slug',label:'Identificador'}])]} actions={r=><button className="mini-button" onClick={()=>{setError('');setForm({...blank,...r});}}><Pencil size={15}/>Editar</button>}/></section>
 {kind!=='categories'&&<p className="catalog-note">Agrega fuentes HTTPS de tu servicio autorizado. El catálogo de LumixTV requiere una integración que facilite su proveedor.</p>}
 {form&&<Modal title={`${form.id?'Editar':'Agregar'} · ${kinds[kind]}`} onClose={()=>!saving&&setForm(null)}><form className="form-grid" onSubmit={save}>
 {error&&<div className="alert alert--error form-grid__full">{error}</div>}
 <label className="form-grid__full">Nombre<input required maxLength={120} value={kind==='movies'?form.titulo:form.nombre} onChange={e=>change(kind==='movies'?'titulo':'nombre',e.target.value)}/></label>
 {kind==='categories'?<label className="form-grid__full">Identificador<input required pattern="[a-z0-9-]+" placeholder="deportes" value={form.slug} onChange={e=>change('slug',e.target.value)}/></label>:<>
 <label>Categoría<select value={form.category_id||''} onChange={e=>change('category_id',e.target.value)}><option value="">Sin categoría</option>{categories.map(c=><option value={c.id} key={c.id}>{c.nombre}{c.activo?'':' (oculta)'}</option>)}</select></label>
 <label>Protección<select value={form.drm_type||'none'} onChange={e=>change('drm_type',e.target.value)}><option value="none">Sin DRM</option><option value="widevine">Widevine</option></select></label>
 <label className="form-grid__full">URL del video o canal<input type="url" placeholder="https://…/manifest.mpd" value={form.manifest_url||''} onChange={e=>change('manifest_url',e.target.value)}/></label>
 {form.drm_type==='widevine'&&<><label className="form-grid__full">URL de licencia para clientes<input required type="url" value={form.license_url||''} onChange={e=>change('license_url',e.target.value)}/></label><small className="form-grid__full">Usa una URL apta para el reproductor. Los secretos maestros deben gestionarse en el servidor del proveedor.</small></>}
 <label className="form-grid__full">Logo o portada (HTTPS)<input type="url" value={(kind==='movies'?form.poster_url:form.logo_url)||''} onChange={e=>change(kind==='movies'?'poster_url':'logo_url',e.target.value)}/></label></>}
 <label className="checkbox-field form-grid__full"><input type="checkbox" checked={form.activo} onChange={e=>change('activo',e.target.checked)}/>Visible en la app</label>
 <div className="form-actions form-grid__full"><button type="button" className="secondary-button" disabled={saving} onClick={()=>setForm(null)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving?'Guardando…':'Guardar'}</button></div>
 </form></Modal>}
 {importer&&<Modal wide title="Importar canales de iptv-org" onClose={()=>!importing&&setImporter(null)}>
  <label className="import-country">País<select value={importer.countryCode} disabled={importing||!importer.countries.length} onChange={e=>void loadCountryPreview(e.target.value,importer.countries)}>{importer.countries.map(country=><option key={country.code} value={country.code}>{country.flag} {country.name}</option>)}</select></label>
  {importer.loading?<div className="loading-panel">Descargando la lista del país seleccionado…</div>:<>
   {importError&&<div className="alert alert--error">{importError}</div>}
   {importer.summary&&<div className="import-summary"><span><strong>{importer.summary.total}</strong>Total</span><span><strong>{importer.summary.importable}</strong>Importables</span><span><strong>{importer.summary.existing}</strong>Ya agregados</span><span><strong>{importer.summary.incompatible}</strong>Sin HTTPS</span></div>}
   {importer.source&&<p className="import-note">Se importarán únicamente los canales seleccionados que respondan a la comprobación, hasta {importer.limits?.maxSelection||50} por lote. Fuente: <a href={importer.source.url} target="_blank" rel="noreferrer">{importer.source.name}</a>. Verifica que cuentas con autorización para ofrecer cada señal.</p>}
   {importer.items?.length?<div className="import-table table-wrap"><table><thead><tr><th><input aria-label="Seleccionar los primeros canales disponibles" type="checkbox" checked={selected.size>0&&selected.size===Math.min(importer.items.filter(item=>item.compatible&&!item.existing).length,importer.limits?.maxSelection||50)} onChange={e=>setSelected(new Set(e.target.checked?importer.items.filter(item=>item.compatible&&!item.existing).slice(0,importer.limits?.maxSelection||50).map(item=>item.sourceId):[]))}/></th><th>Canal</th><th>Servidor</th><th>Estado</th></tr></thead><tbody>{importer.items.map(item=>{
    const disabled=!item.compatible||item.existing;const limitReached=!selected.has(item.sourceId)&&selected.size>=(importer.limits?.maxSelection||50);return <tr key={item.sourceId}><td data-label="Elegir"><input aria-label={`Seleccionar ${item.name}`} type="checkbox" disabled={disabled||limitReached} checked={selected.has(item.sourceId)} onChange={()=>toggleChannel(item.sourceId)}/></td><td data-label="Canal"><strong>{item.name}</strong>{item.hasCustomHeaders&&<small className="import-detail">Incluye cabeceras de reproducción</small>}</td><td data-label="Servidor">{item.manifestHost||'—'}</td><td data-label="Estado"><span className={`status-pill ${item.existing?'status-pill--muted':item.compatible?'status-pill--ok':'status-pill--fallido'}`}>{item.existing?'Ya agregado':item.compatible?'Listo para comprobar':'No compatible'}</span></td></tr>;
   })}</tbody></table></div>:!importError&&<div className="empty-inline">No se encontraron canales en la lista.</div>}
   <div className="form-actions import-actions"><button type="button" className="secondary-button" disabled={importing} onClick={()=>setImporter(null)}>Cancelar</button><button type="button" className="primary-button" disabled={importing||selected.size===0} onClick={importChannels}>{importing?'Comprobando e importando…':`Comprobar e importar (${selected.size})`}</button></div>
  </>}
 </Modal>}</>;
}
