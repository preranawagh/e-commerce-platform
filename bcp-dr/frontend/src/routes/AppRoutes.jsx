import { Route, Routes } from 'react-router-dom';
import AdminRoute from '../components/AdminRoute';
import ProtectedRoute from '../components/ProtectedRoute';
import CreateOrder from '../pages/CreateOrder';
import Dashboard from '../pages/Dashboard';
import Inventory from '../pages/Inventory';
import Login from '../pages/Login';
import Notifications from '../pages/Notifications';
import Orders from '../pages/Orders';
import ProductDetail from '../pages/ProductDetail';
import ProductManage from '../pages/ProductManage';
import Products from '../pages/Products';
import Register from '../pages/Register';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
      <Route path="/products/manage" element={<AdminRoute><ProductManage /></AdminRoute>} />
      <Route path="/products/:id" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
      <Route path="/inventory" element={<AdminRoute><Inventory /></AdminRoute>} />
      <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
      <Route path="/orders/create" element={<ProtectedRoute><CreateOrder /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
    </Routes>
  );
}
