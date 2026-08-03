import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import UserChip from '../ui/UserChip';
import { LogoutIcon } from '../ui/Icons';

const LabLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || 'Laboratorio';
  const [lab, setLab] = useState(null);

  useEffect(() => {
    const loadLab = async () => {
      try {
        const res = await authAPI.me();
        const l = res.data?.user?.lab;
        if (l) setLab(l);
      } catch {
        // Sin nombre de laboratorio: se usa el username como respaldo
      }
    };
    loadLab();
  }, []);

  const menuItems = [
    { path: '/lab', label: 'Panel', icon: '📊', exact: true },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    localStorage.removeItem('storeId');
    localStorage.removeItem('labId');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-opticolor-gray-50 flex">
      <aside className="w-64 bg-white border-r border-opticolor-gray-200 shadow-sm flex flex-col">
        <div className="p-6 border-b border-opticolor-gray-200 flex flex-col items-center">
          <img 
            src="/logo-opti.jpg" 
            alt="Opti-Color" 
            className="h-48 w-auto"
          />
          <p className="text-sm text-opticolor-gray-500 mt-1">Panel de Laboratorio</p>
          <div className="mt-2">
            <UserChip name={lab?.name || username} subtitle={username} />
          </div>
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
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-opticolor-red text-white shadow-md'
                        : 'text-opticolor-gray-700 hover:bg-opticolor-gray-100'
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-opticolor-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-opticolor-red hover:bg-red-50 transition-colors rounded-lg"
          >
            <LogoutIcon />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default LabLayout;
