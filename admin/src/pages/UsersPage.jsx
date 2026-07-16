import { useEffect, useState } from "react";
import api from "../services/api";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";

const empty={nombre:"",email:"",password:"",telefono:"",rol:"cliente",estado:"activo"};
export default function UsersPage(){
  const [rows,setRows]=useState([]),[search,setSearch]=useState(""),[form,setForm]=useState(empty);
  const [open,setOpen]=useState(false),[error,setError]=useState("");
  const load=()=>api.get("/admin/v2/users",{params:{search}}).then(r=>setRows(r.data.data||[])).catch(e=>setError(e.response?.data?.message||"Error"));
  useEffect(()=>{load()},[]);
  const save=async e=>{e.preventDefault();try{await api.post("/admin/v2/users",form);setOpen(false);setForm(empty);load()}catch(e){setError(e.response?.data?.message||"No se pudo guardar")}};
  return <>
    <PageHeader title="Usuarios" description="Clientes, administradores y accesos" action={<button className="primary-button" onClick={()=>setOpen(true)}>Nuevo usuario</button>}/>
    <div className="toolbar"><input placeholder="Buscar nombre o correo" value={search} onChange={e=>setSearch(e.target.value)}/><button className="secondary-button" onClick={load}>Buscar</button></div>
    {error?<div className="alert error">{error}</div>:null}
    <section className="panel-card"><DataTable rows={rows} columns={[
      {key:"nombre",label:"Nombre"},{key:"email",label:"Correo"},{key:"telefono",label:"Teléfono"},{key:"rol",label:"Rol"},{key:"estado",label:"Estado"}
    ]}/></section>
    {open?<Modal title="Nuevo usuario" onClose={()=>setOpen(false)}><form className="form-grid" onSubmit={save}>
      {['nombre','email','password','telefono'].map(k=><label key={k}>{k}<input type={k==='password'?'password':'text'} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} required={k!=='telefono'}/></label>)}
      <label>Rol<select value={form.rol} onChange={e=>setForm({...form,rol:e.target.value})}><option value="cliente">Cliente</option><option value="admin">Administrador</option></select></label>
      <button className="primary-button">Guardar</button>
    </form></Modal>:null}
  </>;
}
