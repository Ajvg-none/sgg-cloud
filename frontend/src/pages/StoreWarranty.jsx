import React, { useState } from 'react';
import { storeAPI } from '../services/api';
import { validateOpticalFields } from '../utils/validators';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Alert from '../components/ui/Alert';

const StoreWarranty = () => {
  const [orderNumber, setOrderNumber] = useState('');
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);

  const handleSearch = async () => {
    if (!orderNumber.trim()) {
      setAlert({ type: 'warning', message: 'Por favor ingresa un número de orden' });
      return;
    }

    setLoading(true);
    setAlert(null);
    setErrors({});

    try {
      const response = await storeAPI.getOrder(orderNumber);
      setOrderData(response.data.order);
      setAlert({ type: 'success', message: 'Orden encontrada. Puedes editar los campos y guardar.' });
    } catch (error) {
      setAlert({ 
        type: 'error', 
        message: error.response?.data?.details || 'Error al buscar la orden' 
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
    
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleSave = async () => {
    // Validar campos
    const validationErrors = validateOpticalFields(orderData);
    
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
        orderData: orderData
      });
      setAlert({ type: 'success', message: '¡Garantía guardada exitosamente!' });
      
      // Limpiar formulario después de 2 segundos
      setTimeout(() => {
        setOrderNumber('');
        setOrderData(null);
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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-opticolor-gray-900 mb-2">
            Nueva Garantía
          </h1>
          <p className="text-opticolor-gray-600">
            Busca una orden de GesVision y completa los datos de la garantía
          </p>
        </div>

        {/* Alert */}
        {alert && (
          <div className="mb-6">
            <Alert 
              type={alert.type} 
              message={alert.message}
              onClose={() => setAlert(null)}
            />
          </div>
        )}

        {/* Búsqueda de Orden */}
        <Card className="mb-6">
          <h2 className="text-xl font-semibold text-opticolor-gray-800 mb-4">
            Buscar Orden
          </h2>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                label="Número de Orden"
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

        {/* Formulario de Garantía */}
        {orderData && (
          <div className="space-y-6 animate-fade-in">
            {/* Datos del Cliente */}
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

            {/* Ojo Derecho (OD) */}
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
                  disabled={saving}
                />
                <Input
                  label="Cilindro"
                  type="number"
                  step="0.01"
                  value={orderData.od_cilindro ?? ''}
                  onChange={(e) => handleFieldChange('od_cilindro', e.target.value)}
                  error={errors.od_cilindro}
                  disabled={saving}
                />
                <Input
                  label="Eje"
                  type="number"
                  min="0"
                  max="180"
                  value={orderData.od_eje ?? ''}
                  onChange={(e) => handleFieldChange('od_eje', e.target.value)}
                  error={errors.od_eje}
                  disabled={saving}
                />
                <Input
                  label="Adición"
                  type="number"
                  step="0.01"
                  value={orderData.od_adicion ?? ''}
                  onChange={(e) => handleFieldChange('od_adicion', e.target.value)}
                  error={errors.od_adicion}
                  disabled={saving}
                />
                <Input
                  label="DP Centro"
                  type="number"
                  step="0.1"
                  value={orderData.od_dp_centro ?? ''}
                  onChange={(e) => handleFieldChange('od_dp_centro', e.target.value)}
                  error={errors.od_dp_centro}
                  disabled={saving}
                />
                <Input
                  label="DP Cerca"
                  type="number"
                  step="0.1"
                  value={orderData.od_dp_cerca ?? ''}
                  onChange={(e) => handleFieldChange('od_dp_cerca', e.target.value)}
                  error={errors.od_dp_cerca}
                  disabled={saving}
                />
                <Input
                  label="Altura"
                  type="number"
                  step="0.1"
                  value={orderData.altura_od ?? ''}
                  onChange={(e) => handleFieldChange('altura_od', e.target.value)}
                  error={errors.altura_od}
                  disabled={saving}
                />
              </div>
            </Card>

            {/* Ojo Izquierdo (OI) */}
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
                  disabled={saving}
                />
                <Input
                  label="Cilindro"
                  type="number"
                  step="0.01"
                  value={orderData.oi_cilindro ?? ''}
                  onChange={(e) => handleFieldChange('oi_cilindro', e.target.value)}
                  error={errors.oi_cilindro}
                  disabled={saving}
                />
                <Input
                  label="Eje"
                  type="number"
                  min="0"
                  max="180"
                  value={orderData.oi_eje ?? ''}
                  onChange={(e) => handleFieldChange('oi_eje', e.target.value)}
                  error={errors.oi_eje}
                  disabled={saving}
                />
                <Input
                  label="Adición"
                  type="number"
                  step="0.01"
                  value={orderData.oi_adicion ?? ''}
                  onChange={(e) => handleFieldChange('oi_adicion', e.target.value)}
                  error={errors.oi_adicion}
                  disabled={saving}
                />
                <Input
                  label="DP Centro"
                  type="number"
                  step="0.1"
                  value={orderData.oi_dp_centro ?? ''}
                  onChange={(e) => handleFieldChange('oi_dp_centro', e.target.value)}
                  error={errors.oi_dp_centro}
                  disabled={saving}
                />
                <Input
                  label="DP Cerca"
                  type="number"
                  step="0.1"
                  value={orderData.oi_dp_cerca ?? ''}
                  onChange={(e) => handleFieldChange('oi_dp_cerca', e.target.value)}
                  error={errors.oi_dp_cerca}
                  disabled={saving}
                />
                <Input
                  label="Altura"
                  type="number"
                  step="0.1"
                  value={orderData.altura_oi ?? ''}
                  onChange={(e) => handleFieldChange('altura_oi', e.target.value)}
                  error={errors.altura_oi}
                  disabled={saving}
                />
              </div>
            </Card>

            {/* Medidas de Montura */}
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
                  disabled={saving}
                />
                <Input
                  label="Vertical"
                  type="number"
                  step="0.1"
                  value={orderData.montura_vertical ?? ''}
                  onChange={(e) => handleFieldChange('montura_vertical', e.target.value)}
                  disabled={saving}
                />
                <Input
                  label="Puente"
                  type="number"
                  step="0.1"
                  value={orderData.montura_puente ?? ''}
                  onChange={(e) => handleFieldChange('montura_puente', e.target.value)}
                  disabled={saving}
                />
                <Input
                  label="Diámetro Máximo"
                  type="number"
                  step="0.1"
                  value={orderData.montura_diametro_max ?? ''}
                  onChange={(e) => handleFieldChange('montura_diametro_max', e.target.value)}
                  disabled={saving}
                />
              </div>
            </Card>

            {/* Botón Guardar */}
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