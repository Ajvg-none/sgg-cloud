import React from 'react';

const Card = ({ 
  children, 
  className = '', 
  ...props 
}) => {
  return (
    <div 
      className={`bg-white rounded-xl border border-opticolor-gray-100 shadow-sm p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;