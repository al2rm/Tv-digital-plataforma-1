export default function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="presentation">
      <section
        className="modal-card"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
