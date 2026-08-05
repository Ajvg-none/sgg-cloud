import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, RefreshCw, Eye } from 'lucide-react';
import { adminAPI } from '../../services/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Select from '../../components/ui/Select';
import Pagination from '../../components/ui/Pagination';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'PROCESSING', label: 'Procesando' },
  { value: 'COMPLETED', label: 'Completada' },
  { value: 'ERROR', label: 'Error' },
];

const REFRESH_OPTIONS = [
  { value: 0, label: 'OFF' },
  { value: 5, label: '5 seg' },
  { value: 10, label: '10 seg' },
  { value: 30, label: '30 seg' },
];
const LIMIT_OPTIONS = [
  { value: 5, label: '5 filas' },
  { value: 10, label: '10 filas' },
  { value: 20, label: '20 filas' },
  { value: 50, label: '50 filas' },
];

const WARRANTY_TYPES = [
  'DP mal tomada', 'Error de medición', 'Error de DP', 'Error DP + RX',
  'Error PIT + DP', 'Error de facturación', 'Defecto de producto', 'Cambio de material',
  'Error de R', 'Error de altura', 'Error de transcripción', 'Mal asesoramiento',
  'Mal manejo del producto', 'Insatisfacción del cliente', 'Altura mal tomada',
];

const OrderNumber = ({ code }) => {
  if (!code) return <span className="text-sm text-opticolor-gray-400">-</span>;
  const idx = code.lastIndexOf('-');
  const suffix = idx > 0 ? code.slice(idx + 1) : '';
  const hasRevision = suffix !== '' && /^\d+$/.test(suffix);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={code}>
      <span className="text-sm font-semibold text-opticolor-gray-800 tabular-nums tracking-tight">
        {hasRevision ? code.slice(0, idx) : code}
      </span>
      {hasRevision && (
        <span className="rounded-md border border-opticolor-gray-200 bg-opticolor-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-opticolor-gray-500">
          R{suffix}
        </span>
      )}
    </span>
  );
};

const AdminDashboard = () => {
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [statusCounts, setStatusCounts] = useState({});
  const [refreshInterval, setRefreshInterval] = useState(0);

  const [filters, setFilters] = useState({
    search: '',
    storeId: '',
    labId: '',
    status: '',
    warrantyType: '',
    startDate: '',
    endDate: '',
  });

  const [stores, setStores] = useState([]);
  const [labs, setLabs] = useState([]);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedWarranty, setSelectedWarranty] = useState(null);

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

    const loadWarranties = useCallback(async (page = 1, limitOverride) => {
    setLoading(true);
    try {
    const params = { page, limit: limitOverride ?? pagination.limit };
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.storeId) params.storeId = filters.storeId;
      if (filters.labId) params.labId = filters.labId;
      if (filters.status) params.status = filters.status;
      if (filters.warrantyType) params.warrantyType = filters.warrantyType;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

    const res = await adminAPI.getWarrantiesDashboard(params);
    setWarranties(res.data.warranties || []);
    setPagination(res.data.pagination);
    setStatusCounts(res.data.statusCounts || {});
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error al cargar garantías' });
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit]);

useEffect(() => {
loadWarranties(1);
}, []);

