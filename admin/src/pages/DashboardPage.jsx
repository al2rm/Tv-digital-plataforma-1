import {
  CircleDollarSign,
  Clock3,
  MessageCircle,
  UsersRound
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import api, { apiError } from "../services/api";

const stageLabels = {
  nuevo: "Nuevos",
  contactado: "Contactados",
  interesado: "Interesados",
  esperando_pago: "Esperando pago",
  activo: "Activos",
  perdido: "Perdidos"
};

const money = new Intl.NumberFormat("es-PY", {
  style: "currency",
  currency: "PYG",
  maximumFractionDigits: 0
});

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/crm/dashboard");
      setData(response.data.data);
    } catch (loadError) {
      setError(apiError(loadError, "No se pudo cargar el resumen"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        eyebrow="Centro de operaciones"
        title="Resumen del negocio"
        description="Ventas, renovaciones y mensajes que requieren atención."
        action={
          <button type="button" className="secondary-button" onClick={load}>
            Actualizar
          </button>
        }
      />

      {error ? <div className="alert alert--error">{error}</div> : null}
      {loading ? <div className="loading-panel">Cargando indicadores…</div> : null}

      {data ? (
        <>
          <section className="stats-grid">
            <StatCard
              label="Leads totales"
              value={data.leads.total}
              helper="Embudo comercial"
              icon={UsersRound}
              tone="blue"
            />
            <StatCard
              label="Mensajes pendientes"
              value={data.mensajesPendientes}
              helper="WhatsApp asistido"
              icon={MessageCircle}
              tone="green"
            />
            <StatCard
              label="Próximos a vencer"
              value={data.suscripcionesPorVencer}
              helper="En los siguientes 5 días"
              icon={Clock3}
              tone="orange"
            />
            <StatCard
              label="Ingresos del mes"
              value={money.format(data.ingresosMes)}
              helper="Pagos confirmados"
              icon={CircleDollarSign}
              tone="violet"
            />
          </section>

          <section className="dashboard-grid">
            <article className="panel-card">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Embudo</span>
                  <h2>Estado de las ventas</h2>
                </div>
              </div>
              <div className="pipeline">
                {Object.entries(stageLabels).map(([stage, label]) => (
                  <div className={`pipeline-item pipeline-item--${stage}`} key={stage}>
                    <strong>{data.leads.porEtapa[stage] || 0}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel-card">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Adquisición</span>
                  <h2>Origen de los contactos</h2>
                </div>
              </div>
              {data.origenes.length ? (
                <div className="source-list">
                  {data.origenes.map((source) => (
                    <div key={source.origen}>
                      <span>{source.origen.replaceAll("_", " ")}</span>
                      <strong>{source.total}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Todavía no hay leads"
                  description="Los contactos de WhatsApp y los creados manualmente aparecerán aquí."
                />
              )}
            </article>
          </section>
        </>
      ) : null}
    </>
  );
}
