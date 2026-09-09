export default function EmptyState({ title, message }) {
  return (
    <div className="text-center py-5 text-muted">
      <h2 className="h5">{title}</h2>
      <p className="mb-0">{message}</p>
    </div>
  );
}
