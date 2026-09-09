import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProtectedRoute from './ProtectedRoute';

export default function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return <div className="container py-5 text-center text-muted">Loading...</div>;
  }

  return (
    <ProtectedRoute>
      {isAdmin ? children : <Navigate to="/" replace />}
    </ProtectedRoute>
  );
}
