import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import DataTable from "../components/DataTable";
import DeleteConfirmationModal from "../components/DeleteConfirmationModal";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import api, { apiError } from "../services/api";

const emptyPlan = { nombre: "", slug: "", meses: 1, precio: "", activo: true };

export default function ConnectionPage() {
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.get("/admin/v2/plans");
      setPlans(response.data.data || []);
    } catch (loadError) {
      setError(apiError(loadError, "No se pudieron cargar los planes"));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const base = new URL(api.defaults.baseURL, window.location.origin);
  base.pathname = base.pathname.replace(/\/api\/?$/, "/");

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (form.id) await api.put(`/admin/v2/plans/${form.id}`, form);
      else await api.post("/admin/v2/plans", form);
      setNotice(form.id ? "Plan actualizado." : "Plan creado.");
      setForm(null);
      await load();
    } catch (saveError) {
      setError(apiError(saveError, "No se pudo guardar el plan"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError("");
    try {
      await api.delete(`/admin/v2/plans/${deleteTarget.id}`);
      setNotice(`Plan “${deleteTarget.nombre}” eliminado.`);
      setDeleteTarget(null);
      await load();
    } catch (deleteError) {
      setError(apiError(deleteError, "No se pudo eliminar el plan"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Configuración" title="App y proveedor" description="Conecta tu aplicación y administra los planes comerciales." />
      {error && !form && !deleteTarget ? <div className="alert alert--error">{error}</div> : null}
      {notice ? <div className="alert alert--success" onClick={() => setNotice("")}>{notice}</div> : null}
      <div className="connection-grid">
        <section className="panel-card">
          <span className="status-pill status-pill--ok">Plataforma propia</span>
          <h2>Tu app Android</h2>
          <p>En la app, escribe esta dirección del servidor. El correo y la contraseña son los del cliente creado en este panel.</p>
          <input aria-label="Dirección del servidor" readOnly value={base.href} />
          <p>Activa una suscripción y agrega contenido en Catálogo para habilitar la reproducción.</p>
        </section>
        <section className="panel-card">
          <span className="status-pill status-pill--muted">Gestión manual</span>
          <h2>LumixTV</h2>
          <p>Las cuentas, créditos y renovaciones de LumixTV se gestionan en el panel del proveedor. Esta plataforma todavía no los sincroniza.</p>
          <a className="secondary-button" href="https://users.lumixtv.es/login.php" target="_blank" rel="noreferrer">Abrir panel del proveedor</a>
          <p>Para conectarlo automáticamente necesitamos documentación de su API, acceso de integración y el contrato de reproducción.</p>
        </section>
      </div>
      <section className="panel-card panel-card--table">
        <div className="panel-heading panel-heading--padded">
          <div><span className="eyebrow">Configuración comercial</span><h2>Planes</h2></div>
          <button type="button" className="primary-button" onClick={() => { setError(""); setForm(emptyPlan); }}><Plus size={17}/>Nuevo plan</button>
        </div>
        <DataTable
          rows={plans}
          columns={[
            { key: "nombre", label: "Plan" },
            { key: "meses", label: "Duración", render: (plan) => `${plan.meses} mes(es)` },
            { key: "precio", label: "Precio", render: (plan) => `${Number(plan.precio || 0).toLocaleString("es-PY")} Gs.` },
            { key: "activo", label: "Estado", render: (plan) => <span className={`status-pill ${plan.activo ? "status-pill--ok" : "status-pill--muted"}`}>{plan.activo ? "Activo" : "Oculto"}</span> }
          ]}
          actions={(plan) => <><button type="button" className="mini-button" onClick={() => { setError(""); setForm({ ...plan }); }}><Pencil size={15}/>Editar</button><button type="button" className="mini-button mini-button--danger" onClick={() => { setError(""); setDeleteTarget(plan); }}><Trash2 size={15}/>Eliminar</button></>}
        />
      </section>
      {form ? (
        <Modal title={form.id ? "Editar plan" : "Nuevo plan"} onClose={() => !saving && setForm(null)}>
          <form className="form-grid" onSubmit={save}>
            {error ? <div className="alert alert--error form-grid__full">{error}</div> : null}
            <label>Nombre<input required maxLength="100" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })}/></label>
            {!form.id ? <label>Identificador<input required maxLength="80" pattern="[a-z0-9-]+" placeholder="mensual-premium" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}/></label> : null}
            <label>Duración (meses)<input required type="number" min="1" max="120" step="1" value={form.meses} onChange={(event) => setForm({ ...form, meses: event.target.value })}/></label>
            <label>Precio (Gs.)<input required type="number" min="0" step="1" value={form.precio} onChange={(event) => setForm({ ...form, precio: event.target.value })}/></label>
            <label className="checkbox-field form-grid__full"><input type="checkbox" checked={Boolean(form.activo)} onChange={(event) => setForm({ ...form, activo: event.target.checked })}/>Disponible para nuevas suscripciones</label>
            <div className="form-actions form-grid__full"><button type="button" className="secondary-button" disabled={saving} onClick={() => setForm(null)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? "Guardando…" : "Guardar plan"}</button></div>
          </form>
        </Modal>
      ) : null}
      {deleteTarget ? <DeleteConfirmationModal title="Eliminar plan" name={deleteTarget.nombre} description="Solo se puede eliminar si nunca fue usado. Si ya tiene suscripciones, desactívalo desde Editar para conservar el historial." deleting={deleting} error={error} onCancel={() => setDeleteTarget(null)} onConfirm={() => void remove()}/> : null}
    </>
  );
}
