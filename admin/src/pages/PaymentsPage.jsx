import { useEffect,useState } from "react";
import api from "../services/api";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
export default function PaymentsPage(){
 const [rows,setRows]=useState([]),[error,setError]=useState("");
 useEffect(()=>{api.get("/admin/v2/payments").then(r=>setRows(r.data.data||[])).catch(e=>setError(e.response?.data?.message||"Error"))},[]);
 return <><PageHeader title="Pagos" description="Historial de cobros confirmados"/>
 {error?<div className="alert error">{error}</div>:null}
 <section className="panel-card"><DataTable rows={rows} columns={[
  {key:"usuario_nombre",label:"Usuario"},{key:"usuario_email",label:"Correo"},
  {key:"monto",label:"Monto",render:r=>Number(r.monto).toLocaleString("es-PY")+" "+r.moneda},
  {key:"metodo",label:"Método"},{key:"estado",label:"Estado"},
  {key:"fecha_pago",label:"Fecha",render:r=>new Date(r.fecha_pago).toLocaleString()}
 ]}/></section></>;
}
