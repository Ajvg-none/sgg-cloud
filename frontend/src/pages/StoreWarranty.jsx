// frontend/src/pages/StoreWarranty.jsx
import React, { useState, useEffect } from 'react';
import { storeAPI, authAPI } from '../services/api';
import { validateOpticalFields } from '../utils/validators';
import useWarrantyFormStore from '../store/warrantyFormStore';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Alert from '../components/ui/Alert';
import Select from '../components/ui/Select';
import StoreHeader from '../components/layout/StoreHeader';
import { Search, Save } from 'lucide-react';

const WARRANTY_TYPES = [
'Error de Medida',
'Error de Transcripcion',
'Error de RX'
];

// ============================================================
// ✅ NUEVO: GENERADOR DE CÓDIGO DE BARRAS CODE39 (SVG inline)
// Misma simbología CODE39 que usa el ticket de la impresora.
// Sin dependencias externas: funciona offline.
// ============================================================
const CODE39_PATTERNS = {
  '0': '101001101101', '1': '110100101011', '2': '101100101011', '3': '110110010101',
  '4': '101001101011', '5': '110100110101', '6': '101100110101', '7': '101001011011',
  '8': '110100101101', '9': '101100101101', 'A': '110101001011', 'B': '101101001011',
  'C': '110110100101', 'D': '101011001011', 'E': '110101100101', 'F': '101101100101',
  'G': '101010011011', 'H': '110101001101', 'I': '101101001101', 'J': '101011001101',
  'K': '110101010011', 'L': '101101010011', 'M': '110110101001', 'N': '101011010011',
  'O': '110101101001', 'P': '101101101001', 'Q': '101010110011', 'R': '110101011001',
  'S': '101101011001', 'T': '101011011001', 'U': '110010101011', 'V': '100110101011',
  'W': '110011010101', 'X': '100101101011', 'Y': '110010110101', 'Z': '100110110101',
  '-': '100101011011', '.': '110010101101', ' ': '100110101101', '*': '100101101101',
  '$': '100100100101', '/': '100100101001', '+': '100101001001', '%': '101001001001',
};

const generateCode39Svg = (value, { moduleWidth = 2, height = 60 } = {}) => {
  const text = `*${String(value).toUpperCase()}*`; // * = inicio/fin CODE39
  let x = 0;
  let rects = '';
  for (const char of text) {
    const pattern = CODE39_PATTERNS[char];
    if (!pattern) continue; // ignora caracteres no soportados por CODE39
    for (const bit of pattern) {
      if (bit === '1') {
        rects += `<rect x="${x}" y="0" width="${moduleWidth}" height="${height}"></rect>`;
      }
      x += moduleWidth;
    }
    x += moduleWidth; // separación entre caracteres (espacio estrecho)
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${height}" ` +
    `viewBox="0 0 ${x} ${height}">${rects}</svg>`
  );
};

