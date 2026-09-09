export default function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="text-center py-5">
      <div className="spinner-border text-danger" role="status">
        <span className="visually-hidden">{message}</span>
      </div>
      <p className="text-muted mt-3 mb-0">{message}</p>
    </div>
  );
}
