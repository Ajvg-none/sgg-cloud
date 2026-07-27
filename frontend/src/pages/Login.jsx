import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Alert from '../components/ui/Alert';

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (token && role) {
      redirectByRole(role);
    }
  }, []);

  const redirectByRole = (role) => {
    const routes = { ADMIN: '/admin', TIENDA: '/store', LABORATORIO: '/lab' };
    navigate(routes[role] || '/store', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Usuario y contraseña son obligatorios.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await authAPI.login({ username, password });
      const { token, user } = res.data;

      localStorage.setItem('token', token);
      localStorage.setItem('role', user.role);
      localStorage.setItem('username', user.username);
      if (user.storeId) localStorage.setItem('storeId', user.storeId);
      if (user.labId) localStorage.setItem('labId', user.labId);

      redirectByRole(user.role);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-opticolor-gray-50 to-opticolor-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-opticolor-red mb-2">OPTI-COLOR</h1>
          <p className="text-opticolor-gray-600">Sistema de Gestión de Garantías</p>
        </div>

        <div className="bg-white rounded-xl shadow-xl p-8 border border-opticolor-gray-100">
          <h2 className="text-2xl font-bold text-opticolor-gray-900 mb-6">Iniciar Sesión</h2>

          {error && (
            <div className="mb-4">
              <Alert type="error" message={error} onClose={() => setError(null)} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Usuario"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ingresa tu usuario"
              autoComplete="username"
            />
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña"
              autoComplete="current-password"
            />
            <Button type="submit" loading={loading} className="w-full py-3 text-lg">
              {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-opticolor-gray-200">
            <p className="text-xs text-opticolor-gray-400 text-center">
              Cuentas de prueba: admin / admin123, tienda001 / tienda123, lab_central / lab123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
