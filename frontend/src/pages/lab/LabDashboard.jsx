import React, { useState, useEffect, useCallback } from 'react';
import { labAPI } from '../../services/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';

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

const StatusBadge = ({ status }) => {
  const config = {
    PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    PROCESSING: 'bg-blue-100 text-blue-800 border-blue-300',
    COMPLETED: 'bg-green-100 text-green-800 border-green-300',
    ERROR: 'bg-red-100 text-red-800 border-red-300',
  };
  const labels = { PENDING: 'Pendiente', PROCESSING: 'Procesando', COMPLETED: 'Completada', ERROR: 'Error' };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${config[status] || config.PENDING}`}>
      {labels[status] || status}
    </span>
  );
};

const LabDashboard = () => {
  // Estado del sistema
  const [agentState, setAgentState] = useState({ online: false, lastHeartbeat: null, secondsSinceLastBeat: null, vcaNetworkPath: '', agentIp: '', agentPort: '' });
  const [testPrintResult, setTestPrintResult] = useState(null);

  // Garantías
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });

  // Filtros
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [stores, setStores] = useState([]);
  const [refreshInterval, setRefreshInterval] = useState(0);

  // Config
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [vcaPath, setVcaPath] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    loadMeta();
    loadAgentStatus();
    loadWarranties(1);
  }, []);

  const loadMeta = async () => {
    try {
      const res = await labAPI.getMyStores();
      setStores(res.data.stores || []);
    } catch (e) { /* silencioso */ }
  };

  const loadAgentStatus = async () => {
    try {
      const res = await labAPI.agentStatus();
      setAgentState(res.data);
      setVcaPath(res.data.vcaNetworkPath || '');
    } catch (e) {
      setAgentState((prev) => ({ ...prev, online: false }));
    }
  };

  const loadWarranties = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: pagination.limit };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (storeFilter) params.storeId = storeFilter;

      const res = await labAPI.getWarranties(params);
      setWarranties(res.data.warranties || []);
      setPagination(res.data.pagination);
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error al cargar garantías' });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, storeFilter, pagination.limit]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval === 0) return;
    const id = setInterval(() => {
      loadAgentStatus();
      loadWarranties(pagination.page);
    }, refreshInterval * 1000);
    return () => clearInterval(id);
  }, [refreshInterval, pagination.page, loadWarranties]);

  const handleSearch = () => loadWarranties(1);

  const handleReprint = async (warrantyId, orderNumber) => {
    if (!window.confirm(`¿Reimprimir ticket de la orden ${orderNumber}?`)) return;
    try {
      await labAPI.reprintTicket(warrantyId);
      setAlert({ type: 'success', message: `Ticket de orden ${orderNumber} enviado a impresión.` });
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error al reimprimir' });
    }
  };

  const handleRegenerateVca = async (warrantyId, orderNumber) => {
    if (!window.confirm(`¿Regenerar archivo VCA para la orden ${orderNumber}?`)) return;
    try {
      await labAPI.regenerateVca(warrantyId);
      setAlert({ type: 'success', message: `Archivo VCA de orden ${orderNumber} regenerado.` });
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error al regenerar VCA' });
    }
  };

  const handleProcess = async (warrantyId, orderNumber) => {
    if (!window.confirm(`¿Procesar la orden ${orderNumber}? Se imprimirá el ticket y se generará el archivo VCA.`)) return;
    setProcessingId(warrantyId);
    try {
      const res = await labAPI.processWarranty(warrantyId);
      if (res.data.warning) {
        setAlert({ type: 'warning', message: res.data.warning });
      } else {
        setAlert({ type: 'success', message: `Orden ${orderNumber} procesada exitosamente.` });
      }
      await loadWarranties(pagination.page);
      await loadAgentStatus();
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error al procesar la garantía' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleTestPrint = async () => {
    setTestPrintResult(null);
    try {
      await labAPI.testPrint();
      setTestPrintResult('success');
    } catch (e) {
      setTestPrintResult('error');
    }
  };

  const handleSaveConfig = async () => {
    if (!vcaPath.trim()) return;
    setSavingConfig(true);
    try {
      await labAPI.updateConfig({ vcaNetworkPath: vcaPath });
      setAlert({ type: 'success', message: 'Ruta VCA actualizada.' });
      setConfigModalOpen(false);
      loadAgentStatus();
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error al guardar' });
    } finally {
      setSavingConfig(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatSeconds = (secs) => {
    if (secs === null || secs === undefined) return 'Nunca';
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-opticolor-gray-900 mb-2">Panel de Laboratorio</h1>
        <p className="text-opticolor-gray-600">Estado del sistema y gestión de garantías</p>
      </div>

      {alert && (
        <div className="mb-6">
          <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
        </div>
      )}

      {/* Sección 1: Estado del Sistema */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className={`border-l-4 ${agentState.online ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-opticolor-gray-500">Agente</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${agentState.online ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {agentState.online ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <p className="text-xs text-opticolor-gray-400">Última vez: {formatSeconds(agentState.secondsSinceLastBeat)}</p>
          <p className="text-xs text-opticolor-gray-400 mt-1">{agentState.agentIp}:{agentState.agentPort}</p>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <p className="text-sm text-opticolor-gray-500 mb-2">Impresora Bixolon</p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleTestPrint} className="px-3 py-1 text-xs">Probar Impresión</Button>
            {testPrintResult === 'success' && <span className="text-green-600 text-sm">✅ Ok</span>}
            {testPrintResult === 'error' && <span className="text-red-600 text-sm">❌ Falló</span>}
          </div>
        </Card>

        <Card className="border-l-4 border-l-teal-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-opticolor-gray-500">Ruta VCA</p>
            <Button variant="ghost" onClick={() => { setVcaPath(agentState.vcaNetworkPath || ''); setConfigModalOpen(true); }} className="px-2 py-1 text-xs">⚙️</Button>
          </div>
          <p className="text-xs text-opticolor-gray-700 font-mono truncate" title={agentState.vcaNetworkPath}>{agentState.vcaNetworkPath || '-'}</p>
        </Card>
      </div>

      {/* Sección 2: Garantías */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-opticolor-gray-900">Garantías del Laboratorio</h3>
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

        {/* Filtros */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 pb-4 border-b border-opticolor-gray-200">
          <div>
              <label className="block text-xs font-medium text-opticolor-gray-600 mb-1">Buscar OTG</label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Número de orden..."
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="text-sm py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-opticolor-gray-600 mb-1">Tienda</label>
            <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}
              className="w-full px-2 py-1.5 border border-opticolor-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-opticolor-red">
              <option value="">Todas</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-opticolor-gray-600 mb-1">Estado</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2 py-1.5 border border-opticolor-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-opticolor-red">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleSearch} className="px-4 py-1.5 text-sm w-full">Buscar</Button>
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-opticolor-red"></div></div>
        ) : warranties.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-opticolor-gray-700 mb-2">No hay garantías</h3>
            <p className="text-opticolor-gray-500">No se encontraron garantías con los filtros actuales</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-opticolor-gray-200">
                    <th className="text-left py-2 px-3 text-sm font-semibold text-opticolor-gray-700"># OTG</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-opticolor-gray-700">Tienda</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-opticolor-gray-700">Cliente</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-opticolor-gray-700">Tipo</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-opticolor-gray-700">Fecha</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-opticolor-gray-700">Estado</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-opticolor-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {warranties.map((w) => (
                    <tr key={w.id} className="border-b border-opticolor-gray-100 hover:bg-opticolor-gray-50 transition-colors">
                      <td className="py-3 px-3 font-mono text-sm text-opticolor-gray-800">{w.orderNumber}</td>
                      <td className="py-3 px-3 text-sm text-opticolor-gray-700">{w.store?.name || '-'}</td>
                      <td className="py-3 px-3 text-sm text-opticolor-gray-600 max-w-[120px] truncate">{w.orderData?.cliente_nombre || '-'}</td>
                      <td className="py-3 px-3 text-xs text-opticolor-gray-600 max-w-[100px] truncate">{w.warrantyType || '-'}</td>
                      <td className="py-3 px-3 text-xs text-opticolor-gray-500">{formatDate(w.createdAt)}</td>
                      <td className="py-3 px-3"><StatusBadge status={w.status} /></td>
                      <td className="py-3 px-3">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" onClick={() => { setSelectedWarranty(w); setDetailModalOpen(true); }} className="px-2 py-1 text-xs">Detalle</Button>
                          {w.status === 'COMPLETED' && (
                            <>
                              <Button variant="secondary" onClick={() => handleReprint(w.id, w.orderNumber)} className="px-2 py-1 text-xs">🖨️ Ticket</Button>
                              <Button variant="ghost" onClick={() => handleRegenerateVca(w.id, w.orderNumber)} className="px-2 py-1 text-xs">📄 VCA</Button>
                            </>
                          )}
                          {(w.status === 'PENDING' || w.status === 'ERROR') && (
                            <Button
                              variant="primary"
                              onClick={() => handleProcess(w.id, w.orderNumber)}
                              loading={processingId === w.id}
                              className="px-2 py-1 text-xs"
                            >
                              {w.status === 'ERROR' ? 'Procesar' : 'Procesar'}
                            </Button>
                          )}
                          {w.status === 'PROCESSING' && (
                            <Button variant="secondary" disabled className="px-2 py-1 text-xs">
                              Procesando...
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-between pt-3 border-t border-opticolor-gray-200 mt-3">
              <p className="text-xs text-opticolor-gray-600">
                {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={pagination.page <= 1} onClick={() => loadWarranties(pagination.page - 1)} className="px-3 py-1 text-xs">Anterior</Button>
                <Button variant="secondary" disabled={pagination.page >= pagination.totalPages} onClick={() => loadWarranties(pagination.page + 1)} className="px-3 py-1 text-xs">Siguiente</Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Modal Configuración */}
      <Modal isOpen={configModalOpen} onClose={() => setConfigModalOpen(false)} title="Configuración de Laboratorio" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-opticolor-gray-700 mb-1">IP Agente (solo lectura)</label>
            <Input value={agentState.agentIp || ''} disabled className="bg-opticolor-gray-50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-opticolor-gray-700 mb-1">Puerto Agente (solo lectura)</label>
            <Input value={agentState.agentPort || ''} disabled className="bg-opticolor-gray-50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-opticolor-gray-700 mb-1">Ruta VCA de Red</label>
            <Input
              value={vcaPath}
              onChange={(e) => setVcaPath(e.target.value)}
              placeholder="\\192.168.1.100\Lensware\VCA"
            />
            <p className="text-xs text-opticolor-gray-400 mt-1">Esta ruta la usa el agente para guardar los archivos .vca</p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-opticolor-gray-200">
            <Button variant="secondary" onClick={() => setConfigModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveConfig} loading={savingConfig}>Guardar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={detailModalOpen} onClose={() => { setDetailModalOpen(false); setSelectedWarranty(null); }} title={`Detalle OTG #${selectedWarranty?.orderNumber || ''}`} size="xl">
        {selectedWarranty && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-opticolor-gray-800 mb-3 border-b border-opticolor-gray-200 pb-2">Información General</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><p className="text-xs text-opticolor-gray-500">Número de OTG</p><p className="font-mono font-semibold text-opticolor-gray-800">{selectedWarranty.orderNumber}</p></div>
                <div><p className="text-xs text-opticolor-gray-500">Tienda</p><p className="text-opticolor-gray-800">{selectedWarranty.store?.name || '-'}</p></div>
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
                          <div className="flex-1"><p className="text-sm font-medium text-opticolor-gray-800">{item.descripcion}</p>{item.codigo_completo && <p className="text-xs font-mono text-opticolor-gray-500">{item.codigo_completo}</p>}</div>
                          <div className="text-right"><p className="text-sm font-semibold text-opticolor-gray-700">x{item.cantidad}</p>{item.es_montura && <span className="text-xs bg-opticolor-red text-white px-2 py-0.5 rounded">Montura</span>}{item.es_cristal && <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded ml-1">Cristal</span>}</div>
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
  );
};

export default LabDashboard;
