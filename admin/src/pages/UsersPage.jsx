import { Plus, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import api, { apiError } from "../services/api";

const emptyForm = {
  nombre: "",
  email: "",
  password: "",
  telefono: "",
  rol: "cliente",
  estado: "activo",
  consentimientoWhatsapp: false
};

export default function UsersPage() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
    try {
      await api.post("/admin/v2/users", form);
      setOpen(false);
      setForm(emptyForm);
      setNotice("Cliente creado correctamente.");
      await load();
    } catch (saveError) {
      setError(apiError(saveError, "No se pudo guardar"));
    }
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

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Clientes y accesos"
        description="Usuarios, datos de contacto y consentimiento de WhatsApp."
        action={
          <button type="button" className="primary-button" onClick={() => setOpen(true)}>
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
            <button type="button" className="mini-button" onClick={() => toggleConsent(user)}>
              {user.whatsapp_opt_in_at ? "Quitar permiso" : "Registrar permiso"}
            </button>
          )}
        />
      </section>

      {open ? (
        <Modal title="Nuevo cliente" onClose={() => setOpen(false)}>
          <form className="form-grid" onSubmit={save}>
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
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </label>
            <label>
              Contraseña temporal *
              <input
                type="password"
                minLength="6"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
              />
            </label>
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
                onChange={(event) => setForm({ ...form, rol: event.target.value })}
              >
                <option value="cliente">Cliente</option>
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
              <button className="primary-button">Guardar cliente</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
