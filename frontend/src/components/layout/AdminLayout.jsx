// frontend/src/components/layout/AdminLayout.jsx
import React from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import UserChip from '../ui/UserChip';
import { LogoutIcon } from '../ui/Icons';
import { LayoutDashboard, FlaskConical, Store, Users } from 'lucide-react';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || 'Administrador';

  const menuItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { path: '/admin/labs', label: 'Laboratorios', icon: FlaskConical },
    { path: '/admin/stores', label: 'Tiendas', icon: Store },
    { path: '/admin/users', label: 'Usuarios', icon: Users },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-opticolor-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-opticolor-gray-200 shadow-sm flex flex-col">
       <div className="p-6 border-b border-opticolor-gray-200 flex flex-col items-center">
          <img 
            src="/logo-opti.jpg" 
            alt="Opti-Color" 
            className="h-48 w-auto"
          />
          <p className="text-sm text-opticolor-gray-500 mt-1">Panel de Administración</p>
          <div className="mt-2">
            <UserChip name={username} subtitle="Administrador" />
          </div>
        </div>

        {/* Navegación */}
        <nav className="p-4 flex-1">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                      ${isActive
                        ? 'bg-opticolor-red text-white shadow-md'
                        : 'text-opticolor-gray-700 hover:bg-opticolor-gray-100'
                      }
                    `}
                  >
                    {(() => {
                      const Icon = item.icon;
                      return <Icon className="h-5 w-5" aria-hidden="true" />;
                    })()}
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer del Sidebar */}
        <div className="p-4 border-t border-opticolor-gray-200 space-y-2">
          <Link
            to="/"
            className="flex items-center gap-2 px-4 py-2 text-sm text-opticolor-gray-600 hover:text-opticolor-red transition-colors rounded-lg hover:bg-opticolor-gray-100"
          >
            ← Volver a Tienda
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-opticolor-red hover:bg-red-50 transition-colors rounded-lg"
          >
            <LogoutIcon />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;