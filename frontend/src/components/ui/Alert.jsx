import React from 'react';

const Alert = ({ type = 'info', message, onClose }) => {
  const types = {
    success: 'bg-green-50 border-green-500 text-green-800',
    error: 'bg-red-50 border-opticolor-red-light text-opticolor-red-dark',
    warning: 'bg-yellow-50 border-yellow-500 text-yellow-800',
    info: 'bg-blue-50 border-blue-500 text-blue-800',
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div className={`
      border-l-4 p-4 rounded-r-lg flex items-start gap-3
      animate-slide-up
      ${types[type]}
    `}>
      <span className="text-xl font-bold">{icons[type]}</span>
      <p className="flex-1 text-sm">{message}</p>
      {onClose && (
        <button 
          onClick={onClose}
          className="text-current opacity-60 hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default Alert;