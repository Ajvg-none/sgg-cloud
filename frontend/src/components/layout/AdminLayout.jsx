import React from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { path: '/admin', label: 'Dashboard', icon: '📊', exact: true },
    { path: '/admin/labs', label: 'Laboratorios', icon: '🔬' },
    { path: '/admin/stores', label: 'Tiendas', icon: '🏪' },
    { path: '/admin/users', label: 'Usuarios', icon: '👥' },
    { path: '/admin/logs', label: 'Logs', icon: '📋' },
    { path: '/admin/import', label: 'Importar CSV', icon: '📥' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-opticolor-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-opticolor-gray-200 shadow-sm flex flex-col">
        <div className="p-6 border-b border-opticolor-gray-200">
          <h1 className="text-xl font-bold text-opticolor-red">OPTI-COLOR</h1>
          <p className="text-sm text-opticolor-gray-500 mt-1">Panel de Administración</p>
        </div>

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
                    <span className="text-xl">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-opticolor-gray-200 space-y-2">
          <Link
            to="/"
            className="flex items-center gap-2 px-4 py-2 text-sm text-opticolor-gray-600 hover:text-opticolor-red transition-colors rounded-lg hover:bg-opticolor-gray-100"
          >
            ← Volver a Tienda
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-opticolor-red hover:bg-red-50 transition-colors rounded-lg"
          >
            🚪 Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;