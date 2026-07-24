// frontend/src/components/ui/Modal.jsx
import React, { useEffect } from 'react';

const Modal = ({ isOpen, onClose, title, children, size = 'lg' }) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-opticolor-gray-900 bg-opacity-50"
        onClick={onClose}
      />
      <div className={`
        relative bg-white rounded-xl shadow-2xl w-full ${sizes[size]}
        max-h-[90vh] flex flex-col animate-slide-up
      `}>
        <div className="flex items-center justify-between p-6 border-b border-opticolor-gray-200">
          <h2 className="text-2xl font-bold text-opticolor-gray-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-opticolor-gray-400 hover:text-opticolor-red transition-colors text-2xl font-bold"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;