import {
  CheckCheck,
  ExternalLink,
  MessageCircle,
  Play,
  Plus,
  Send
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import api, { apiError } from "../services/api";

const emptyComposer = {
  leadId: "",
  telefono: "",
  templateKey: "bienvenida",
  contenido: "",
  parametros: {},
  programadoPara: "",
  consentimientoConfirmado: false,
  enviarAhora: true
};

const messageStatusLabel = {
  recibido: "Recibido",
  preparado: "Preparado",
  programado: "Programado",
  enviando: "Enviando",
  enviado: "Enviado",
  entregado: "Entregado",
  leido: "Leído",
  fallido: "Fallido",
  cancelado: "Cancelado"
};

const renderPreview = (template, values) =>
  String(template || "").replace(
    /{{\s*([a-zA-Z0-9_]+)\s*}}/g,
    (_, key) => values[key] || `{{${key}}}`
  );

export default function WhatsAppPage() {
  const [messages, setMessages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [leads, setLeads] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [configuration, setConfiguration] = useState(null);
  const [composer, setComposer] = useState(emptyComposer);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [messagesResponse, templatesResponse, configResponse, leadsResponse, jobsResponse] =
        await Promise.all([
          api.get("/whatsapp/messages"),
          api.get("/whatsapp/templates"),
          api.get("/whatsapp/config"),
          api.get("/crm/leads", { params: { limit: 200 } }),
          api.get("/admin/v2/automations/jobs")
        ]);
      setMessages(messagesResponse.data.data || []);
      setTemplates(templatesResponse.data.data || []);
      setConfiguration(configResponse.data.data);
      setLeads(leadsResponse.data.data || []);
      setJobs(jobsResponse.data.data || []);
    } catch (loadError) {
      setError(apiError(loadError, "No se pudo cargar WhatsApp"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.clave === composer.templateKey),
    [templates, composer.templateKey]
  );
  const selectedLead = useMemo(
    () => leads.find((lead) => String(lead.id) === String(composer.leadId)),
    [leads, composer.leadId]
  );

  const openComposer = () => {
    const first = templates.find((template) => template.clave === "bienvenida");
    setComposer({
      ...emptyComposer,
      templateKey: first?.clave || "",
      parametros: Object.fromEntries((first?.variables || []).map((key) => [key, ""]))
    });
    setModalOpen(true);
  };

  const chooseLead = (leadId) => {
    const lead = leads.find((item) => String(item.id) === String(leadId));
    setComposer((current) => ({
      ...current,
      leadId,
      telefono: lead?.telefono || "",
      parametros: {
        ...current.parametros,
        nombre: lead?.nombre || ""
      }
    }));
  };

  const chooseTemplate = (templateKey) => {
    const template = templates.find((item) => item.clave === templateKey);
    const parameters = Object.fromEntries(
      (template?.variables || []).map((key) => [
        key,
        key === "nombre" ? selectedLead?.nombre || "" : ""
      ])
    );
    setComposer((current) => ({
      ...current,
      templateKey,
      parametros: parameters
    }));
  };

  const saveMessage = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const response = await api.post("/whatsapp/messages", {
        leadId: composer.leadId || null,
        telefono: composer.leadId ? undefined : composer.telefono,
        templateKey: composer.templateKey || null,
        contenido: composer.templateKey ? undefined : composer.contenido,
        parametros: composer.parametros,
        programadoPara: composer.programadoPara || undefined,
        consentimientoConfirmado: composer.consentimientoConfirmado,
        enviarAhora: composer.enviarAhora
      });
      const actionUrl = response.data.data?.actionUrl;
      if (actionUrl) window.open(actionUrl, "_blank", "noopener,noreferrer");
      setModalOpen(false);
      setNotice(
        actionUrl
          ? "Mensaje abierto en WhatsApp. Luego márcalo como enviado."
          : composer.enviarAhora
            ? "Mensaje procesado."
            : "Mensaje agregado a la cola."
      );
      await load();
    } catch (saveError) {
      setError(apiError(saveError, "No se pudo crear el mensaje"));
    }
  };

  const dispatch = async (message) => {
    setError("");
    try {
      const response = await api.post(`/whatsapp/messages/${message.id}/dispatch`);
      const actionUrl = response.data.data?.actionUrl;
      if (actionUrl) window.open(actionUrl, "_blank", "noopener,noreferrer");
      setNotice(
        actionUrl
          ? "WhatsApp abierto; confirma el envío desde tu teléfono."
          : "Mensaje enviado por Cloud API."
      );
      await load();
    } catch (dispatchError) {
      setError(apiError(dispatchError, "No se pudo procesar el mensaje"));
    }
  };

  const markSent = async (message) => {
    try {
      await api.post(`/whatsapp/messages/${message.id}/mark-sent`);
      setNotice("Mensaje marcado como enviado.");
      await load();
    } catch (markError) {
      setError(apiError(markError, "No se pudo actualizar el mensaje"));
    }
  };

  const runAutomations = async () => {
    try {
      const response = await api.post("/admin/v2/automations/run", {
        batchSize: 30
      });
      const result = response.data.data;
      setNotice(
        `Automatizaciones: ${result.completed} completadas y ${result.failed} con error.`
      );
      await load();
    } catch (runError) {
      setError(apiError(runError, "No se pudieron ejecutar las automatizaciones"));
    }
  };

  const columns = [
    {
      key: "contacto",
      label: "Contacto",
      render: (message) => (
        <div className="message-contact">
          <strong>{message.lead_nombre || message.usuario_nombre || message.telefono}</strong>
          <small>{message.telefono}</small>
        </div>
      )
    },
    {
      key: "contenido",
      label: "Mensaje",
      render: (message) => (
        <div className="message-preview" title={message.contenido}>
          {message.contenido}
        </div>
      )
    },
    {
      key: "modo",
      label: "Modo",
      render: (message) => (
        <span className={`status-pill ${message.modo === "cloud" ? "status-pill--blue" : "status-pill--muted"}`}>
          {message.modo === "cloud" ? "Cloud" : "Asistido"}
        </span>
      )
    },
    {
      key: "estado",
      label: "Estado",
      render: (message) => (
        <span className={`status-pill status-pill--${message.estado}`}>
          {messageStatusLabel[message.estado] || message.estado}
        </span>
      )
    },
    {
      key: "programado_para",
      label: "Programado",
      render: (message) => new Date(message.programado_para).toLocaleString("es-PY")
    }
  ];

  const pendingJobs = jobs.filter((job) =>
    ["pendiente", "fallido", "procesando"].includes(job.estado)
  );

  return (
    <>
      <PageHeader
        eyebrow="Comunicación"
        title="WhatsApp híbrido"
        description="Prepara mensajes ahora y activa Cloud API cuando tengas las credenciales de Meta."
        action={
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={runAutomations}>
              <Play size={17} />
              Ejecutar avisos
            </button>
            <button type="button" className="primary-button" onClick={openComposer}>
              <Plus size={18} />
              Nuevo mensaje
            </button>
          </div>
        }
      />

      {error ? <div className="alert alert--error">{error}</div> : null}
      {notice ? (
        <div className="alert alert--success" onClick={() => setNotice("")}>
          {notice}
        </div>
      ) : null}

      {configuration ? (
        <section className="integration-strip">
          <div>
            <MessageCircle size={20} />
            <span>Modo actual</span>
            <strong>{configuration.mode === "cloud" ? "Cloud API" : "Asistido"}</strong>
          </div>
          <div>
            <span className={`signal-dot ${configuration.assistedReady ? "signal-dot--ok" : ""}`} />
            <span>Enlaces WhatsApp</span>
            <strong>Listos</strong>
          </div>
          <div>
            <span className={`signal-dot ${configuration.cloudReady ? "signal-dot--ok" : ""}`} />
            <span>Cloud API</span>
            <strong>{configuration.cloudReady ? "Configurada" : "Pendiente"}</strong>
          </div>
          <div>
            <span className={`signal-dot ${configuration.webhookReady ? "signal-dot--ok" : ""}`} />
            <span>Webhook</span>
            <strong>{configuration.webhookReady ? "Configurado" : "Pendiente"}</strong>
          </div>
        </section>
      ) : null}

      <section className="dashboard-grid dashboard-grid--whatsapp">
        <article className="panel-card panel-card--table">
          <div className="panel-heading panel-heading--padded">
            <div>
              <span className="eyebrow">Bandeja</span>
              <h2>Mensajes recientes</h2>
            </div>
            <span className="count-badge">{messages.length}</span>
          </div>
          {loading ? (
            <div className="loading-panel">Cargando mensajes…</div>
          ) : (
            <DataTable
              rows={messages}
              columns={columns}
              actions={(message) => (
                <>
                  {["preparado", "programado", "fallido"].includes(message.estado) ? (
                    <button
                      type="button"
                      className="mini-button mini-button--green"
                      onClick={() => dispatch(message)}
                    >
                      <ExternalLink size={15} />
                      {message.modo === "cloud" ? "Enviar" : "Abrir"}
                    </button>
                  ) : null}
                  {message.modo === "assisted" &&
                  ["preparado", "programado", "fallido"].includes(message.estado) ? (
                    <button
                      type="button"
                      className="mini-button"
                      onClick={() => markSent(message)}
                    >
                      <CheckCheck size={15} />
                      Marcar
                    </button>
                  ) : null}
                </>
              )}
            />
          )}
        </article>

        <aside className="panel-card automation-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Automatizaciones</span>
              <h2>Próximos avisos</h2>
            </div>
            <span className="count-badge">{pendingJobs.length}</span>
          </div>
          {pendingJobs.length ? (
            <div className="job-list">
              {pendingJobs.slice(0, 8).map((job) => (
                <div key={job.id}>
                  <span className={`signal-dot ${job.estado === "fallido" ? "signal-dot--error" : "signal-dot--ok"}`} />
                  <div>
                    <strong>{job.payload?.templateKey?.replaceAll("_", " ") || job.tipo}</strong>
                    <small>
                      {new Date(job.ejecutar_at).toLocaleString("es-PY")}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-copy">
              No hay avisos pendientes. Se crearán al registrar o renovar suscripciones.
            </p>
          )}
        </aside>
      </section>

      {modalOpen ? (
        <Modal title="Preparar mensaje de WhatsApp" onClose={() => setModalOpen(false)}>
          <form className="form-grid" onSubmit={saveMessage}>
            <label className="form-grid__full">
              Lead registrado
              <select value={composer.leadId} onChange={(event) => chooseLead(event.target.value)}>
                <option value="">Número manual</option>
                {leads.map((lead) => (
                  <option value={lead.id} key={lead.id}>
                    {lead.nombre} — {lead.telefono}
                  </option>
                ))}
              </select>
            </label>
            {!composer.leadId ? (
              <label className="form-grid__full">
                Número de WhatsApp
                <input
                  value={composer.telefono}
                  onChange={(event) => setComposer({ ...composer, telefono: event.target.value })}
                  placeholder="0984 060 513"
                  inputMode="tel"
                  required
                />
              </label>
            ) : null}
            <label className="form-grid__full">
              Plantilla
              <select value={composer.templateKey} onChange={(event) => chooseTemplate(event.target.value)}>
                <option value="">Mensaje libre</option>
                {templates.map((template) => (
                  <option value={template.clave} key={template.clave}>
                    {template.nombre}
                  </option>
                ))}
              </select>
            </label>
            {selectedTemplate ? (
              <>
                {(selectedTemplate.variables || []).map((variable) => (
                  <label key={variable}>
                    {variable.replaceAll("_", " ")}
                    <input
                      value={composer.parametros[variable] || ""}
                      onChange={(event) =>
                        setComposer({
                          ...composer,
                          parametros: {
                            ...composer.parametros,
                            [variable]: event.target.value
                          }
                        })
                      }
                      required
                    />
                  </label>
                ))}
                <div className="message-bubble form-grid__full">
                  {renderPreview(selectedTemplate.contenido, composer.parametros)}
                </div>
              </>
            ) : (
              <label className="form-grid__full">
                Mensaje
                <textarea
                  rows="5"
                  value={composer.contenido}
                  onChange={(event) => setComposer({ ...composer, contenido: event.target.value })}
                  required
                />
              </label>
            )}
            <label className="form-grid__full">
              Programar para (opcional)
              <input
                type="datetime-local"
                value={composer.programadoPara}
                onChange={(event) => setComposer({ ...composer, programadoPara: event.target.value })}
              />
            </label>
            {!composer.leadId ? (
              <label className="checkbox-field form-grid__full">
                <input
                  type="checkbox"
                  checked={composer.consentimientoConfirmado}
                  onChange={(event) =>
                    setComposer({
                      ...composer,
                      consentimientoConfirmado: event.target.checked
                    })
                  }
                  required
                />
                Confirmo que este contacto autorizó mensajes por WhatsApp
              </label>
            ) : null}
            <label className="checkbox-field form-grid__full">
              <input
                type="checkbox"
                checked={composer.enviarAhora}
                onChange={(event) =>
                  setComposer({ ...composer, enviarAhora: event.target.checked })
                }
              />
              Procesar el mensaje ahora
            </label>
            <div className="form-actions form-grid__full">
              <button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button className="primary-button">
                <Send size={17} />
                Guardar mensaje
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
