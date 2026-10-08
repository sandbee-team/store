export default function MetricStrip({ items }) {
  return (
    <div className="metric-strip">
      {items.map(({ label, value, note }) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          {note && <small>{note}</small>}
        </div>
      ))}
    </div>
  );
}
