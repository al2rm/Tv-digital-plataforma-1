export default function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "blue"
}) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__icon">{Icon ? <Icon size={20} /> : null}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {helper ? <small>{helper}</small> : null}
      </div>
    </article>
  );
}
