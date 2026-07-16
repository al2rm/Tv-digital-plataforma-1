export default function Modal({ title, children, onClose }) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="modal-card" onMouseDown={e=>e.stopPropagation()}>
      <header><h2>{title}</h2><button className="icon-button" onClick={onClose}>✕</button></header>
      {children}
    </section>
  </div>;
}
