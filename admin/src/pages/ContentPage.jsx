import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Tv, Film, Layers } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import api, { apiError } from '../services/api';
const kinds={live_channels:'TV en vivo',movies:'Películas',categories:'Categorías'};
const blank={nombre:'',titulo:'',category_id:'',manifest_url:'',license_url:'',drm_type:'none',logo_url:'',poster_url:'',slug:'',tipo:'general',activo:true};
export default function ContentPage(){
 const [kind,setKind]=useState('live_channels'),[rows,setRows]=useState([]),[categories,setCategories]=useState([]),[form,setForm]=useState(null),[error,setError]=useState(''),[saving,setSaving]=useState(false),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{try{const [r,c]=await Promise.all([api.get(`/admin/v2/content/${kind}`),api.get('/admin/v2/content/categories')]);setRows(r.data.data);setCategories(c.data.data);}catch(e){setError(apiError(e));}},[kind]);
 useEffect(()=>{setRows([]);setError('');void load();},[load]);
 const change=(key,value)=>setForm({...form,[key]:value});
 const save=async e=>{e.preventDefault();setSaving(true);setError('');try{
  const data=kind==='categories'?{nombre:form.nombre,slug:form.slug,tipo:'general',activo:form.activo}:{category_id:form.category_id?Number(form.category_id):null,manifest_url:form.manifest_url||null,license_url:form.drm_type==='widevine'?form.license_url:null,drm_type:form.drm_type,activo:form.activo,...(kind==='movies'?{titulo:form.titulo,poster_url:form.poster_url||null}:{nombre:form.nombre,logo_url:form.logo_url||null})};
  if(form.id)await api.put(`/admin/v2/content/${kind}/${form.id}`,data);else await api.post(`/admin/v2/content/${kind}`,data);
  setForm(null);setNotice('Catálogo actualizado. Los cambios ya están disponibles para la app.');await load();
 }catch(err){setError(apiError(err));}finally{setSaving(false);}};
 return <><PageHeader eyebrow="App Android" title="Tu catálogo" description="Administra las categorías, canales y películas que verán tus clientes." action={<button className="primary-button" onClick={()=>{setError('');setForm({...blank});}}><Plus size={18}/>Agregar</button>}/>
 {notice&&<div className="alert alert--success">{notice}</div>}{error&&!form&&<div className="alert alert--error">{error}</div>}
 <div className="toolbar">{Object.entries(kinds).map(([key,title])=><button key={key} className={kind===key?'primary-button':'secondary-button'} onClick={()=>setKind(key)}>{key==='live_channels'?<Tv size={18}/>:key==='movies'?<Film size={18}/>:<Layers size={18}/>} {title}</button>)}</div>
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
 </form></Modal>}</>;
}
