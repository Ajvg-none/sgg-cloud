import React from 'react';

const STATUS_STYLES = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  ERROR: 'bg-red-100 text-opticolor-red-dark',
};

const STATUS_LABELS = {
  PENDING: 'Pendiente',
  PROCESSING: 'Procesando',
  COMPLETED: 'Completado',
  ERROR: 'Error',
};

const StatusBadge = ({ status, className = '' }) => {
  const style = STATUS_STYLES[status] || 'bg-opticolor-gray-100 text-opticolor-gray-700';
  const label = STATUS_LABELS[status] || status;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${style} ${className}`}
    >
      {label}
    </span>
  );
};

export default StatusBadge;
