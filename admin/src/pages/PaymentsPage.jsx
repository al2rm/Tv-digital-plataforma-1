import { CircleDollarSign } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import api, { apiError } from "../services/api";

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

  useEffect(() => {
    api.get("/admin/v2/payments")
      .then((response) => setRows(response.data.data || []))
      .catch((loadError) =>
        setError(apiError(loadError, "No se pudieron cargar los pagos"))
      );
  }, []);

  const openPayment = async () => {
    try { const r = await api.get("/admin/v2/users"); setUsers(r.data.data); setError(""); setForm({userId:"",monto:"",metodo:"transferencia",referencia:"",nota:""}); }
    catch(e) { setError(apiError(e)); }
  };
  const save = async event => {
    event.preventDefault(); setSaving(true); setError("");
    try { await api.post("/admin/v2/payments", form); setForm(null); setNotice("Pago registrado."); const r=await api.get("/admin/v2/payments");setRows(r.data.data); }
    catch(e){setError(apiError(e));} finally{setSaving(false);}
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
                new Date(payment.fecha_pago).toLocaleString("es-PY")
            }
          ]}
        />
      </section>
      {form && <Modal title="Registrar pago" onClose={()=>!saving && setForm(null)}><form className="form-grid" onSubmit={save}>
        {error && <div className="alert alert--error form-grid__full">{error}</div>}
        <label className="form-grid__full">Cliente<select required value={form.userId} onChange={e=>setForm({...form,userId:e.target.value})}><option value="">Seleccionar</option>{users.filter(u=>u.rol==='cliente').map(u=><option key={u.id} value={u.id}>{u.nombre}</option>)}</select></label>
        <label>Monto (Gs.)<input required min="1" type="number" step="1" value={form.monto} onChange={e=>setForm({...form,monto:e.target.value})}/></label>
        <label>Método<select value={form.metodo} onChange={e=>setForm({...form,metodo:e.target.value})}><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="giro">Giro</option></select></label>
        <label>Referencia<input maxLength={160} value={form.referencia} onChange={e=>setForm({...form,referencia:e.target.value})}/></label>
        <label>Nota<input maxLength={2000} value={form.nota} onChange={e=>setForm({...form,nota:e.target.value})}/></label>
        <p className="form-grid__full">Este registro guarda el cobro; la suscripción se activa o renueva desde Suscripciones.</p>
        <button className="primary-button form-grid__full" disabled={saving}>{saving?'Guardando…':'Guardar pago'}</button>
      </form></Modal>}
    </>
  );
}
