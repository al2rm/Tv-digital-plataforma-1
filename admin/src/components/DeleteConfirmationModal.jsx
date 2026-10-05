import { Trash2 } from "lucide-react";
import Modal from "./Modal";

export default function DeleteConfirmationModal({
  title = "Eliminar registro",
  name,
  description = "Esta acción no se puede deshacer.",
  deleting = false,
  error = "",
  onCancel,
  onConfirm
}) {
  return (
    <Modal title={title} onClose={() => !deleting && onCancel()}>
      <div className="delete-confirmation">
        <div className="delete-confirmation__icon"><Trash2 size={24} /></div>
        <div>
          <h3>¿Eliminar “{name}”?</h3>
          <p>{description}</p>
        </div>
      </div>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <div className="form-actions">
        <button type="button" className="secondary-button" disabled={deleting} onClick={onCancel}>
          Conservar
        </button>
        <button type="button" className="danger-button" disabled={deleting} onClick={onConfirm}>
          <Trash2 size={16} />
          {deleting ? "Eliminando…" : "Eliminar definitivamente"}
        </button>
      </div>
    </Modal>
  );
}
