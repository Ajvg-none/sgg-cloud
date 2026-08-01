import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const StoreNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || 'Tienda';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    localStorage.removeItem('storeId');
    localStorage.removeItem('labId');
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-md border-b-2 border-opticolor-red">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
         <div className="flex items-center gap-2">
          <img 
            src="/logo-opti.jpg" 
            alt="Opti-Color" 
            className="h-16 w-auto"   // ajusta según el espacio en la navbar
          />
          <span className="text-sm text-opticolor-gray-500">| Garantías</span>
        </div>
          <div className="flex items-center gap-4">
            <Link
              to="/store"
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${location.pathname === '/store' ? 'bg-opticolor-red text-white shadow-md' : 'text-opticolor-gray-700 hover:bg-opticolor-gray-100'}`}
            >
              ➕ Nueva Garantía
            </Link>
            <span className="text-sm text-opticolor-gray-500 hidden sm:block">{username}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg font-medium text-opticolor-gray-600 hover:text-opticolor-red hover:bg-opticolor-gray-100 transition-all duration-200"
            >
              🚪 Salir
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default StoreNavbar;
