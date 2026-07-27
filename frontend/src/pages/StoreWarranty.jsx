import React, { useState } from 'react';
import { storeAPI } from '../services/api';
import { validateOpticalFields } from '../utils/validators';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Alert from '../components/ui/Alert';

const WARRANTY_TYPES = [
  'DP mal tomada',
  'Error de medición',
  'Error de DP',
  'Error DP + RX',
  'Error PIT + DP',
  'Error de facturación',
  'Defecto de producto',
  'Cambio de material',
  'Error de R',
  'Error de altura',
  'Error de transcripción',
  'Mal asesoramiento',
  'Mal manejo del producto',
  'Insatisfacción del cliente',
  'Altura mal tomada',
];

const StoreWarranty = () => {
  const [orderNumber, setOrderNumber] = useState('');
  const [orderData, setOrderData] = useState(null);
  const [warrantyType, setWarrantyType] = useState('');
  const [storeObservations, setStoreObservations] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);

  const handleSearch = async () => {
    if (!orderNumber.trim()) {
      setAlert({ type: 'warning', message: 'Por favor ingresa un número de OTG' });
      return;
    }

    setLoading(true);
    setAlert(null);
    setErrors({});

    try {
      const response = await storeAPI.getOrder(orderNumber);
      setOrderData(response.data.order);
      setAlert({ type: 'success', message: 'OTG encontrada. Puedes editar los campos y guardar.' });
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.details || 'Error al buscar la OTG'
      });
      setOrderData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setOrderData(prev => ({
      ...prev,
      [field]: value
    }));

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleSave = async () => {
    const validationErrors = validateOpticalFields(orderData);

    if (!warrantyType) {
      validationErrors.warrantyType = 'Selecciona un tipo de garantía';
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setAlert({ type: 'error', message: 'Por favor corrige los errores antes de guardar' });
      return;
    }

    setSaving(true);
    setAlert(null);

    try {
      await storeAPI.createWarranty({
        orderNumber: orderData.orden_numero,
        orderData: orderData,
        warrantyType,
        storeObservations: storeObservations.trim() || null,
      });
      setAlert({ type: 'success', message: 'Garantía guardada exitosamente!' });

      setTimeout(() => {
        setOrderNumber('');
        setOrderData(null);
        setWarrantyType('');
        setStoreObservations('');
        setAlert(null);
      }, 2000);
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.details?.join(', ') || 'Error al guardar la garantía'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-opticolor-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-opticolor-gray-900 mb-2">
            Nueva Garantía
          </h1>
          <p className="text-opticolor-gray-600">
            Busca una OTG de GesVision y completa los datos de la garantía
          </p>
        </div>

        {alert && (
          <div className="mb-6">
            <Alert
              type={alert.type}
              message={alert.message}
              onClose={() => setAlert(null)}
            />
          </div>
        )}

        <Card className="mb-6">
          <h2 className="text-xl font-semibold text-opticolor-gray-800 mb-4">
            Buscar OTG
          </h2>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                label="Número de OTG"
                placeholder="Ej: 12345"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                disabled={loading || saving}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleSearch}
                loading={loading}
                disabled={saving}
              >
                🔍 Buscar
              </Button>
            </div>
          </div>
        </Card>

        {orderData && (
          <div className="space-y-6 animate-fade-in">
            <Card>
              <h2 className="text-xl font-semibold text-opticolor-gray-800 mb-4">
                Datos del Cliente
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Nombre del Cliente"
                  value={orderData.cliente_nombre || ''}
                  onChange={(e) => handleFieldChange('cliente_nombre', e.target.value)}
                  disabled={saving}
                />
                <Input
                  label="Código Completo"
                  value={orderData.codigo_completo || ''}
                  disabled
                />
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-opticolor-gray-800 mb-4">
                Ojo Derecho (OD)
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Input label="Esfera" type="number" step="0.01" value={orderData.od_esfera ?? ''} onChange={(e) => handleFieldChange('od_esfera', e.target.value)} error={errors.od_esfera} disabled={saving} />
                <Input label="Cilindro" type="number" step="0.01" value={orderData.od_cilindro ?? ''} onChange={(e) => handleFieldChange('od_cilindro', e.target.value)} error={errors.od_cilindro} disabled={saving} />
                <Input label="Eje" type="number" min="0" max="180" value={orderData.od_eje ?? ''} onChange={(e) => handleFieldChange('od_eje', e.target.value)} error={errors.od_eje} disabled={saving} />
                <Input label="Adición" type="number" step="0.01" value={orderData.od_adicion ?? ''} onChange={(e) => handleFieldChange('od_adicion', e.target.value)} error={errors.od_adicion} disabled={saving} />
                <Input label="DP Centro" type="number" step="0.1" value={orderData.od_dp_centro ?? ''} onChange={(e) => handleFieldChange('od_dp_centro', e.target.value)} error={errors.od_dp_centro} disabled={saving} />
                <Input label="DP Cerca" type="number" step="0.1" value={orderData.od_dp_cerca ?? ''} onChange={(e) => handleFieldChange('od_dp_cerca', e.target.value)} error={errors.od_dp_cerca} disabled={saving} />
                <Input label="Altura" type="number" step="0.1" value={orderData.altura_od ?? ''} onChange={(e) => handleFieldChange('altura_od', e.target.value)} error={errors.altura_od} disabled={saving} />
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-opticolor-gray-800 mb-4">
                Ojo Izquierdo (OI)
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Input label="Esfera" type="number" step="0.01" value={orderData.oi_esfera ?? ''} onChange={(e) => handleFieldChange('oi_esfera', e.target.value)} error={errors.oi_esfera} disabled={saving} />
                <Input label="Cilindro" type="number" step="0.01" value={orderData.oi_cilindro ?? ''} onChange={(e) => handleFieldChange('oi_cilindro', e.target.value)} error={errors.oi_cilindro} disabled={saving} />
                <Input label="Eje" type="number" min="0" max="180" value={orderData.oi_eje ?? ''} onChange={(e) => handleFieldChange('oi_eje', e.target.value)} error={errors.oi_eje} disabled={saving} />
                <Input label="Adición" type="number" step="0.01" value={orderData.oi_adicion ?? ''} onChange={(e) => handleFieldChange('oi_adicion', e.target.value)} error={errors.oi_adicion} disabled={saving} />
                <Input label="DP Centro" type="number" step="0.1" value={orderData.oi_dp_centro ?? ''} onChange={(e) => handleFieldChange('oi_dp_centro', e.target.value)} error={errors.oi_dp_centro} disabled={saving} />
                <Input label="DP Cerca" type="number" step="0.1" value={orderData.oi_dp_cerca ?? ''} onChange={(e) => handleFieldChange('oi_dp_cerca', e.target.value)} error={errors.oi_dp_cerca} disabled={saving} />
                <Input label="Altura" type="number" step="0.1" value={orderData.altura_oi ?? ''} onChange={(e) => handleFieldChange('altura_oi', e.target.value)} error={errors.altura_oi} disabled={saving} />
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-opticolor-gray-800 mb-4">
                Medidas de Montura
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Input label="Horizontal" type="number" step="0.1" value={orderData.montura_horizontal ?? ''} onChange={(e) => handleFieldChange('montura_horizontal', e.target.value)} disabled={saving} />
                <Input label="Vertical" type="number" step="0.1" value={orderData.montura_vertical ?? ''} onChange={(e) => handleFieldChange('montura_vertical', e.target.value)} disabled={saving} />
                <Input label="Puente" type="number" step="0.1" value={orderData.montura_puente ?? ''} onChange={(e) => handleFieldChange('montura_puente', e.target.value)} disabled={saving} />
                <Input label="Diámetro Máximo" type="number" step="0.1" value={orderData.montura_diametro_max ?? ''} onChange={(e) => handleFieldChange('montura_diametro_max', e.target.value)} disabled={saving} />
              </div>
            </Card>

            {/* Tipo de Garantía + Observaciones */}
            <Card>
              <h2 className="text-xl font-semibold text-opticolor-gray-800 mb-4">
                Datos de la Garantía
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-opticolor-gray-700 mb-1">
                    Tipo de Garantía *
                  </label>
                  <select
                    value={warrantyType}
                    onChange={(e) => { setWarrantyType(e.target.value); if (errors.warrantyType) setErrors(prev => ({ ...prev, warrantyType: null })); }}
                    disabled={saving}
                    className={`w-full px-4 py-2 border-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-opticolor-red focus:border-transparent ${errors.warrantyType ? 'border-opticolor-red-light bg-red-50' : 'border-opticolor-gray-200 hover:border-opticolor-gray-300'}`}
                  >
                    <option value="">Seleccionar tipo...</option>
                    {WARRANTY_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  {errors.warrantyType && (
                    <p className="text-sm text-opticolor-red-light mt-1">{errors.warrantyType}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-opticolor-gray-700 mb-1">
                    Observaciones
                  </label>
                  <textarea
                    value={storeObservations}
                    onChange={(e) => setStoreObservations(e.target.value)}
                    maxLength={300}
                    rows={3}
                    disabled={saving}
                    placeholder="Describe brevemente el caso (máx. 300 caracteres)"
                    className={`w-full px-4 py-2 border-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-opticolor-red focus:border-transparent border-opticolor-gray-200 hover:border-opticolor-gray-300 disabled:bg-opticolor-gray-50 disabled:cursor-not-allowed`}
                  />
                  <p className="text-xs text-opticolor-gray-400 mt-1 text-right">
                    {storeObservations.length}/300
                  </p>
                </div>
              </div>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                loading={saving}
                disabled={!orderData}
                className="min-w-[200px]"
              >
                💾 Guardar Garantía
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreWarranty;
