import React, { useState } from 'react';
import { storeAPI } from '../services/api';
import { validateOpticalFields } from '../utils/validators';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Alert from '../components/ui/Alert';

const WARRANTY_TYPES = [
  'Error de Medida',
  'Error de Transcripcion',
  'Error de RX'
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

  // ============================================================
  // NUEVA FUNCIÓN: controla qué campos se bloquean según el tipo
  // ============================================================
  const isFieldDisabled = (fieldName) => {
    // Si no hay tipo seleccionado, todo bloqueado
    if (!warrantyType) return true;

    // Si es "Error de Medida": solo se permiten DP, Altura y Montura
    if (warrantyType === 'Error de Medida') {
      const allowedFields = [
        'od_dp_centro', 'od_dp_cerca',
        'oi_dp_centro', 'oi_dp_cerca',
        'altura_od', 'altura_oi',
        'montura_horizontal', 'montura_vertical',
        'montura_puente', 'montura_diametro_max'
      ];
      return !allowedFields.includes(fieldName);
    }

    // Si es "Error de Transcripcion" o "Error de RX": todo habilitado
    if (warrantyType === 'Error de Transcripcion' || warrantyType === 'Error de RX') {
      return false;
    }

    // Por defecto, bloqueado (por si acaso)
    return true;
  };

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
      setAlert({ type: 'success', message: 'OTG encontrada. Selecciona un tipo de garantía para editar los campos.' });
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

        {/* ============================================================
            BUSCAR OTG
            ============================================================ */}
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

            {/* ============================================================
                DATOS DEL CLIENTE (siempre editable)
                ============================================================ */}
            <Card>
              <h2 className="text-xl font-semibold text-opticolor-gray-800 mb-4">
                Datos del Cliente
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Nombre del Cliente"
                  value={orderData.cliente_nombre || ''}
                  onChange={(e) => handleFieldChange('cliente_nombre', e.target.value)}
                  disabled// solo se bloquea mientras se guarda
                />
                <Input
                  label="Código Completo"
                  value={orderData.codigo_completo || ''}
                  disabled // siempre de solo lectura
                />
              </div>
            </Card>

            {/* ============================================================
                DATOS DE LA GARANTÍA (MOVIDO AQUÍ)
                ============================================================ */}
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
                    onChange={(e) => {
                      setWarrantyType(e.target.value);
                      if (errors.warrantyType) setErrors(prev => ({ ...prev, warrantyType: null }));
                    }}
                    disabled={saving}
                    className={`w-full px-4 py-2 border-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-opticolor-red focus:border-transparent ${
                      errors.warrantyType
                        ? 'border-opticolor-red-light bg-red-50'
                        : 'border-opticolor-gray-200 hover:border-opticolor-gray-300'
                    }`}
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
                    className="w-full px-4 py-2 border-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-opticolor-red focus:border-transparent border-opticolor-gray-200 hover:border-opticolor-gray-300 disabled:bg-opticolor-gray-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-opticolor-gray-400 mt-1 text-right">
                    {storeObservations.length}/300
                  </p>
                </div>
              </div>
            </Card>

            {/* ============================================================
                OJO DERECHO (OD)
                ============================================================ */}
            <Card>
              <h2 className="text-xl font-semibold text-opticolor-gray-800 mb-4">
                Ojo Derecho (OD)
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Input
                  label="Esfera"
                  type="number"
                  step="0.01"
                  value={orderData.od_esfera ?? ''}
                  onChange={(e) => handleFieldChange('od_esfera', e.target.value)}
                  error={errors.od_esfera}
                  disabled={isFieldDisabled('od_esfera') || saving}
                />
                <Input
                  label="Cilindro"
                  type="number"
                  step="0.01"
                  value={orderData.od_cilindro ?? ''}
                  onChange={(e) => handleFieldChange('od_cilindro', e.target.value)}
                  error={errors.od_cilindro}
                  disabled={isFieldDisabled('od_cilindro') || saving}
                />
                <Input
                  label="Eje"
                  type="number"
                  min="0"
                  max="180"
                  value={orderData.od_eje ?? ''}
                  onChange={(e) => handleFieldChange('od_eje', e.target.value)}
                  error={errors.od_eje}
                  disabled={isFieldDisabled('od_eje') || saving}
                />
                <Input
                  label="Adición"
                  type="number"
                  step="0.01"
                  value={orderData.od_adicion ?? ''}
                  onChange={(e) => handleFieldChange('od_adicion', e.target.value)}
                  error={errors.od_adicion}
                  disabled={isFieldDisabled('od_adicion') || saving}
                />
                <Input
                  label="DP Centro"
                  type="number"
                  step="0.1"
                  value={orderData.od_dp_centro ?? ''}
                  onChange={(e) => handleFieldChange('od_dp_centro', e.target.value)}
                  error={errors.od_dp_centro}
                  disabled={isFieldDisabled('od_dp_centro') || saving}
                />
                <Input
                  label="DP Cerca"
                  type="number"
                  step="0.1"
                  value={orderData.od_dp_cerca ?? ''}
                  onChange={(e) => handleFieldChange('od_dp_cerca', e.target.value)}
                  error={errors.od_dp_cerca}
                  disabled={isFieldDisabled('od_dp_cerca') || saving}
                />
                <Input
                  label="Altura"
                  type="number"
                  step="0.1"
                  value={orderData.altura_od ?? ''}
                  onChange={(e) => handleFieldChange('altura_od', e.target.value)}
                  error={errors.altura_od}
                  disabled={isFieldDisabled('altura_od') || saving}
                />
              </div>
            </Card>

            {/* ============================================================
                OJO IZQUIERDO (OI)
                ============================================================ */}
            <Card>
              <h2 className="text-xl font-semibold text-opticolor-gray-800 mb-4">
                Ojo Izquierdo (OI)
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Input
                  label="Esfera"
                  type="number"
                  step="0.01"
                  value={orderData.oi_esfera ?? ''}
                  onChange={(e) => handleFieldChange('oi_esfera', e.target.value)}
                  error={errors.oi_esfera}
                  disabled={isFieldDisabled('oi_esfera') || saving}
                />
                <Input
                  label="Cilindro"
                  type="number"
                  step="0.01"
                  value={orderData.oi_cilindro ?? ''}
                  onChange={(e) => handleFieldChange('oi_cilindro', e.target.value)}
                  error={errors.oi_cilindro}
                  disabled={isFieldDisabled('oi_cilindro') || saving}
                />
                <Input
                  label="Eje"
                  type="number"
                  min="0"
                  max="180"
                  value={orderData.oi_eje ?? ''}
                  onChange={(e) => handleFieldChange('oi_eje', e.target.value)}
                  error={errors.oi_eje}
                  disabled={isFieldDisabled('oi_eje') || saving}
                />
                <Input
                  label="Adición"
                  type="number"
                  step="0.01"
                  value={orderData.oi_adicion ?? ''}
                  onChange={(e) => handleFieldChange('oi_adicion', e.target.value)}
                  error={errors.oi_adicion}
                  disabled={isFieldDisabled('oi_adicion') || saving}
                />
                <Input
                  label="DP Centro"
                  type="number"
                  step="0.1"
                  value={orderData.oi_dp_centro ?? ''}
                  onChange={(e) => handleFieldChange('oi_dp_centro', e.target.value)}
                  error={errors.oi_dp_centro}
                  disabled={isFieldDisabled('oi_dp_centro') || saving}
                />
                <Input
                  label="DP Cerca"
                  type="number"
                  step="0.1"
                  value={orderData.oi_dp_cerca ?? ''}
                  onChange={(e) => handleFieldChange('oi_dp_cerca', e.target.value)}
                  error={errors.oi_dp_cerca}
                  disabled={isFieldDisabled('oi_dp_cerca') || saving}
                />
                <Input
                  label="Altura"
                  type="number"
                  step="0.1"
                  value={orderData.altura_oi ?? ''}
                  onChange={(e) => handleFieldChange('altura_oi', e.target.value)}
                  error={errors.altura_oi}
                  disabled={isFieldDisabled('altura_oi') || saving}
                />
              </div>
            </Card>

            {/* ============================================================
                MEDIDAS DE MONTURA
                ============================================================ */}
            <Card>
              <h2 className="text-xl font-semibold text-opticolor-gray-800 mb-4">
                Medidas de Montura
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Input
                  label="Horizontal"
                  type="number"
                  step="0.1"
                  value={orderData.montura_horizontal ?? ''}
                  onChange={(e) => handleFieldChange('montura_horizontal', e.target.value)}
                  disabled={isFieldDisabled('montura_horizontal') || saving}
                />
                <Input
                  label="Vertical"
                  type="number"
                  step="0.1"
                  value={orderData.montura_vertical ?? ''}
                  onChange={(e) => handleFieldChange('montura_vertical', e.target.value)}
                  disabled={isFieldDisabled('montura_vertical') || saving}
                />
                <Input
                  label="Puente"
                  type="number"
                  step="0.1"
                  value={orderData.montura_puente ?? ''}
                  onChange={(e) => handleFieldChange('montura_puente', e.target.value)}
                  disabled={isFieldDisabled('montura_puente') || saving}
                />
                <Input
                  label="Diámetro Máximo"
                  type="number"
                  step="0.1"
                  value={orderData.montura_diametro_max ?? ''}
                  onChange={(e) => handleFieldChange('montura_diametro_max', e.target.value)}
                  disabled={isFieldDisabled('montura_diametro_max') || saving}
                />
              </div>
            </Card>

            {/* ============================================================
                BOTÓN GUARDAR
                ============================================================ */}
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