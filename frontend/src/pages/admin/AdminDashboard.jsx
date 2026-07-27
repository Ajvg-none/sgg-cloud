import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../services/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Input from '../../components/ui/Input';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'PROCESSING', label: 'Procesando' },
  { value: 'COMPLETED', label: 'Completada' },
  { value: 'ERROR', label: 'Error' },
];

const StatusBadge = ({ status }) => {
  const config = {
    PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    PROCESSING: 'bg-blue-100 text-blue-800 border-blue-300',
    COMPLETED: 'bg-green-100 text-green-800 border-green-300',
    ERROR: 'bg-red-100 text-red-800 border-red-300',
  };
  const labels = { PENDING: 'Pendiente', PROCESSING: 'Procesando', COMPLETED: 'Completada', ERROR: 'Error' };
  const color = config[status] || config.PENDING;
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${color}`}>
      {labels[status] || status}
    </span>
  );
};

const REFRESH_OPTIONS = [
  { value: 0, label: 'OFF' },
  { value: 5, label: '5 seg' },
  { value: 10, label: '10 seg' },
  { value: 30, label: '30 seg' },
];

const AdminDashboard = () => {
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [refreshInterval, setRefreshInterval] = useState(0);

  const [filters, setFilters] = useState({
    search: '',
    storeId: '',
    labId: '',
    status: '',
    startDate: '',
    endDate: '',
  });

  const [stores, setStores] = useState([]);
  const [labs, setLabs] = useState([]);

  useEffect(() => {
    loadMeta();
  }, []);

  const loadMeta = async () => {
    try {
      const [storesRes, labsRes] = await Promise.all([
        adminAPI.getStores(),
        adminAPI.getLabs(),
      ]);
      setStores(storesRes.data.stores || []);
      setLabs(labsRes.data.labs || []);
    } catch (e) {
      // Silencioso — los dropdowns simplemente estarán vacíos
    }
  };

  const loadWarranties = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: pagination.limit };
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.storeId) params.storeId = filters.storeId;
      if (filters.labId) params.labId = filters.labId;
      if (filters.status) params.status = filters.status;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const res = await adminAPI.getWarrantiesDashboard(params);
      setWarranties(res.data.warranties || []);
      setPagination(res.data.pagination);
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error al cargar garantías' });
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit]);

  useEffect(() => {
    loadWarranties(1);
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval === 0) return;
    const id = setInterval(() => loadWarranties(pagination.page), refreshInterval * 1000);
    return () => clearInterval(id);
  }, [refreshInterval, pagination.page, loadWarranties]);

  const handleClearFilters = () => {
    setFilters({ search: '', storeId: '', labId: '', status: '', startDate: '', endDate: '' });
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => {
    loadWarranties(1);
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-opticolor-gray-900 mb-2">Dashboard de Garantías</h1>
        <p className="text-opticolor-gray-600">Vista general de todas las garantías del sistema</p>
      </div>

      {alert && (
        <div className="mb-6">
          <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
        </div>
      )}

      {/* Filtros */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-opticolor-gray-700">Filtros</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-opticolor-gray-500">Auto-refresh:</span>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
              className="px-2 py-1 border border-opticolor-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-opticolor-red"
            >
              {REFRESH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-opticolor-gray-700 mb-1">Buscar OT</label>
            <Input
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Número de orden..."
              className="py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-opticolor-gray-700 mb-1">Laboratorio</label>
            <select
              value={filters.labId}
              onChange={(e) => handleFilterChange('labId', e.target.value)}
              className="w-full px-3 py-2 border border-opticolor-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-opticolor-red focus:border-transparent"
            >
              <option value="">Todos</option>
              {labs.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-opticolor-gray-700 mb-1">Tienda</label>
            <select
              value={filters.storeId}
              onChange={(e) => handleFilterChange('storeId', e.target.value)}
              className="w-full px-3 py-2 border border-opticolor-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-opticolor-red focus:border-transparent"
            >
              <option value="">Todas</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.accn})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-opticolor-gray-700 mb-1">Estado</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-opticolor-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-opticolor-red focus:border-transparent"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-opticolor-gray-700 mb-1">Desde</label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-opticolor-gray-700 mb-1">Hasta</label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={handleSearch} className="px-4 py-2 text-sm">Buscar</Button>
            <Button variant="secondary" onClick={handleClearFilters} className="px-4 py-2 text-sm">Limpiar</Button>
          </div>
        </div>
      </Card>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {['PENDING', 'PROCESSING', 'COMPLETED', 'ERROR'].map((status) => {
          const count = (warranties || []).filter((w) => w.status === status).length;
          const colors = {
            PENDING: 'border-l-yellow-500',
            PROCESSING: 'border-l-blue-500',
            COMPLETED: 'border-l-green-500',
            ERROR: 'border-l-red-500',
          };
          const labels = { PENDING: 'Pendientes', PROCESSING: 'Procesando', COMPLETED: 'Completadas', ERROR: 'Errores' };
          return (
            <Card key={status} className={`border-l-4 ${colors[status]}`}>
              <p className="text-sm text-opticolor-gray-500">{labels[status]}</p>
              <p className="text-3xl font-bold text-opticolor-gray-900">{count}</p>
            </Card>
          );
        })}
      </div>

      {/* Tabla */}
      <Card>
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-opticolor-red"></div>
          </div>
        ) : warranties.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-opticolor-gray-700 mb-2">No hay garantías</h3>
            <p className="text-opticolor-gray-500">No se encontraron garantías con los filtros seleccionados</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-opticolor-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700"># Orden</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Tienda</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Laboratorio</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Estado</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {warranties.map((w) => (
                    <tr key={w.id} className="border-b border-opticolor-gray-100 hover:bg-opticolor-gray-50 transition-colors">
                      <td className="py-4 px-4 font-mono text-sm text-opticolor-gray-800">{w.orderNumber}</td>
                      <td className="py-4 px-4 text-sm text-opticolor-gray-700">{w.store?.name || '-'}</td>
                      <td className="py-4 px-4 text-sm text-opticolor-gray-700">{w.lab?.name || '-'}</td>
                      <td className="py-4 px-4"><StatusBadge status={w.status} /></td>
                      <td className="py-4 px-4 text-sm text-opticolor-gray-600">{formatDate(w.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-between pt-4 border-t border-opticolor-gray-200 mt-4">
              <p className="text-sm text-opticolor-gray-600">
                Mostrando {((pagination.page - 1) * pagination.limit) + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={pagination.page <= 1}
                  onClick={() => loadWarranties(pagination.page - 1)}
                  className="px-3 py-1 text-sm"
                >
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => loadWarranties(pagination.page + 1)}
                  className="px-3 py-1 text-sm"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default AdminDashboard;
