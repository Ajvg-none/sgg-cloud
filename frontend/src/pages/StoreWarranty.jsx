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
// ✅ NUEVO: servicio QZ Tray para la auto-impresión del ticket desde tienda
import { connectQZ, printRawData, writeVCAFile } from '../services/qzprintService';

const WARRANTY_TYPES = [
  'Error de Medida',
  'Error de Transcripcion',
  'Error de RX'
];

// ============================================================
// ✅ GENERADOR DE CÓDIGO DE BARRAS CODE39 (SVG inline)
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
  // FUNCIÓN PARA GENERAR E IMPRIMIR LA ORDEN DE GARANTÍA (PDF A4)
  // ✅ 1 página A4 + correlativo de revisión + Asesor/Responsable
  // ✅ Código de barras CODE39 + Logo Opti-Color
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

    // ✅ código de barras del número de orden (CODE39, mismo valor que el ticket)
    const barcodeValue = data.codigo_completo || data.orden_numero || '';
    const barcodeSvg = barcodeValue ? generateCode39Svg(barcodeValue) : '';

    const itemsHtml = (data.items || []).map(item => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 2px 4px;">${item.descripcion || '-'}</td>
        <td style="border: 1px solid #ddd; padding: 2px 4px; text-align: center;">${item.cantidad || 1}</td>
        <td style="border: 1px solid #ddd; padding: 2px 4px; font-family: monospace;">${item.codigo_completo || '-'}</td>
      </tr>
    `).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Orden de Garantía - ${data.codigo_completo || data.orden_numero} (Rev. ${revision})</title>
<style>
  @page { size: A4; margin: 0.5cm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #333; line-height: 1.3; margin: 0; padding: 0; font-size: 10px;
  }
  .sheet { max-height: 14cm; }
  .header {
    display: flex; justify-content: space-between; align-items: center; gap: 10px;
    border-bottom: 2px solid #DC2626; padding-bottom: 4px; margin-bottom: 6px;
    page-break-inside: avoid;
  }
  .header .left { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .header .logo { height: 40px; width: auto; object-fit: contain; display: block; }
  .title-box h1 { margin: 0; color: #DC2626; font-size: 16px; text-transform: uppercase; }
  .title-box p { margin: 0; font-weight: bold; font-size: 10px; }
  .barcode-box { text-align: right; min-width: 0; }
  .barcode-box svg { height: 40px; fill: #000; display: block; margin-left: auto; }
  .barcode-box .barcode-text {
    font-family: monospace; font-size: 10px; font-weight: bold;
    letter-spacing: 2px; margin: 2px 0 0;
  }
  .info-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 12px;
    margin-bottom: 6px; background: #f9f9f9; padding: 6px 8px; border-radius: 4px;
    page-break-inside: avoid;
  }
  .info-item label { display: block; font-size: 8px; color: #666; text-transform: uppercase; }
  .info-item span { font-size: 10px; font-weight: bold; }
  h3.section-title {
    margin: 5px 0 3px; font-size: 11px;
    border-bottom: 2px solid #333; padding-bottom: 2px;
    page-break-after: avoid;
  }
  table { width: 100%; border-collapse: collapse; margin-bottom: 5px; page-break-inside: avoid; }
  th { background-color: #DC2626; color: white; padding: 2px 4px; text-align: left; font-size: 10px; }
  td { padding: 2px 4px; border-bottom: 1px solid #eee; font-size: 10px; }
  .optical-table th { background-color: #333; text-align: center; }
  .optical-table td { text-align: center; font-family: monospace; font-size: 11px; font-weight: bold; }
  .frame-measures { display: flex; gap: 14px; margin-bottom: 5px; font-size: 10px; }
  .items-table thead, .items-table tbody tr { display: table; width: 100%; table-layout: fixed; }
  .items-table tbody { display: block; max-height: 2.8cm; overflow: hidden; }
  .warranty-section {
    border: 2px solid #DC2626; padding: 8px; border-radius: 4px;
    margin-top: 6px; background: #fff5f5;
    page-break-inside: avoid;
  }
  .warranty-section h3 {
    margin: 0 0 4px; color: #DC2626; font-size: 11px;
    border-bottom: 1px solid #DC2626; padding-bottom: 2px;
  }
  .warranty-section label { font-weight: bold; display: block; margin-bottom: 2px; font-size: 10px; }
  .obs-box {
    background: white; padding: 5px 8px; border: 1px solid #ddd;
    min-height: 20px; margin: 0 0 4px; font-size: 10px;
  }
  .footer {
    margin-top: 8px; text-align: center; font-size: 9px; color: #888;
    border-top: 1px solid #eee; padding-top: 4px;
    page-break-inside: avoid;
  }
  .footer p { margin: 1px 0; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="sheet">
  <div class="header">
    <div class="left">
      <img src="/logo-opti.jpg" alt="Opti-Color" class="logo" />
      <div class="title-box">
        <h1>OTG ORDEN</h1>
        <p>ORDEN DE GARANTÍA</p>
      </div>
    </div>
    ${barcodeSvg ? `
    <div class="barcode-box">
      ${barcodeSvg}
      <p class="barcode-text">${barcodeValue}</p>
    </div>` : ''}
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
      <span style="font-family: monospace;">${data.codigo_completo || data.orden_numero}</span>
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

  <h3 class="section-title">Datos Ópticos</h3>
  <table class="optical-table">
    <thead>
      <tr>
        <th>Ojo</th><th>Esfera</th><th>Cilindro</th><th>Eje</th><th>Adición</th><th>DP</th><th>Altura</th>
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
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 60%;">Descripción</th>
        <th style="width: 10%;">Cant.</th>
        <th style="width: 30%;">Código</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml || '<tr><td colspan="3" style="text-align:center;">Sin ítems registrados</td></tr>'}
    </tbody>
  </table>

  <div class="warranty-section">
    <h3>DATOS DE LA GARANTÍA</h3>
    <label>Tipo de Garantía:</label>
    <p class="obs-box" style="min-height: auto; text-transform: uppercase;">${type}</p>
    <label>Observaciones:</label>
    <p class="obs-box">${observations || 'Sin observaciones adicionales.'}</p>
  </div>

  <div class="footer">
    <p>Documento generado automáticamente por el Sistema de Gestión de Garantías Opti-Color.</p>
    <p>Fecha de impresión: ${new Date().toLocaleString()}</p>
  </div>
  </div>

<script>
  window.onload = function() {
    window.focus();
    window.print();
    // Fallback: si onafterprint no se dispara, cierra igual tras el diálogo
    setTimeout(function() { window.close(); }, 1500);
  };
  // Cerrar la pestaña automáticamente después de imprimir o cancelar
  window.onafterprint = function() {
    window.close();
  };
</script>
</body>
</html>
`;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // ============================================================
  // ✅ NUEVO: AUTO-IMPRESIÓN DEL TICKET AL GUARDAR
  // Intenta imprimir el ticket en la tickera (vía QZ Tray) y dejar
  // la garantía como COMPLETED. Si no hay conexión con QZ Tray o
  // falla la impresora, devuelve { ok:false } y la garantía queda
  // PENDING para que el laboratorio la procese manualmente.
  // ============================================================
  const tryAutoPrintTicket = async (warrantyId) => {
    // 1. Conectar con QZ Tray en ESTE equipo
    try {
      await connectQZ();
    } catch {
      return { ok: false, reason: 'QZ Tray no está activo en este equipo' };
    }

    try {
      // 2. Pedir al backend el ticket + VCA
      const res = await storeAPI.getTicketBuffer(warrantyId);
      const { ticketBase64, vcaContent, vcaPath, printerName } = res.data;

      // 3. Imprimir físicamente en la tickera
      await printRawData(printerName, ticketBase64);

      // 4. Escribir el archivo VCA (best-effort, no bloquea el flujo)
      if (vcaContent && vcaPath) {
        try {
          await writeVCAFile(vcaPath, vcaContent);
        } catch (vcaErr) {
          console.warn('No se pudo escribir el VCA:', vcaErr);
        }
      }

      // 5. Marcar COMPLETED para que el lab no tenga que procesarla
      await storeAPI.completeWarranty(warrantyId);

      return { ok: true };
    } catch (e) {
      console.error('[tryAutoPrintTicket]', e);
      return { ok: false, reason: e.response?.data?.error || e.message || 'error de impresión' };
    }
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

  // ============================================================
  // GUARDAR GARANTÍA + PDF A4 + ✅ AUTO-IMPRESIÓN DEL TICKET
  // ============================================================
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

      // 1) Orden de garantía en PDF A4 (como ya funcionaba)
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

      // 2) ✅ NUEVO: intentar imprimir el ticket y auto-procesar
      const auto = await tryAutoPrintTicket(created.id);

      if (auto.ok) {
        setAlert({
          type: 'success',
          message: `Garantía guardada (Rev. ${created.revision}). Ticket impreso y procesada correctamente.`,
        });
      } else {
        setAlert({
          type: 'warning',
          message:
            `Garantía guardada (Rev. ${created.revision}), pero no se pudo imprimir el ticket ` +
            `(${auto.reason}). El laboratorio la procesará manualmente.`,
        });
      }

      setTimeout(() => {
        resetForm();
      }, 4000);
    } catch (error) {
      setAlert({
        type: 'error',
        message:
          error.response?.data?.details?.join(', ') ||
          error.response?.data?.error ||
          'Error al guardar la garantía',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-opticolor-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto animate-slide-up">
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