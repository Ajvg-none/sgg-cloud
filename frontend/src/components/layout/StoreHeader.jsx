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
        // Silencioso
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
    // --- CONTENEDOR TIPO TARJETA (CARD) ---
    <header className="bg-white rounded-2xl shadow-sm border border-opticolor-gray-100 p-6 mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      
      {/* --- LADO IZQUIERDO: LOGO + TÍTULOS --- */}
      <div className="flex items-center gap-6">
        {/* Logo Grande */}
        <div className="flex-shrink-0">
          <img
            src="/logo-opti.jpg"
            alt="Opti-Color Logo"
            className="h-16 w-auto object-contain" 
            // h-16 es un buen tamaño dentro de la tarjeta. 
            // Si lo quieres más grande como en la foto, usa h-20
          />
        </div>

        {/* Textos (Subtítulo + Título Principal) */}
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-1">
            Sistema de Garantías
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-opticolor-gray-900 flex items-center gap-2">
            Panel de Tienda
          </h1>
          <p className="text-sm text-opticolor-gray-500 mt-1 hidden sm:block">
            Gestiona tus órdenes y garantías desde aquí.
          </p>
        </div>
      </div>

      {/* --- LADO DERECHO: ACCIONES / USUARIO --- */}
      <div className="flex items-center gap-4 flex-wrap">
        
        {/* Chip de Usuario (Estilo similar a los badges de la foto) */}
        <div className="flex items-center gap-2 bg-opticolor-gray-50 px-3 py-1.5 rounded-full border border-opticolor-gray-200">
           <UserChip name={displayName} subtitle={subtitle} />
        </div>

        {/* Botón Salir (Estilo pastilla como en la foto) */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-opticolor-gray-200 bg-white text-sm font-medium text-opticolor-gray-600 hover:bg-opticolor-gray-50 hover:border-opticolor-gray-300 transition-all shadow-sm"
        >
          <LogoutIcon className="h-4 w-4" />
          <span>Salir</span>
        </button>
      </div>

    </header>
  );
};

export default StoreHeader;