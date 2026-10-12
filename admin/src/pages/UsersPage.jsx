import { Plus, Search, Pencil, Trash2, Monitor, Unplug } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import DataTable from "../components/DataTable";
import DeleteConfirmationModal from "../components/DeleteConfirmationModal";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import api, { apiError } from "../services/api";
import { useAuth } from "../context/AuthContext";

const emptyForm = {
  nombre: "",
  email: "",
  password: "",
  telefono: "",
  rol: "cliente",
  estado: "activo",
  consentimientoWhatsapp: false,
  parentalPin: "",
  maxDevices: 1
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [devicesFor, setDevicesFor] = useState(null);
  const [devices, setDevices] = useState([]);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await api.get("/admin/v2/users", {
        params: { search }
      });
      setRows(response.data.data || []);
    } catch (loadError) {
      setError(apiError(loadError, "No se pudieron cargar los clientes"));
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (form.id) await api.put(`/admin/v2/users/${form.id}`, form);
      else await api.post("/admin/v2/users", form);
      setOpen(false);
      setForm(emptyForm);
      setNotice("Cliente guardado correctamente.");
      await load();
    } catch (saveError) {
      setError(apiError(saveError, "No se pudo guardar"));
    } finally { setSaving(false); }
  };

  const toggleConsent = async (user) => {
    try {
      await api.put(`/admin/v2/users/${user.id}`, {
        consentimientoWhatsapp: !user.whatsapp_opt_in_at
      });
      await load();
    } catch (updateError) {
      setError(apiError(updateError, "No se pudo actualizar el permiso"));
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError("");
    try {
      await api.delete(`/admin/v2/users/${deleteTarget.id}`);
      setNotice(`Cliente “${deleteTarget.nombre}” eliminado.`);
      setDeleteTarget(null);
      await load();
    } catch (deleteError) {
      setError(apiError(deleteError, "No se pudo eliminar el cliente"));
    } finally {
      setDeleting(false);
    }
  };

  const openDevices = async (user) => {
    setError("");
    try {
      const response = await api.get("/admin/v2/operations/devices", { params: { userId: user.id } });
      setDevices(response.data.data || []);
      setDevicesFor(user);
    } catch (loadError) { setError(apiError(loadError, "No se pudieron cargar los dispositivos")); }
  };

  const releaseDevice = async (device) => {
    try {
      await api.delete(`/admin/v2/operations/devices/${device.id}`);
      setDevices((current) => current.filter((item) => item.id !== device.id));
      setNotice(`Dispositivo “${device.device_name}” liberado.`);
      await load();
    } catch (removeError) { setError(apiError(removeError, "No se pudo liberar el dispositivo")); }
  };

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Clientes y accesos"
        description="Usuarios, datos de contacto y consentimiento de WhatsApp."
        action={
          <button type="button" className="primary-button" onClick={() => { setForm(emptyForm); setError(""); setOpen(true); }}>
            <Plus size={18} />
            Nuevo cliente
          </button>
        }
      />

      {error ? <div className="alert alert--error">{error}</div> : null}
      {notice ? (
        <div className="alert alert--success" onClick={() => setNotice("")}>
          {notice}
        </div>
      ) : null}

      <div className="toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            placeholder="Buscar nombre o correo"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      <section className="panel-card panel-card--table">
        <DataTable
          rows={rows}
          columns={[
            {
              key: "nombre",
              label: "Cliente",
              render: (user) => (
                <div className="contact-cell">
                  <span>{user.nombre[0]?.toUpperCase()}</span>
                  <div>
                    <strong>{user.nombre}</strong>
                    <small>{user.email}</small>
                  </div>
                </div>
              )
            },
            { key: "telefono", label: "WhatsApp" },
            {
              key: "rol",
              label: "Tipo",
              render: (user) => (
                <span className="status-pill status-pill--blue">{user.rol}</span>
              )
            },
            {
              key: "estado",
              label: "Estado",
              render: (user) => (
                <span className={`status-pill ${user.estado === "activo" ? "status-pill--ok" : "status-pill--muted"}`}>
                  {user.estado}
                </span>
              )
            },
            {
              key: "active_devices",
              label: "Dispositivos",
              render: (user) => <span>{user.active_devices || 0} / {user.max_devices || 1}</span>
            },
            {
              key: "whatsapp_opt_in_at",
              label: "Permiso WhatsApp",
              render: (user) => (
                <span className={`status-pill ${user.whatsapp_opt_in_at ? "status-pill--ok" : "status-pill--muted"}`}>
                  {user.whatsapp_opt_in_at ? "Autorizado" : "Pendiente"}
                </span>
              )
            }
          ]}
          actions={(user) => (
            <div className="button-row"><button className="mini-button" onClick={() => { setForm({...emptyForm,...user,maxDevices:user.max_devices||1,consentimientoWhatsapp:Boolean(user.whatsapp_opt_in_at)}); setError(""); setOpen(true); }}><Pencil size={15}/>Editar</button>
            <button type="button" className="mini-button" onClick={() => toggleConsent(user)}>
              {user.whatsapp_opt_in_at ? "Quitar permiso" : "Registrar permiso"}
            </button>
            <button type="button" className="mini-button" onClick={() => void openDevices(user)}><Monitor size={15}/>Dispositivos</button>
            {currentUser?.rol==='admin'&&<button type="button" className="mini-button mini-button--danger" onClick={() => { setError(""); setDeleteTarget(user); }}>
              <Trash2 size={15}/>Eliminar
            </button>}</div>
          )}
        />
      </section>

      {open ? (
        <Modal title={form.id ? "Editar cliente" : "Nuevo cliente"} onClose={() => !saving && setOpen(false)}>
          <form className="form-grid" onSubmit={save}>
            {error && <div className="alert alert--error form-grid__full">{error}</div>}
            <label>
              Nombre *
              <input
                value={form.nombre}
                onChange={(event) => setForm({ ...form, nombre: event.target.value })}
                required
              />
            </label>
            <label>
              Correo *
              <input
                type="email"
                disabled={Boolean(form.id)}
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </label>
            {!form.id && <label>
              Contraseña temporal *
              <input
                type="password"
                minLength="6"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
              />
            </label>}
            <label>
              WhatsApp
              <input
                value={form.telefono}
                onChange={(event) => setForm({ ...form, telefono: event.target.value })}
                placeholder="0984 060 513"
              />
            </label>
            <label>
              Rol
              <select
                value={form.rol}
                disabled={currentUser?.rol!=='admin'}
                onChange={(event) => setForm({ ...form, rol: event.target.value })}
              >
                <option value="cliente">Cliente</option>
                <option value="vendedor">Vendedor</option>
                <option value="soporte">Soporte</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <label>
              Estado
              <select
                value={form.estado}
                onChange={(event) => setForm({ ...form, estado: event.target.value })}
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="bloqueado">Bloqueado</option>
              </select>
            </label>
            <label>
              PIN parental
              <input inputMode="numeric" pattern="[0-9]{4}" maxLength="4" value={form.parentalPin||""} onChange={(event)=>setForm({...form,parentalPin:event.target.value.replace(/\D/g,"").slice(0,4)})} placeholder={form.parental_pin_configured?"Configurado · escribe para cambiar":"4 números"}/>
            </label>
            <label>
              Máximo de dispositivos
              <select value={form.maxDevices || form.max_devices || 1} onChange={(event)=>setForm({...form,maxDevices:Number(event.target.value)})}>
                {[1,2,3,4,5].map((amount)=><option key={amount} value={amount}>{amount}</option>)}
              </select>
            </label>
            <label className="checkbox-field form-grid__full">
              <input
                type="checkbox"
                checked={form.consentimientoWhatsapp}
                onChange={(event) =>
                  setForm({
                    ...form,
                    consentimientoWhatsapp: event.target.checked
                  })
                }
              />
              El cliente autorizó avisos de servicio por WhatsApp
            </label>
            <div className="form-actions form-grid__full">
              <button type="button" className="secondary-button" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button className="primary-button" disabled={saving}>{saving ? "Guardando…" : "Guardar cliente"}</button>
            </div>
          </form>
        </Modal>
      ) : null}
      {deleteTarget ? (
        <DeleteConfirmationModal
          title="Eliminar cliente"
          name={deleteTarget.nombre}
          description="Se eliminarán también sus suscripciones sin pagos. Si existe historial financiero, la aplicación te pedirá bloquear la cuenta en lugar de borrarla."
          deleting={deleting}
          error={error}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void remove()}
        />
      ) : null}
      {devicesFor ? (
        <Modal title={`Dispositivos de ${devicesFor.nombre}`} onClose={() => setDevicesFor(null)}>
          {devices.length ? <div className="device-list">{devices.map((device)=><div className="device-row" key={device.id}><div><strong>{device.device_name}</strong><small>{device.platform} · Último uso {new Date(device.last_seen_at).toLocaleString("es-PY")}</small></div><button type="button" className="mini-button mini-button--danger" onClick={()=>void releaseDevice(device)}><Unplug size={15}/>Liberar</button></div>)}</div> : <p className="muted-copy">Este cliente todavía no registró ningún televisor.</p>}
        </Modal>
      ) : null}
    </>
  );
}
