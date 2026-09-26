import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import api, { apiError } from '../services/api';
export default function ConnectionPage(){
 const [plans,setPlans]=useState([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[saving,setSaving]=useState(null);
 useEffect(()=>{api.get('/admin/v2/plans').then(r=>setPlans(r.data.data)).catch(e=>setError(apiError(e)));},[]);
 const base=new URL(api.defaults.baseURL,window.location.origin);base.pathname=base.pathname.replace(/\/api\/?$/,'/');
 const save=async plan=>{setSaving(plan.id);setError('');try{await api.put(`/admin/v2/plans/${plan.id}`,{precio:plan.precio});setNotice('Precio actualizado.');}catch(e){setError(apiError(e));}finally{setSaving(null);}};
 return <><PageHeader eyebrow="Configuración" title="App y proveedor" description="Conecta tu aplicación al panel y configura los precios de tus planes."/>
 {error&&<div className="alert alert--error">{error}</div>}{notice&&<div className="alert alert--success">{notice}</div>}
 <div className="connection-grid"><section className="panel-card"><span className="status-pill status-pill--ok">Plataforma propia</span><h2>Tu app Android</h2><p>En la app, escribe esta dirección del servidor. El correo y la contraseña son los del cliente creado en este panel.</p><input aria-label="Dirección del servidor" readOnly value={base.href}/><p>Activa una suscripción y agrega contenido en Catálogo para habilitar la reproducción.</p></section>
 <section className="panel-card"><span className="status-pill status-pill--muted">Gestión manual</span><h2>LumixTV</h2><p>Las cuentas, créditos y renovaciones de LumixTV se gestionan en el panel del proveedor. Esta plataforma todavía no los sincroniza.</p><a className="secondary-button" href="https://users.lumixtv.es/login.php" target="_blank" rel="noreferrer">Abrir panel del proveedor</a><p>Para conectarlo automáticamente necesitamos documentación de su API, acceso de integración y el contrato de reproducción.</p></section></div>
 <section className="panel-card"><h2>Precios en guaraníes</h2><div className="plan-price-grid">{plans.map(plan=><form key={plan.id} onSubmit={e=>{e.preventDefault();void save(plan);}}><label>{plan.nombre}<input aria-label={`Precio ${plan.nombre}`} type="number" min="0" step="1" required value={plan.precio} onChange={e=>setPlans(plans.map(p=>p.id===plan.id?{...p,precio:e.target.value}:p))}/></label><button className="secondary-button" disabled={saving!==null}>{saving===plan.id?'Guardando…':'Guardar precio'}</button></form>)}</div></section></>;
}
