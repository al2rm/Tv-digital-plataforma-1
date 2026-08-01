import { CircleDollarSign } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable";
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
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/admin/v2/payments")
      .then((response) => setRows(response.data.data || []))
      .catch((loadError) =>
        setError(apiError(loadError, "No se pudieron cargar los pagos"))
      );
  }, []);

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
      />
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
    </>
  );
}
