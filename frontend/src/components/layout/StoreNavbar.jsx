import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import UserChip from '../ui/UserChip';
import { LogoutIcon, StoreIcon } from '../ui/Icons';

const StoreNavbar = () => {
  const navigate = useNavigate();
  const [store, setStore] = useState(null);

  useEffect(() => {
    const loadStore = async () => {
      try {
        const res = await authAPI.me();
        const s = res.data?.user?.store;
        if (s) setStore(s);
      } catch {
        // Sin nombre de tienda: se usa el username como respaldo
      }
    };
    loadStore();
  }, []);

  const username = localStorage.getItem('username') || 'Tienda';
  const displayName = store?.name || username;
  const subtitle = store?.accn ? `ACCN ${store.accn}` : undefined;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    localStorage.removeItem('storeId');
    localStorage.removeItem('labId');
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b-4 border-opticolor-red shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex h-20 items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo-opti.jpg"
              alt="Opti-Color"
              className="h-16 w-16 rounded-xl border border-opticolor-gray-200 bg-opticolor-gray-100 object-contain p-1.5"
            />
            <div className="flex items-center gap-2">
              <span className="hidden sm:block h-8 w-px bg-opticolor-gray-200" />
              <span className="hidden sm:flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-opticolor-red">
                <StoreIcon />
                Garantías
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <UserChip name={displayName} subtitle={subtitle} />
            <button
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              className="flex items-center gap-2 rounded-lg border-2 border-opticolor-gray-200 px-3 py-2 text-sm font-medium text-opticolor-gray-600 transition-all duration-200 hover:border-opticolor-red hover:bg-opticolor-gray-50 hover:text-opticolor-red focus:outline-none focus-visible:ring-2 focus-visible:ring-opticolor-red"
            >
              <LogoutIcon />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default StoreNavbar;
