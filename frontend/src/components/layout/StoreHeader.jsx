import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import UserChip from '../ui/UserChip';
import { LogoutIcon, StoreIcon } from '../ui/Icons';

const StoreHeader = () => {
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
    <header className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
      {/* Marca */}
      <div className="flex items-center gap-4">
        <img
          src="/logo-opti.jpg"
          alt="Opti-Color"
          className="h-20 w-20 rounded-2xl border border-opticolor-gray-200 bg-opticolor-gray-100 object-contain p-2 shadow-soft"
        />
        <div className="flex items-center gap-3">
          <span className="h-10 w-px bg-opticolor-gray-200" />
          <span className="flex items-center gap-2 text-base font-semibold uppercase tracking-wide text-opticolor-red">
            <StoreIcon />
            Garantías
          </span>
        </div>
      </div>

      {/* Usuario + Salir */}
      <div className="flex items-center gap-3">
        <div className="rounded-full border border-opticolor-gray-200 bg-opticolor-gray-50 py-1.5 pl-2 pr-4">
          <UserChip name={displayName} subtitle={subtitle} />
        </div>
        <button
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          className="flex items-center gap-2 rounded-lg border-2 border-opticolor-gray-200 px-3 py-2 text-sm font-medium text-opticolor-gray-600 transition-all duration-200 hover:border-opticolor-red hover:bg-opticolor-red hover:text-white active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-opticolor-red"
        >
          <LogoutIcon />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  );
};

export default StoreHeader;
