import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const StoreNavbar = () => {
  const location = useLocation();

  const links = [
    { path: '/', label: '➕ Nueva Garantía' },
    { path: '/history', label: '📋 Historial' },
  ];

  return (
    <nav className="bg-white shadow-md border-b-2 border-opticolor-red">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-opticolor-red">OPTI-COLOR</span>
            <span className="text-sm text-opticolor-gray-500">| Sistema de Garantías</span>
          </div>
          <div className="flex gap-2">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`
                  px-4 py-2 rounded-lg font-medium transition-all duration-200
                  ${location.pathname === link.path
                    ? 'bg-opticolor-red text-white shadow-md'
                    : 'text-opticolor-gray-700 hover:bg-opticolor-gray-100'
                  }
                `}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default StoreNavbar;