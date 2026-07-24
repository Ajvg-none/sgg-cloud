import React from 'react';

const Input = ({
  label,
  error,
  className = '',
  children, // 1. EXTRAEMOS 'children' explícitamente para sacarlo del flujo
  ...props  // 2. Así, NUNCA llegará a la etiqueta <input> a través de {...props}
}) => {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-opticolor-gray-700">
          {label}
        </label>
      )}
      
      <input
        className={`
          px-4 py-2 border-2 rounded-lg transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-opticolor-red focus:border-transparent
          ${error 
            ? 'border-opticolor-red-light bg-red-50 animate-shake' 
            : 'border-opticolor-gray-200 hover:border-opticolor-gray-300'
          }
          disabled:bg-opticolor-gray-50 disabled:cursor-not-allowed
          ${className}
        `}
        {...props}
      />
      
      {error && (
        <p className="text-sm text-opticolor-red-light animate-fade-in">
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;