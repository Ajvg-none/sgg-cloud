// frontend/src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Layouts
import StoreNavbar from './components/layout/StoreNavbar';
import AdminLayout from './components/layout/AdminLayout';

// Páginas de Tienda
import StoreWarranty from './pages/StoreWarranty';
import StoreHistory from './pages/StoreHistory'; // <-- Ahora sí existe

// Páginas de Admin
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
        {/* Rutas de Tienda (con Navbar) */}
        <Route path="/" element={
          <>
            <StoreNavbar />
            <StoreWarranty />
          </>
        } />
        <Route path="/history" element={
          <>
            <StoreNavbar />
            <StoreHistory />
          </>
        } />

        {/* Rutas de Admin (con Sidebar lateral) */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="labs" element={<AdminLabs />} />
          <Route path="stores" element={<AdminStores />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="logs" element={<AdminLogs />} />
          <Route path="import" element={<AdminImportCsv />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;