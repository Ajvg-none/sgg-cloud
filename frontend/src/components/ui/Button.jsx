import React from 'react';

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  loading = false, 
  disabled = false,
  className = '',
  type = 'button',
  ...props 
}) => {
  const baseClasses = 'px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2';
  
  const variants = {
    primary: 'bg-opticolor-red hover:bg-opticolor-red-dark text-white shadow-md hover:shadow-lg disabled:bg-opticolor-gray-300',
    secondary: 'bg-white hover:bg-opticolor-gray-50 text-opticolor-red border-2 border-opticolor-red disabled:border-opticolor-gray-300 disabled:text-opticolor-gray-400',
    ghost: 'bg-transparent hover:bg-opticolor-gray-100 text-opticolor-gray-700',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variants[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
};

export default Button;