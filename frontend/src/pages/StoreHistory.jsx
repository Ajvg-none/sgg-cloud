// frontend/src/pages/StoreHistory.jsx
import React, { useState, useEffect } from 'react';
import { storeAPI } from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import Modal from '../components/ui/Modal';

const StoreHistory = () => {
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadWarranties();
  }, []);

  const loadWarranties = async () => {
    setLoading(true);
    try {
      const response = await storeAPI.getMyWarranties();
      setWarranties(response.data.warranties || []);
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Error al cargar el historial'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (warrantyId) => {
    setDetailLoading(true);
    try {
      const response = await storeAPI.getWarrantyDetail(warrantyId);
      setSelectedWarranty(response.data.warranty);
      setIsModalOpen(true);
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Error al cargar el detalle'
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedWarranty(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const StatusBadge = ({ status }) => {
    const config = {
      PENDING: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: 'Pendiente' },
      PROCESSING: { color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Procesando' },
      COMPLETED: { color: 'bg-green-100 text-green-800 border-green-300', label: 'Completada' },
      ERROR: { color: 'bg-red-100 text-red-800 border-red-300', label: 'Error' },
    };
    const { color, label } = config[status] || config.PENDING;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${color}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-opticolor-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-opticolor-gray-900 mb-2">
            Historial de Garantías
          </h1>
          <p className="text-opticolor-gray-600">
            Consulta el estado de todas las garantías registradas por tu tienda
          </p>
        </div>

        {/* Alertas */}
        {alert && (
          <div className="mb-6">
            <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
          </div>
        )}

        {/* Tabla de Garantías */}
        <Card>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-opticolor-red"></div>
            </div>
          ) : warranties.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-xl font-semibold text-opticolor-gray-700 mb-2">
                No hay garantías registradas
              </h3>
              <p className="text-opticolor-gray-500">
                Cuando registres una garantía, aparecerá aquí
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-opticolor-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700"># OTG</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Cliente</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Fecha de Registro</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Estado</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {warranties.map((warranty) => (
                    <tr key={warranty.id} className="border-b border-opticolor-gray-100 hover:bg-opticolor-gray-50 transition-colors">
                      <td className="py-4 px-4 font-mono text-sm text-opticolor-gray-800">{warranty.orderNumber}</td>
                      <td className="py-4 px-4 text-opticolor-gray-700">{warranty.orderData?.cliente_nombre || '-'}</td>
                      <td className="py-4 px-4 text-sm text-opticolor-gray-600">{formatDate(warranty.createdAt)}</td>
                      <td className="py-4 px-4"><StatusBadge status={warranty.status} /></td>
                      <td className="py-4 px-4 text-right">
                        <Button
                          variant="secondary"
                          onClick={() => handleViewDetail(warranty.id)}
                          loading={detailLoading && selectedWarranty?.id === warranty.id}
                          className="px-4 py-2 text-sm"
                        >
                          👁 Ver Detalle
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Modal de Detalle */}
        <Modal isOpen={isModalOpen} onClose={closeModal} title={`Detalle de Garantía OTG #${selectedWarranty?.orderNumber || ''}`} size="xl">
          {selectedWarranty && (
            <div className="space-y-6">
              {/* Información General */}
              <div>
                <h3 className="text-lg font-semibold text-opticolor-gray-800 mb-3 border-b border-opticolor-gray-200 pb-2">📋 Información General</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div><p className="text-xs text-opticolor-gray-500">Número de OTG</p><p className="font-mono font-semibold text-opticolor-gray-800">{selectedWarranty.orderNumber}</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">Cliente</p><p className="font-semibold text-opticolor-gray-800">{selectedWarranty.orderData?.cliente_nombre || '-'}</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">Código Completo</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.codigo_completo || '-'}</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">Fecha de Registro</p><p className="text-opticolor-gray-800">{formatDate(selectedWarranty.createdAt)}</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">Estado</p><StatusBadge status={selectedWarranty.status} /></div>
                  <div><p className="text-xs text-opticolor-gray-500">Tipo de Lente</p><p className="text-opticolor-gray-800">{selectedWarranty.orderData?.tipo_lente || '-'}</p></div>
                </div>
              </div>

              {/* Datos de la Garantía */}
              <div>
                <h3 className="text-lg font-semibold text-opticolor-gray-800 mb-3 border-b border-opticolor-gray-200 pb-2">📝 Datos de la Garantía</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <p className="text-xs text-opticolor-gray-500">Tipo de Garantía</p>
                    <p className="font-semibold text-opticolor-gray-800">{selectedWarranty.warrantyType || '-'}</p>
                  </div>
                  {selectedWarranty.storeObservations && (
                    <div>
                      <p className="text-xs text-opticolor-gray-500">Observaciones de la Tienda</p>
                      <p className="text-opticolor-gray-700 bg-opticolor-gray-50 p-3 rounded-lg text-sm italic">
                        {selectedWarranty.storeObservations}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Ojo Derecho */}
              <div>
                <h3 className="text-lg font-semibold text-opticolor-gray-800 mb-3 border-b border-opticolor-gray-200 pb-2">👁 Ojo Derecho (OD)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><p className="text-xs text-opticolor-gray-500">Esfera</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.od_esfera ?? '-'}</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">Cilindro</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.od_cilindro ?? '-'}</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">Eje</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.od_eje ?? '-'}°</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">Adición</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.od_adicion ?? '-'}</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">DP Centro</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.od_dp_centro ?? '-'}</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">DP Cerca</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.od_dp_cerca ?? '-'}</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">Altura</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.altura_od ?? '-'}</p></div>
                </div>
              </div>

              {/* Ojo Izquierdo */}
              <div>
                <h3 className="text-lg font-semibold text-opticolor-gray-800 mb-3 border-b border-opticolor-gray-200 pb-2">👁 Ojo Izquierdo (OI)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><p className="text-xs text-opticolor-gray-500">Esfera</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.oi_esfera ?? '-'}</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">Cilindro</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.oi_cilindro ?? '-'}</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">Eje</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.oi_eje ?? '-'}°</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">Adición</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.oi_adicion ?? '-'}</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">DP Centro</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.oi_dp_centro ?? '-'}</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">DP Cerca</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.oi_dp_cerca ?? '-'}</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">Altura</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.altura_oi ?? '-'}</p></div>
                </div>
              </div>

              {/* Medidas de Montura */}
              <div>
                <h3 className="text-lg font-semibold text-opticolor-gray-800 mb-3 border-b border-opticolor-gray-200 pb-2">🕶️ Medidas de Montura</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><p className="text-xs text-opticolor-gray-500">Horizontal</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.montura_horizontal ?? '-'}</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">Vertical</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.montura_vertical ?? '-'}</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">Puente</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.montura_puente ?? '-'}</p></div>
                  <div><p className="text-xs text-opticolor-gray-500">Diámetro Máximo</p><p className="font-mono text-opticolor-gray-800">{selectedWarranty.orderData?.montura_diametro_max ?? '-'}</p></div>
                </div>
              </div>

              {/* Ítems */}
              {selectedWarranty.orderData?.items?.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-opticolor-gray-800 mb-3 border-b border-opticolor-gray-200 pb-2">📦 Ítems de la Orden</h3>
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
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default StoreHistory;