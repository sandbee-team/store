export function Skeleton({ lines = 4 }) {
  return (
    <div className="skeleton" role="status" aria-label="Loading">
      <span className="sr-only">Loading</span>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}
