import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import api, { apiError } from "../services/api";

const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (value) => {
  const dateOnly = String(value || "").slice(0, 10);
  return dateOnly
    ? new Date(`${dateOnly}T00:00:00`).toLocaleDateString("es-PY")
    : "-";
};

export default function SubscriptionsPage() {
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [renewing, setRenewing] = useState(null);
  const [createForm, setCreateForm] = useState({
    userId: "",
    planId: "",
    fechaInicio: today()
  });
  const [renewForm, setRenewForm] = useState({
    monto: "",
    metodo: "manual",
    referencia: ""
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [subscriptionsResponse, usersResponse, plansResponse] =
        await Promise.all([
          api.get("/admin/v2/subscriptions"),
          api.get("/admin/v2/users"),
          api.get("/admin/v2/plans")
        ]);
      setRows(subscriptionsResponse.data.data || []);
      setUsers(usersResponse.data.data || []);
      setPlans(plansResponse.data.data || []);
    } catch (loadError) {
      setError(apiError(loadError, "No se pudieron cargar las suscripciones"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createSubscription = async (event) => {
    event.preventDefault();
    try {
      const response = await api.post("/admin/v2/subscriptions", createForm);
      const reminders = response.data.data.reminders?.length || 0;
      setNotice(
        reminders
          ? `Suscripción creada con ${reminders} avisos programados.`
          : "Suscripción creada. No se programaron avisos porque falta teléfono o consentimiento."
      );
      setCreateOpen(false);
      await load();
    } catch (createError) {
      setError(apiError(createError, "No se pudo crear la suscripción"));
    }
  };

  const renew = async (event) => {
    event.preventDefault();
    try {
      const response = await api.post(
        `/admin/v2/subscriptions/${renewing.id}/renew`,
        renewForm
      );
      const confirmation = response.data.data.confirmation;
      setNotice(
        confirmation?.skipped
          ? `Renovación guardada. Mensaje omitido: ${confirmation.reason}`
          : "Renovación guardada y confirmación preparada."
      );
      setRenewing(null);
      await load();
    } catch (renewError) {
      setError(apiError(renewError, "No se pudo renovar"));
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Ciclo de clientes"
        title="Suscripciones"
        description="Activa, renueva y programa avisos automáticos de vencimiento."
        action={
          <button type="button" className="primary-button" onClick={() => setCreateOpen(true)}>
            <Plus size={18} />
            Nueva suscripción
          </button>
        }
      />

      {error ? <div className="alert alert--error">{error}</div> : null}
      {notice ? (
        <div className="alert alert--success" onClick={() => setNotice("")}>
          {notice}
        </div>
      ) : null}

      <section className="panel-card panel-card--table">
        <DataTable
          rows={rows}
          columns={[
            { key: "usuario_nombre", label: "Cliente" },
            { key: "plan_nombre", label: "Plan" },
            {
              key: "estado",
              label: "Estado",
              render: (subscription) => (
                <span className={`status-pill ${subscription.estado === "activa" ? "status-pill--ok" : "status-pill--muted"}`}>
                  {subscription.estado}
                </span>
              )
            },
            {
              key: "fecha_inicio",
              label: "Inicio",
              render: (subscription) => formatDate(subscription.fecha_inicio)
            },
            {
              key: "fecha_fin",
              label: "Vencimiento",
              render: (subscription) => formatDate(subscription.fecha_fin)
            }
          ]}
          actions={(subscription) => (
            <button
              type="button"
              className="mini-button mini-button--green"
              onClick={() => {
                setRenewing(subscription);
                setRenewForm({
                  monto: subscription.precio || "",
                  metodo: "manual",
                  referencia: ""
                });
              }}
            >
              <RefreshCw size={15} />
              Renovar
            </button>
          )}
        />
      </section>

      {createOpen ? (
        <Modal title="Nueva suscripción" onClose={() => setCreateOpen(false)}>
          <form className="form-grid" onSubmit={createSubscription}>
            <label className="form-grid__full">
              Cliente
              <select
                value={createForm.userId}
                onChange={(event) => setCreateForm({ ...createForm, userId: event.target.value })}
                required
              >
                <option value="">Seleccionar cliente</option>
                {users.filter((user) => user.rol === "cliente").map((user) => (
                  <option value={user.id} key={user.id}>
                    {user.nombre} — {user.telefono || "sin WhatsApp"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Plan
              <select
                value={createForm.planId}
                onChange={(event) => setCreateForm({ ...createForm, planId: event.target.value })}
                required
              >
                <option value="">Seleccionar plan</option>
                {plans.filter((plan) => plan.activo).map((plan) => (
                  <option value={plan.id} key={plan.id}>
                    {plan.nombre} — {plan.meses} mes(es)
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fecha de inicio
              <input
                type="date"
                value={createForm.fechaInicio}
                onChange={(event) => setCreateForm({ ...createForm, fechaInicio: event.target.value })}
                required
              />
            </label>
            <div className="form-actions form-grid__full">
              <button type="button" className="secondary-button" onClick={() => setCreateOpen(false)}>
                Cancelar
              </button>
              <button className="primary-button">Crear suscripción</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {renewing ? (
        <Modal title={`Renovar a ${renewing.usuario_nombre}`} onClose={() => setRenewing(null)}>
          <form className="form-grid" onSubmit={renew}>
            <label>
              Monto cobrado
              <input
                type="number"
                min="0"
                step="1"
                value={renewForm.monto}
                onChange={(event) => setRenewForm({ ...renewForm, monto: event.target.value })}
                placeholder="0"
              />
            </label>
            <label>
              Método
              <select
                value={renewForm.metodo}
                onChange={(event) => setRenewForm({ ...renewForm, metodo: event.target.value })}
              >
                <option value="manual">Manual</option>
                <option value="transferencia">Transferencia</option>
                <option value="giro">Giro</option>
                <option value="efectivo">Efectivo</option>
              </select>
            </label>
            <label className="form-grid__full">
              Referencia o nota
              <input
                value={renewForm.referencia}
                onChange={(event) => setRenewForm({ ...renewForm, referencia: event.target.value })}
              />
            </label>
            <div className="form-actions form-grid__full">
              <button type="button" className="secondary-button" onClick={() => setRenewing(null)}>
                Cancelar
              </button>
              <button className="primary-button">Confirmar renovación</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
