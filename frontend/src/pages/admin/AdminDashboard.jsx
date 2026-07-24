// frontend/src/pages/admin/AdminDashboard.jsx
import React from 'react';
import Card from '../../components/ui/Card';

const AdminDashboard = () => {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-opticolor-gray-900 mb-2">
          Dashboard de Garantías
        </h1>
        <p className="text-opticolor-gray-600">
          Vista general de todas las garantías del sistema
        </p>
      </div>
      <Card>
        <p className="text-opticolor-gray-600">
          🚧 Dashboard en construcción... (Tarea 9.6.1)
        </p>
      </Card>
    </div>
  );
};

export default AdminDashboard;