const StoreWarranty = () => {
// ✅ Estado GLOBAL: sobrevive a la navegación entre pestañas
const {
orderNumber,
orderData,
warrantyType,
storeObservations,
loading,
saving,
alert,
errors,
setOrderNumber,
setWarrantyType,
setStoreObservations,
setAlert,
setErrors,
handleFieldChange,
searchOrder,
setSaving,
resetForm,
} = useWarrantyFormStore();
const [storeInfo, setStoreInfo] = useState({ name: '', accn: '' });
// Cargar datos de la tienda (para el encabezado de la Orden de Garantía)
useEffect(() => {
const loadStoreInfo = async () => {
try {
const res = await authAPI.me();
const s = res.data?.user?.store;
if (s) setStoreInfo({ name: s.name || '', accn: s.accn || '' });
} catch {
// Silencioso: se usará 'Tienda' como respaldo en el PDF
}
};
loadStoreInfo();
}, []);
// ============================================================
// FUNCIÓN PARA GENERAR E IMPRIMIR LA ORDEN DE GARANTÍA (PDF)
// ✅ OPTIMIZADA: 1 página A4 + muestra el correlativo de revisión
// ✅ Incluye Asesor / Responsable
// ✅ NUEVO: Código de barras CODE39 del número de orden (igual al ticket)
// ✅ NUEVO: Logo de Opti-Color en el encabezado (igual que en los paneles)
// ============================================================
const generateAndPrintWarrantyOrder = (data, type, observations, storeName, accn) => {
const printWindow = window.open('', '_blank');
if (!printWindow) {
setAlert({ type: 'warning', message: 'Por favor, permite las ventanas emergentes para imprimir la orden.' });
return;
}
const today = new Date().toLocaleDateString('es-ES', {
year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
});
const revision = data.revision ?? 1;

// ✅ NUEVO: código de barras del número de orden (CODE39, mismo valor que el ticket)
const barcodeValue = data.codigo_completo || data.orden_numero || '';
const barcodeSvg = barcodeValue ? generateCode39Svg(barcodeValue) : '';

const itemsHtml = (data.items || []).map(item => `
<tr>
<td style="border: 1px solid #ddd; padding: 4px 8px;">${item.descripcion || '-'}</td>
<td style="border: 1px solid #ddd; padding: 4px 8px; text-align: center;">${item.cantidad || 1}</td>
<td style="border: 1px solid #ddd; padding: 4px 8px; font-family: monospace;">${item.codigo_completo || '-'}</td>
</tr>
`).join('');

const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Orden de Garantía - ${data.codigo_completo || data.orden_numero} (Rev. ${revision})</title>
<style>
  @page { margin: 0.7cm; size: A4; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #333; line-height: 1.25; margin: 0; padding: 8px; font-size: 12px;
  }
  .header {
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 2px solid #DC2626; padding-bottom: 6px; margin-bottom: 10px;
    page-break-inside: avoid;
  }
  /* ✅ NUEVO: logo de Opti-Color en el encabezado del PDF */
  .header .logo { height: 100px; width: auto; object-fit: contain; display: block; }
  .header .slogan { margin: 3px 0 0; font-size: 10px; color: #666; }
  .title-box { text-align: right; }
  .title-box h1 { margin: 0; color: #DC2626; font-size: 20px; text-transform: uppercase; }
  .title-box p { margin: 2px 0 0; font-weight: bold; font-size: 13px; }
  .info-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px;
    margin-bottom: 10px; background: #f9f9f9; padding: 10px; border-radius: 6px;
    page-break-inside: avoid;
  }
  .info-item label { display: block; font-size: 10px; color: #666; text-transform: uppercase; }
  .info-item span { font-size: 13px; font-weight: bold; }
  /* ✅ NUEVO: contenedor del código de barras */
  .barcode-box { text-align: center; margin: 0 0 10px; page-break-inside: avoid; }
  .barcode-box svg { height: 54px; fill: #000; }
  .barcode-box .barcode-text {
    font-family: monospace; font-size: 12px; font-weight: bold;
    letter-spacing: 3px; margin: 2px 0 0;
  }
  h3.section-title {
    margin: 8px 0 4px; font-size: 13px;
    border-bottom: 2px solid #333; padding-bottom: 3px;
    page-break-after: avoid;
  }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; page-break-inside: avoid; }
  th { background-color: #DC2626; color: white; padding: 5px 8px; text-align: left; font-size: 11px; }
  td { padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
  .optical-table th { background-color: #333; text-align: center; }
  .optical-table td { text-align: center; font-family: monospace; font-size: 12px; font-weight: bold; }
  .frame-measures { display: flex; gap: 20px; margin-bottom: 8px; font-size: 12px; }
  .warranty-section {
    border: 2px solid #DC2626; padding: 10px; border-radius: 6px;
    margin-top: 8px; background: #fff5f5;
    page-break-inside: avoid;
  }
  .warranty-section h3 {
    margin: 0 0 6px; color: #DC2626; font-size: 13px;
    border-bottom: 1px solid #DC2626; padding-bottom: 4px;
  }
  .warranty-section label { font-weight: bold; display: block; margin-bottom: 3px; font-size: 12px; }
  .obs-box {
    background: white; padding: 8px; border: 1px solid #ddd;
    min-height: 32px; margin: 0 0 6px; font-size: 12px;
  }
  .footer {
    margin-top: 10px; text-align: center; font-size: 10px; color: #888;
    border-top: 1px solid #eee; padding-top: 6px;
    page-break-inside: avoid;
  }
  .footer p { margin: 2px 0; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <img src="/logo-opti.jpg" alt="Opti-Color" class="logo" />
    <p class="slogan">Calidad a su vista</p>
  </div>
  <div class="title-box">
    <h1>OTG ORDEN</h1>
    <p>ORDEN DE GARANTÍA</p>
  </div>
</div>
<div class="info-grid">
  <div class="info-item">
    <label>Tienda / Sucursal</label>
    <span>${storeName || 'Tienda'} (${accn || '---'})</span>
  </div>
  <div class="info-item">
    <label>Fecha de Emisión</label>
    <span>${today}</span>
  </div>
  <div class="info-item">
    <label>Número de Orden (OTG)</label>
    <span style="font-family: monospace; font-size: 14px;">${data.codigo_completo || data.orden_numero}</span>
  </div>
  <div class="info-item">
    <label>Revisión de Garantía</label>
    <span style="color: #DC2626;">Rev. ${revision}</span>
  </div>
  <div class="info-item">
    <label>Cliente</label>
    <span>${data.cliente_nombre || 'Paciente'}</span>
  </div>
  <div class="info-item">
    <label>Asesor / Responsable</label>
    <span>${data.asesor_nombre || '-'}</span>
  </div>
</div>
${barcodeSvg ? `
<div class="barcode-box">
  ${barcodeSvg}
  <p class="barcode-text">${barcodeValue}</p>
</div>` : ''}
<h3 class="section-title">Datos Ópticos</h3>
<table class="optical-table">
  <thead>
    <tr>
      <th>Ojo</th>
      <th>Esfera</th>
      <th>Cilindro</th>
      <th>Eje</th>
      <th>Adición</th>
      <th>DP</th>
      <th>Altura</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="font-weight:bold; background:#f0f0f0;">OD</td>
      <td>${data.od_esfera ?? '-'}</td>
      <td>${data.od_cilindro ?? '-'}</td>
      <td>${data.od_eje ?? '-'}</td>
      <td>${data.od_adicion ?? '-'}</td>
      <td>${data.od_dp_centro ?? data.od_dp_cerca ?? '-'}</td>
      <td>${data.altura_od ?? '-'}</td>
    </tr>
    <tr>
      <td style="font-weight:bold; background:#f0f0f0;">OI</td>
      <td>${data.oi_esfera ?? '-'}</td>
      <td>${data.oi_cilindro ?? '-'}</td>
      <td>${data.oi_eje ?? '-'}</td>
      <td>${data.oi_adicion ?? '-'}</td>
      <td>${data.oi_dp_centro ?? data.oi_dp_cerca ?? '-'}</td>
      <td>${data.altura_oi ?? '-'}</td>
    </tr>
  </tbody>
</table>
<h3 class="section-title">Medidas de Montura</h3>
<div class="frame-measures">
  <div><strong>Horizontal:</strong> ${data.montura_horizontal ?? '-'}</div>
  <div><strong>Vertical:</strong> ${data.montura_vertical ?? '-'}</div>
  <div><strong>Puente:</strong> ${data.montura_puente ?? '-'}</div>
  <div><strong>Diámetro Máx:</strong> ${data.montura_diametro_max ?? '-'}</div>
</div>
<h3 class="section-title">Ítems / Materiales</h3>
<table>
  <thead>
    <tr>
      <th style="width: 60%;">Descripción</th>
      <th style="width: 10%;">Cant.</th>
      <th style="width: 30%;">Código</th>
    </tr>
  </thead>
  <tbody>
    ${itemsHtml || '<tr><td colspan="3" style="text-align:center; padding:6px;">Sin ítems registrados</td></tr>'}
  </tbody>
</table>
<div class="warranty-section">
  <h3>DATOS DE LA GARANTÍA</h3>
  <label>Tipo de Garantía:</label>
  <p class="obs-box" style="min-height: auto; margin-bottom: 6px; text-transform: uppercase;">${type}</p>
  <label>Observaciones:</label>
  <p class="obs-box">${observations || 'Sin observaciones adicionales.'}</p>
</div>
<div class="footer">
  <p>Documento generado automáticamente por el Sistema de Gestión de Garantías Opti-Color.</p>
  <p>Fecha de impresión: ${new Date().toLocaleString()}</p>
</div>
<script>
  window.onload = function() {
    window.focus();
    window.print();
  }
</script>
</body>
</html>
`;
printWindow.document.write(htmlContent);
printWindow.document.close();
};
// ============================================================
// CONTROL DE CAMPOS BLOQUEADOS SEGÚN TIPO DE GARANTÍA
// ============================================================
const isFieldDisabled = (fieldName) => {
if (!warrantyType) return true;
if (warrantyType === 'Error de Medida') {
const allowedFields = [
'od_dp_centro', 'od_dp_cerca', 'oi_dp_centro', 'oi_dp_cerca',
'altura_od', 'altura_oi',
'montura_horizontal', 'montura_vertical', 'montura_puente', 'montura_diametro_max'
];
return !allowedFields.includes(fieldName);
}
if (warrantyType === 'Error de Transcripcion' || warrantyType === 'Error de RX') return false;
return true;
};
const handleSearch = () => {
searchOrder();
};
const handleSave = async () => {
const validationErrors = validateOpticalFields(orderData);
if (!warrantyType) validationErrors.warrantyType = 'Selecciona un tipo de garantía';
if (Object.keys(validationErrors).length > 0) {
setErrors(validationErrors);
setAlert({ type: 'error', message: 'Por favor corrige los errores antes de guardar' });
return;
}
setSaving(true);
setAlert(null);
try {
const response = await storeAPI.createWarranty({
orderNumber: orderData.orden_numero,
orderData: orderData,
warrantyType,
storeObservations: storeObservations.trim() || null,
});
const created = response.data.warranty;
const printData = {
...orderData,
orden_numero: created.orderNumber,
codigo_completo: created.orderNumber,
revision: created.revision,
};
generateAndPrintWarrantyOrder(
printData,
warrantyType,
storeObservations,
storeInfo.name,
storeInfo.accn
);
setAlert({ type: 'success', message: `Garantía guardada y orden generada (Rev. ${created.revision}).` });
setTimeout(() => {
resetForm();
}, 2500);
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
<div className="min-h-screen bg-opticolor-gray-50 p-4 sm:p-6">
<div className="max-w-6xl mx-auto">
<StoreHeader />
<div className="mb-8">
<h1 className="text-3xl font-bold text-opticolor-gray-900 mb-2">Nueva Garantía</h1>
<p className="text-opticolor-gray-600">Busca una OTG de GesVision y completa los datos de la garantía</p>
</div>
{alert && (
<div className="mb-6">
<Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
</div>
)}
{/* ============================================================
BUSCAR OTG
============================================================ */}
<Card
className="mb-6"
title="Buscar OTG"
subtitle="Ingresa el número de orden de GesVision para cargar los datos"
>
<div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
<div className="flex-1">
<Input
label="Número de OTG"
placeholder="Ej: 12345"
value={orderNumber}
onChange={(e) => setOrderNumber(e.target.value)}
disabled={loading || saving}
className="py-2.5"
/>
</div>
<div className="flex items-end">
<Button
onClick={handleSearch}
loading={loading}
disabled={saving}
className="w-full sm:w-auto"
>
<Search className="h-4 w-4" aria-hidden="true" />
Buscar
</Button>
</div>
</div>
</Card>
{orderData && (
<div className="space-y-6 animate-fade-in">
{/* ============================================================
DATOS DEL CLIENTE (SOLO LECTURA)
✅ Incluye Asesor / Responsable
============================================================ */}
<Card title="Datos del Cliente">
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
<Input
label="Nombre del Cliente"
value={orderData.cliente_nombre || ''}
readOnly
/>
<Input
label="Código Completo"
value={orderData.codigo_completo || ''}
readOnly
/>
<Input
label="Asesor / Responsable"
value={orderData.asesor_nombre || ''}
placeholder="Sin datos del asesor"
readOnly
/>
</div>
</Card>
{/* ============================================================
DATOS DE LA GARANTÍA
============================================================ */}
<Card title="Datos de la Garantía">
<div className="space-y-4">
<Select
label="Tipo de Garantía *"
value={warrantyType}
onChange={(e) => setWarrantyType(e.target.value)}
disabled={saving}
error={errors.warrantyType}
placeholder="Seleccionar tipo..."
options={WARRANTY_TYPES.map((type) => ({ value: type, label: type }))}
/>
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
className="w-full px-4 py-2.5 border-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-opticolor-red focus:border-transparent border-opticolor-gray-200 hover:border-opticolor-gray-300 disabled:bg-opticolor-gray-50 disabled:cursor-not-allowed resize-none"
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
<Card title="Ojo Derecho (OD)">
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
<Card title="Ojo Izquierdo (OI)">
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
<Card title="Medidas de Montura">
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
<div className="flex justify-end pt-2">
<Button
onClick={handleSave}
loading={saving}
disabled={!orderData}
className="min-w-[200px] sm:min-w-[220px]"
>
<Save className="h-4 w-4" aria-hidden="true" />
Guardar y Generar Orden
</Button>
</div>
</div>
)}
</div>
</div>
);
};
export default StoreWarranty;