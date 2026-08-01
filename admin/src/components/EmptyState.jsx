export default function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__screen" aria-hidden="true">TV</div>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}
