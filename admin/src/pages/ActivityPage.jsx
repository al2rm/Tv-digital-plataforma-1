import { useCallback, useEffect, useState } from 'react';
import { Download, History, RotateCcw, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import api,{apiError} from '../services/api';

const itemName=item=>item.snapshot?.nombre||item.snapshot?.titulo||item.snapshot?.email||`#${item.entity_id}`;
const date=value=>new Date(value).toLocaleString('es-PY',{dateStyle:'short',timeStyle:'short'});

export default function ActivityPage(){
 const [tab,setTab]=useState('trash'),[trash,setTrash]=useState([]),[activity,setActivity]=useState([]),[target,setTarget]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{try{const [bin,log]=await Promise.all([api.get('/admin/v2/recycle-bin'),api.get('/admin/v2/activity')]);setTrash(bin.data.data);setActivity(log.data.data);setError('');}catch(e){setError(apiError(e));}},[]);
 useEffect(()=>{void load();},[load]);
 const backup=async()=>{setBusy(true);try{const response=await api.get('/admin/v2/backup',{responseType:'blob'});const url=URL.createObjectURL(response.data);const link=document.createElement('a');link.href=url;link.download=`tv-digital-backup-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(url);setNotice('Copia de seguridad descargada. Guárdala en un lugar privado.');}catch(e){setError(apiError(e));}finally{setBusy(false);}};
 const restore=async item=>{setBusy(true);try{await api.post(`/admin/v2/recycle-bin/${item.id}/restore`);setNotice(`${item.entity_label} “${itemName(item)}” restaurado.`);setTarget(null);await load();}catch(e){setError(apiError(e));}finally{setBusy(false);}};
 const purge=async()=>{setBusy(true);try{await api.delete(`/admin/v2/recycle-bin/${target.id}`);setNotice('El registro se eliminó definitivamente de la papelera.');setTarget(null);await load();}catch(e){setError(apiError(e));}finally{setBusy(false);}};
 return <><PageHeader eyebrow="Control administrativo" title="Actividad y papelera" description="Recupera registros eliminados y revisa quién realizó cada cambio." action={<button className="primary-button" disabled={busy} onClick={()=>void backup()}><Download size={18}/>Descargar copia</button>}/>
 {notice&&<div className="alert alert--success">{notice}</div>}{error&&<div className="alert alert--error">{error}</div>}
 <div className="toolbar"><button className={tab==='trash'?'primary-button':'secondary-button'} onClick={()=>setTab('trash')}><Trash2 size={18}/>Papelera ({trash.length})</button><button className={tab==='activity'?'primary-button':'secondary-button'} onClick={()=>setTab('activity')}><History size={18}/>Historial</button></div>
 {tab==='trash'?<section className="panel-card panel-card--table"><DataTable rows={trash} columns={[{key:'entity_label',label:'Tipo'},{key:'name',label:'Registro',render:item=><strong>{itemName(item)}</strong>},{key:'deleted_at',label:'Eliminado',render:item=>date(item.deleted_at)}]} actions={item=><><button className="mini-button" onClick={()=>void restore(item)} disabled={busy}><RotateCcw size={15}/>Restaurar</button><button className="mini-button mini-button--danger" onClick={()=>setTarget(item)}><Trash2 size={15}/>Eliminar definitivamente</button></>}/>{!trash.length&&<div className="empty-inline">La papelera está vacía.</div>}</section>:
 <section className="panel-card panel-card--table"><DataTable rows={activity} columns={[{key:'user_name',label:'Usuario',render:item=>item.user_name||'Sistema'},{key:'action',label:'Acción'},{key:'resource',label:'Sección'},{key:'created_at',label:'Fecha',render:item=>date(item.created_at)}]}/>{!activity.length&&<div className="empty-inline">Todavía no hay modificaciones registradas.</div>}</section>}
 {target&&<Modal title="Eliminar definitivamente" onClose={()=>!busy&&setTarget(null)}><p>“{itemName(target)}” ya no podrá recuperarse.</p><div className="form-actions"><button className="secondary-button" onClick={()=>setTarget(null)} disabled={busy}>Cancelar</button><button className="danger-button" onClick={()=>void purge()} disabled={busy}>{busy?'Eliminando…':'Eliminar definitivamente'}</button></div></Modal>}
 </>;
}
