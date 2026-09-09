export default function AlertMessage({ error, success }) {
  if (!error && !success) {
    return null;
  }

  return (
    <div className={`alert ${error ? 'alert-danger' : 'alert-success'}`} role="alert">
      {error || success}
    </div>
  );
}
