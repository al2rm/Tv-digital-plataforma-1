import { MessageCircle, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import api, { apiError } from "../services/api";

const stages = [
  ["nuevo", "Nuevo"],
  ["contactado", "Contactado"],
  ["interesado", "Interesado"],
  ["esperando_pago", "Esperando pago"],
  ["activo", "Activo"],
  ["perdido", "Perdido"]
];

const origins = [
  ["manual", "Carga manual"],
  ["whatsapp", "WhatsApp"],
  ["meta_ads", "Anuncio Meta"],
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["referido", "Referido"],
  ["web", "Sitio web"]
];

const emptyForm = {
  nombre: "",
  telefono: "",
  etapa: "nuevo",
  origen: "manual",
  planInteres: "",
  consentimientoWhatsapp: false,
  notas: ""
};

export default function LeadsPage() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/crm/leads", {
        params: { search: search || undefined, stage: stage || undefined }
      });
      setRows(response.data.data || []);
    } catch (loadError) {
      setError(apiError(loadError, "No se pudieron cargar los leads"));
    } finally {
      setLoading(false);
    }
  }, [search, stage]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (lead) => {
    setEditing(lead);
    setForm({
      nombre: lead.nombre,
      telefono: lead.telefono,
      etapa: lead.etapa,
      origen: lead.origen,
      planInteres: lead.plan_interes || "",
      consentimientoWhatsapp: lead.consentimiento_whatsapp,
      notas: lead.notas || ""
    });
    setModalOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setError("");
    try {
      if (editing) {
        await api.put(`/crm/leads/${editing.id}`, form);
        setNotice("Lead actualizado");
      } else {
        await api.post("/crm/leads", form);
        setNotice("Lead creado");
      }
      setModalOpen(false);
      await load();
    } catch (saveError) {
      setError(apiError(saveError, "No se pudo guardar el lead"));
    }
  };

  const updateStage = async (lead, nextStage) => {
    try {
      await api.put(`/crm/leads/${lead.id}`, { etapa: nextStage });
      await load();
    } catch (stageError) {
      setError(apiError(stageError, "No se pudo cambiar la etapa"));
    }
  };

  const sendWelcome = async (lead) => {
    setError("");
    try {
      const response = await api.post("/whatsapp/messages", {
        leadId: lead.id,
        templateKey: "bienvenida",
        parametros: { nombre: lead.nombre },
        enviarAhora: true
      });
      const actionUrl = response.data.data?.actionUrl;
      if (actionUrl) window.open(actionUrl, "_blank", "noopener,noreferrer");
      setNotice(
        actionUrl
          ? "WhatsApp preparado; al enviarlo puedes marcarlo como enviado."
          : "Mensaje enviado mediante WhatsApp Cloud."
      );
    } catch (sendError) {
      setError(apiError(sendError, "No se pudo preparar el mensaje"));
    }
  };

  const columns = useMemo(
    () => [
      {
        key: "nombre",
        label: "Contacto",
        render: (lead) => (
          <div className="contact-cell">
            <span>{lead.nombre[0]?.toUpperCase()}</span>
            <div>
              <strong>{lead.nombre}</strong>
              <small>{lead.telefono}</small>
            </div>
          </div>
        )
      },
      {
        key: "origen",
        label: "Origen",
        render: (lead) => lead.origen.replaceAll("_", " ")
      },
      {
        key: "plan_interes",
        label: "Plan",
        render: (lead) => lead.plan_interes || "Sin definir"
      },
      {
        key: "etapa",
        label: "Etapa",
        render: (lead) => (
          <select
            className={`stage-select stage-select--${lead.etapa}`}
            value={lead.etapa}
            onChange={(event) => updateStage(lead, event.target.value)}
          >
            {stages.map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
        )
      },
      {
        key: "consentimiento_whatsapp",
        label: "Permiso",
        render: (lead) => (
          <span className={`status-pill ${lead.consentimiento_whatsapp ? "status-pill--ok" : "status-pill--muted"}`}>
            {lead.consentimiento_whatsapp ? "Autorizado" : "Pendiente"}
          </span>
        )
      }
    ],
    []
  );

  return (
    <>
      <PageHeader
        eyebrow="Embudo comercial"
        title="Ventas CRM"
        description="Registra contactos y acompáñalos desde el primer mensaje hasta la activación."
        action={
          <button type="button" className="primary-button" onClick={openNew}>
            <Plus size={18} />
            Nuevo lead
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
            placeholder="Buscar nombre o número"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <select value={stage} onChange={(event) => setStage(event.target.value)}>
          <option value="">Todas las etapas</option>
          {stages.map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
      </div>

      <section className="panel-card panel-card--table">
        {loading ? (
          <div className="loading-panel">Cargando ventas…</div>
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            actions={(lead) => (
              <>
                <button
                  type="button"
                  className="mini-button mini-button--green"
                  onClick={() => sendWelcome(lead)}
                  disabled={!lead.consentimiento_whatsapp}
                  title={
                    lead.consentimiento_whatsapp
                      ? "Preparar WhatsApp"
                      : "Falta consentimiento"
                  }
                >
                  <MessageCircle size={15} />
                  Mensaje
                </button>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => openEdit(lead)}
                >
                  Editar
                </button>
              </>
            )}
          />
        )}
      </section>

      {modalOpen ? (
        <Modal
          title={editing ? "Editar lead" : "Nuevo lead"}
          onClose={() => setModalOpen(false)}
        >
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
              WhatsApp *
              <input
                value={form.telefono}
                onChange={(event) => setForm({ ...form, telefono: event.target.value })}
                placeholder="0984 060 513"
                inputMode="tel"
                required
              />
            </label>
            <label>
              Etapa
              <select
                value={form.etapa}
                onChange={(event) => setForm({ ...form, etapa: event.target.value })}
              >
                {stages.map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Origen
              <select
                value={form.origen}
                onChange={(event) => setForm({ ...form, origen: event.target.value })}
              >
                {origins.map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="form-grid__full">
              Plan de interés
              <input
                value={form.planInteres}
                onChange={(event) => setForm({ ...form, planInteres: event.target.value })}
                placeholder="Ej. Mensual"
              />
            </label>
            <label className="form-grid__full">
              Notas
              <textarea
                rows="3"
                value={form.notas}
                onChange={(event) => setForm({ ...form, notas: event.target.value })}
              />
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
              El contacto autorizó recibir mensajes por WhatsApp
            </label>
            <div className="form-actions form-grid__full">
              <button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button className="primary-button">Guardar</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
