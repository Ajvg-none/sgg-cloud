// frontend/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Auth
import Login from './pages/Login';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Layouts
import StoreNavbar from './components/layout/StoreNavbar';
import LabLayout from './components/layout/LabLayout';
import AdminLayout from './components/layout/AdminLayout';

// Páginas Tienda
import StoreWarranty from './pages/StoreWarranty';

// Páginas Laboratorio
import LabDashboard from './pages/lab/LabDashboard';

// Páginas Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminLabs from './pages/admin/AdminLabs';
import AdminStores from './pages/admin/AdminStores';
import AdminUsers from './pages/admin/AdminUsers';
import AdminLogs from './pages/admin/AdminLogs';
import AdminImportCsv from './pages/admin/AdminImportCsv';

function App() {
  return (
    <Router>
      <Routes>
        {/* Login (público) */}
        <Route path="/login" element={<Login />} />

        {/* Tienda (solo TIENDA) */}
        <Route path="/store" element={
          <ProtectedRoute allowedRoles={['TIENDA']}>
            <>
              <StoreNavbar />
              <StoreWarranty />
            </>
          </ProtectedRoute>
        } />

        {/* Laboratorio (solo LABORATORIO) */}
        <Route path="/lab" element={
          <ProtectedRoute allowedRoles={['LABORATORIO']}>
            <LabLayout />
          </ProtectedRoute>
        }>
          <Route index element={<LabDashboard />} />
        </Route>

        {/* Admin (solo ADMIN) */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="labs" element={<AdminLabs />} />
          <Route path="stores" element={<AdminStores />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="logs" element={<AdminLogs />} />
          <Route path="import" element={<AdminImportCsv />} />
        </Route>

        {/* Redirección raíz */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
