import { CircleDollarSign, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import DeleteConfirmationModal from "../components/DeleteConfirmationModal";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import api, { apiError } from "../services/api";
import { BUSINESS_TIME_ZONE, toDateTimeLocal } from "../utils/date";

const money = (value, currency = "PYG") =>
  new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value || 0));

export default function PaymentsPage() {
  const [form, setForm] = useState(null);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.get("/admin/v2/payments");
      setRows(response.data.data || []);
    } catch (loadError) {
      setError(apiError(loadError, "No se pudieron cargar los pagos"));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openPayment = async () => {
    try { const r = await api.get("/admin/v2/users"); setUsers(r.data.data); setError(""); setForm({userId:"",monto:"",metodo:"transferencia",estado:"confirmado",referencia:"",nota:"",fechaPago:""}); }
    catch(e) { setError(apiError(e)); }
  };
  const openEdit = async (payment) => {
    try {
      const r = users.length ? null : await api.get("/admin/v2/users");
      if (r) setUsers(r.data.data || []);
      setError("");
      setForm({
        id: payment.id,
        userId: String(payment.user_id),
        monto: String(payment.monto),
        metodo: payment.metodo,
        estado: payment.estado,
        referencia: payment.referencia || "",
        nota: payment.nota || "",
        fechaPago: toDateTimeLocal(payment.fecha_pago)
      });
    } catch (e) { setError(apiError(e)); }
  };
  const save = async event => {
    event.preventDefault(); setSaving(true); setError("");
    try { if(form.id)await api.put(`/admin/v2/payments/${form.id}`,form);else await api.post("/admin/v2/payments", form); setForm(null); setNotice(form.id?"Pago actualizado.":"Pago registrado."); await load(); }
    catch(e){setError(apiError(e));} finally{setSaving(false);}
  };
  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true); setError("");
    try {
      await api.delete(`/admin/v2/payments/${deleteTarget.id}`);
      setNotice("Pago eliminado del historial.");
      setDeleteTarget(null);
      await load();
    } catch (e) { setError(apiError(e, "No se pudo eliminar el pago")); }
    finally { setDeleting(false); }
  };
  const total = useMemo(
    () =>
      rows
        .filter((payment) => payment.estado === "confirmado")
        .reduce((sum, payment) => sum + Number(payment.monto || 0), 0),
    [rows]
  );

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Pagos"
        description="Historial de cobros registrados y renovaciones confirmadas."
        action={<button className="primary-button" onClick={openPayment}>Registrar pago</button>}
      />
      {notice && <div className="alert alert--success">{notice}</div>}
      {error ? <div className="alert alert--error">{error}</div> : null}

      <section className="stats-grid stats-grid--compact">
        <StatCard
          label="Total registrado"
          value={money(total)}
          helper={`${rows.length} pagos`}
          icon={CircleDollarSign}
          tone="green"
        />
      </section>

      <section className="panel-card panel-card--table">
        <DataTable
          rows={rows}
          columns={[
            { key: "usuario_nombre", label: "Cliente" },
            {
              key: "monto",
              label: "Monto",
              render: (payment) => (
                <strong>{money(payment.monto, payment.moneda)}</strong>
              )
            },
            { key: "metodo", label: "Método" },
            {
              key: "estado",
              label: "Estado",
              render: (payment) => (
                <span className={`status-pill ${payment.estado === "confirmado" ? "status-pill--ok" : "status-pill--muted"}`}>
                  {payment.estado}
                </span>
              )
            },
            {
              key: "fecha_pago",
              label: "Fecha",
              render: (payment) =>
                new Date(payment.fecha_pago).toLocaleString("es-PY", { timeZone: BUSINESS_TIME_ZONE })
            }
          ]}
          actions={(payment) => <><button type="button" className="mini-button" onClick={() => void openEdit(payment)}><Pencil size={15}/>Editar</button><button type="button" className="mini-button mini-button--danger" onClick={() => { setError(""); setDeleteTarget(payment); }}><Trash2 size={15}/>Eliminar</button></>}
        />
      </section>
      {form && <Modal title={form.id?"Editar pago":"Registrar pago"} onClose={()=>!saving && setForm(null)}><form className="form-grid" onSubmit={save}>
        {error && <div className="alert alert--error form-grid__full">{error}</div>}
        <label className="form-grid__full">Cliente<select required value={form.userId} onChange={e=>setForm({...form,userId:e.target.value})}><option value="">Seleccionar</option>{users.filter(u=>u.rol==='cliente').map(u=><option key={u.id} value={u.id}>{u.nombre}</option>)}</select></label>
        <label>Monto (Gs.)<input required min="1" type="number" step="1" value={form.monto} onChange={e=>setForm({...form,monto:e.target.value})}/></label>
        <label>Método<select value={form.metodo} onChange={e=>setForm({...form,metodo:e.target.value})}><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="giro">Giro</option></select></label>
        <label>Referencia<input maxLength={160} value={form.referencia} onChange={e=>setForm({...form,referencia:e.target.value})}/></label>
        <label>Nota<input maxLength={2000} value={form.nota} onChange={e=>setForm({...form,nota:e.target.value})}/></label>
        {form.id&&<><label>Estado<select value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}><option value="pendiente">Pendiente</option><option value="confirmado">Confirmado</option><option value="rechazado">Rechazado</option><option value="reembolsado">Reembolsado</option></select></label><label>Fecha y hora<input type="datetime-local" required value={form.fechaPago} onChange={e=>setForm({...form,fechaPago:e.target.value})}/></label></>}
        <p className="form-grid__full">Este registro guarda el cobro; la suscripción se activa o renueva desde Suscripciones.</p>
        <div className="form-actions form-grid__full"><button type="button" className="secondary-button" disabled={saving} onClick={()=>setForm(null)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving?'Guardando…':'Guardar pago'}</button></div>
      </form></Modal>}
      {deleteTarget&&<DeleteConfirmationModal title="Eliminar pago" name={`${deleteTarget.usuario_nombre} · ${money(deleteTarget.monto,deleteTarget.moneda)}`} description="El total registrado se recalculará. Esta acción no modifica automáticamente la suscripción del cliente." deleting={deleting} error={error} onCancel={()=>setDeleteTarget(null)} onConfirm={()=>void remove()}/>}
    </>
  );
}
