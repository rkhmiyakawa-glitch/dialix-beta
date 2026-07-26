export default function Modal({ title, children, actions, onClose }) {
  return <div className="lock-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
    <section className="edit-modal" role="dialog" aria-modal="true" aria-label={title}>
      <h2>{title}</h2>
      {children}
      {actions && <div className="modal-actions">{actions}</div>}
    </section>
  </div>;
}