// Re-consulta automática con debounce cuando cambia cualquier filtro
const isFirstFiltersRun = useRef(true);
useEffect(() => {
  if (isFirstFiltersRun.current) {
    isFirstFiltersRun.current = false;
    return;
  }
  const timer = setTimeout(() => loadWarranties(1), 400);
  return () => clearTimeout(timer);
}, [filters]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval === 0) return;
    const id = setInterval(() => loadWarranties(pagination.page), refreshInterval * 1000);
    return () => clearInterval(id);
  }, [refreshInterval, pagination.page, loadWarranties]);

  const handleClearFilters = () => {
    setFilters({ search: '', storeId: '', labId: '', status: '', warrantyType: '', startDate: '', endDate: '' });
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => {
  loadWarranties(1);
  };
  const handleLimitChange = (newLimit) => {
    setPagination((prev) => ({ ...prev, limit: newLimit }));
    loadWarranties(1, newLimit);
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
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
            <Select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
              options={REFRESH_OPTIONS}
              className="py-1 text-xs"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
          <div>
              <label className="block text-sm font-medium text-opticolor-gray-700 mb-1">Buscar OTG</label>
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
            <Select
              value={filters.labId}
              onChange={(e) => handleFilterChange('labId', e.target.value)}
              options={[{ value: '', label: 'Todos' }, ...labs.map((l) => ({ value: l.id, label: l.name }))]}
              className="py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-opticolor-gray-700 mb-1">Tienda</label>
            <Select
              value={filters.storeId}
              onChange={(e) => handleFilterChange('storeId', e.target.value)}
              options={[{ value: '', label: 'Todas' }, ...stores.map((s) => ({ value: s.id, label: `${s.name} (${s.accn})` }))]}
              className="py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-opticolor-gray-700 mb-1">Estado</label>
            <Select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              options={STATUS_OPTIONS}
              className="py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-opticolor-gray-700 mb-1">Tipo Garantía</label>
            <Select
              value={filters.warrantyType}
              onChange={(e) => handleFilterChange('warrantyType', e.target.value)}
              options={[{ value: '', label: 'Todos' }, ...WARRANTY_TYPES.map((type) => ({ value: type, label: type }))]}
              className="py-2 text-sm"
            />
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
      {['PENDING', 'PROCESSING', 'COMPLETED', 'ERROR'].map((status, index) => {
        const count = statusCounts[status] || 0;
        const active = filters.status === status;
          const colors = {
            PENDING: 'border-l-yellow-500',
            PROCESSING: 'border-l-blue-500',
            COMPLETED: 'border-l-green-500',
            ERROR: 'border-l-red-500',
          };
          const labels = { PENDING: 'Pendientes', PROCESSING: 'Procesando', COMPLETED: 'Completadas', ERROR: 'Errores' };
          return (
          <Card
            key={status}
            onClick={() => handleFilterChange('status', active ? '' : status)}
            style={{ animationDelay: `${index * 60}ms` }}
            className={`border-l-4 ${colors[status]} animate-fade-in cursor-pointer transition-all hover:shadow-lg ${active ? 'ring-2 ring-opticolor-red' : ''}`}
          >
            <p className="text-sm text-opticolor-gray-500">{labels[status]}</p>
            <p className="text-3xl font-bold text-opticolor-gray-900">{count}</p>
            <p className="mt-1 text-[11px] text-opticolor-gray-400">
              {active ? 'Click para quitar el filtro' : 'Click para filtrar'}
            </p>
          </Card>
          );
        })}
      </div>

   {/* Tabla */}
   <Card>
     {/* Toolbar: búsqueda rápida, filas por página y actualizar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-5">
       <div className="relative flex-1 max-w-sm">
         <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-opticolor-gray-400" aria-hidden="true" />
         <Input
           value={filters.search}
           onChange={(e) => handleFilterChange('search', e.target.value)}
           onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
           placeholder="Buscar por OTG…"
           aria-label="Buscar por OTG"
           className="pl-9 py-2 text-sm"
         />
       </div>
       <div className="flex items-center gap-2 md:ml-auto">
         <Select
           value={pagination.limit}
           onChange={(e) => handleLimitChange(parseInt(e.target.value))}
           options={LIMIT_OPTIONS}
           aria-label="Filas por página"
           className="py-2 text-sm"
         />
         <Button variant="secondary" onClick={() => loadWarranties(pagination.page)} disabled={loading} className="px-3 py-2 text-sm">
           <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
           Actualizar
         </Button>
       </div>
     </div>
     {loading ? (
          <Spinner size="lg" className="py-12" />
        ) : warranties.length === 0 ? (
          <EmptyState
            title="No hay garantías"
            description="No se encontraron garantías con los filtros seleccionados"
          />
        ) : (
          <>
        <div className="overflow-x-auto">
           <table className="w-full table-fixed">
             <colgroup>
               <col style={{ width: '20%' }} />
               <col style={{ width: '14%' }} />
               <col style={{ width: '15%' }} />
               <col style={{ width: '16%' }} />
               <col style={{ width: '10%' }} />
               <col style={{ width: '15%' }} />
               <col style={{ width: '10%' }} />
             </colgroup>
             <thead>
               <tr className="bg-opticolor-gray-100 border-b-2 border-opticolor-red">
                 <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-opticolor-gray-600"># OTG</th>
                 <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-opticolor-gray-600">Tienda</th>
                 <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-opticolor-gray-600">Laboratorio</th>
                 <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-opticolor-gray-600">Tipo</th>
                 <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-opticolor-gray-600">Estado</th>
                 <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-opticolor-gray-600">Fecha</th>
                 <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-opticolor-gray-600">Acciones</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-opticolor-gray-100 bg-white">
               {warranties.map((w) => (
                 <tr key={w.id} className="transition-colors even:bg-opticolor-gray-50/60 hover:bg-red-50/70">
                   <td className="py-3.5 px-4 align-middle text-center overflow-hidden whitespace-nowrap text-ellipsis">
                     <OrderNumber code={w.orderNumber} />
                   </td>
                   <td className="py-3.5 px-4 align-middle text-center text-sm font-medium text-opticolor-gray-700 overflow-hidden whitespace-nowrap text-ellipsis">
                     {w.store?.name || '-'}
                   </td>
                   <td className="py-3.5 px-4 align-middle text-center text-sm text-opticolor-gray-700 overflow-hidden whitespace-nowrap text-ellipsis">
                     {w.lab?.name || '-'}
                   </td>
                   <td className="py-3.5 px-4 align-middle text-center text-sm text-opticolor-gray-600 overflow-hidden whitespace-nowrap text-ellipsis" title={w.warrantyType || ''}>
                     {w.warrantyType || '-'}
                   </td>
                   <td className="py-3.5 px-4 align-middle text-center">
                     <StatusBadge status={w.status} />
                   </td>
                   <td className="py-3.5 px-4 align-middle text-center text-sm text-opticolor-gray-500 whitespace-nowrap tabular-nums">
                     {formatDate(w.createdAt)}
                   </td>
                   <td className="py-3.5 px-4 align-middle text-center">
                     <Button
                       variant="secondary"
                       size="sm"
                       onClick={() => { setSelectedWarranty(w); setDetailModalOpen(true); }}
                     >
                       <Eye className="h-4 w-4" aria-hidden="true" />
                       Detalle
                     </Button>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>

            {/* Paginación */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5">
           <p className="text-sm text-opticolor-gray-600">
             Mostrando <span className="font-semibold">{((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)}</span> de <span className="font-semibold">{pagination.total}</span> garantías
           </p>
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                onChange={(page) => loadWarranties(page)}
              />
            </div>
          </>
        )}
      </Card>

      <Modal isOpen={detailModalOpen} onClose={() => { setDetailModalOpen(false); setSelectedWarranty(null); }} title={`Detalle OTG #${selectedWarranty?.orderNumber || ''}`} size="xl">
        {selectedWarranty && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-opticolor-gray-800 mb-3 border-b border-opticolor-gray-200 pb-2">Información General</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><p className="text-xs text-opticolor-gray-500">Número de OTG</p><p className="font-mono font-semibold text-opticolor-gray-800">{selectedWarranty.orderNumber}</p></div>
                <div><p className="text-xs text-opticolor-gray-500">Tienda</p><p className="text-opticolor-gray-800">{selectedWarranty.store?.name || '-'}</p></div>
                <div><p className="text-xs text-opticolor-gray-500">Laboratorio</p><p className="text-opticolor-gray-800">{selectedWarranty.lab?.name || '-'}</p></div>
                <div><p className="text-xs text-opticolor-gray-500">Estado</p><StatusBadge status={selectedWarranty.status} /></div>
                <div><p className="text-xs text-opticolor-gray-500">Fecha de Registro</p><p className="text-opticolor-gray-800">{formatDate(selectedWarranty.createdAt)}</p></div>
                <div><p className="text-xs text-opticolor-gray-500">Cliente</p><p className="text-opticolor-gray-800">{selectedWarranty.orderData?.cliente_nombre || '-'}</p></div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-opticolor-gray-800 mb-3 border-b border-opticolor-gray-200 pb-2">Datos de la Garantía</h3>
              <div className="grid grid-cols-1 gap-4">
                <div><p className="text-xs text-opticolor-gray-500">Tipo de Garantía</p><p className="font-semibold text-opticolor-gray-800">{selectedWarranty.warrantyType || '-'}</p></div>
                {selectedWarranty.storeObservations && (
                  <div><p className="text-xs text-opticolor-gray-500">Observaciones de la Tienda</p><p className="text-opticolor-gray-700 bg-opticolor-gray-50 p-3 rounded-lg text-sm italic">{selectedWarranty.storeObservations}</p></div>
                )}
              </div>
            </div>

            {selectedWarranty.orderData && (
              <>
                <div>
                  <h3 className="text-lg font-semibold text-opticolor-gray-800 mb-3 border-b border-opticolor-gray-200 pb-2">Ojo Derecho (OD)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-xs text-opticolor-gray-500">Esfera</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData.od_esfera ?? '-'}</p></div>
                    <div><p className="text-xs text-opticolor-gray-500">Cilindro</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData.od_cilindro ?? '-'}</p></div>
                    <div><p className="text-xs text-opticolor-gray-500">Eje</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData.od_eje ?? '-'}°</p></div>
                    <div><p className="text-xs text-opticolor-gray-500">Adición</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData.od_adicion ?? '-'}</p></div>
                    <div><p className="text-xs text-opticolor-gray-500">DP</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData.od_dp_centro ?? selectedWarranty.orderData.od_dp_cerca ?? '-'}</p></div>
                    <div><p className="text-xs text-opticolor-gray-500">Altura</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData.altura_od ?? '-'}</p></div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-opticolor-gray-800 mb-3 border-b border-opticolor-gray-200 pb-2">Ojo Izquierdo (OI)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-xs text-opticolor-gray-500">Esfera</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData.oi_esfera ?? '-'}</p></div>
                    <div><p className="text-xs text-opticolor-gray-500">Cilindro</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData.oi_cilindro ?? '-'}</p></div>
                    <div><p className="text-xs text-opticolor-gray-500">Eje</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData.oi_eje ?? '-'}°</p></div>
                    <div><p className="text-xs text-opticolor-gray-500">Adición</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData.oi_adicion ?? '-'}</p></div>
                    <div><p className="text-xs text-opticolor-gray-500">DP</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData.oi_dp_centro ?? selectedWarranty.orderData.oi_dp_cerca ?? '-'}</p></div>
                    <div><p className="text-xs text-opticolor-gray-500">Altura</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData.altura_oi ?? '-'}</p></div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-opticolor-gray-800 mb-3 border-b border-opticolor-gray-200 pb-2">Medidas de Montura</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-xs text-opticolor-gray-500">Horizontal</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData.montura_horizontal ?? '-'}</p></div>
                    <div><p className="text-xs text-opticolor-gray-500">Vertical</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData.montura_vertical ?? '-'}</p></div>
                    <div><p className="text-xs text-opticolor-gray-500">Puente</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData.montura_puente ?? '-'}</p></div>
                    <div><p className="text-xs text-opticolor-gray-500">Diámetro Máx</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData.montura_diametro_max ?? '-'}</p></div>
                  </div>
                </div>
                {selectedWarranty.orderData.items?.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-opticolor-gray-800 mb-3 border-b border-opticolor-gray-200 pb-2">Ítems de la OTG</h3>
                    <div className="space-y-2">
                      {selectedWarranty.orderData.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-opticolor-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-opticolor-gray-800">{item.descripcion}</p>
                            {item.codigo_completo && <p className="text-xs font-mono text-opticolor-gray-500">{item.codigo_completo}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-opticolor-gray-700">x{item.cantidad}</p>
                            {item.es_montura && <span className="text-xs bg-opticolor-red text-white px-2 py-0.5 rounded">Montura</span>}
                            {item.es_cristal && <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded ml-1">Cristal</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
      </div>
    </div>
  );
};

export default AdminDashboard;
