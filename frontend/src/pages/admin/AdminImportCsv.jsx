import React, { useState, useRef } from 'react';
import { adminAPI } from '../../services/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';

const AdminImportCsv = () => {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [alert, setAlert] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (!selected.name.endsWith('.csv')) {
        setAlert({ type: 'warning', message: 'Solo se permiten archivos CSV' });
        setFile(null);
        return;
      }
      setFile(selected);
      setAlert(null);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setAlert({ type: 'warning', message: 'Selecciona un archivo CSV primero' });
      return;
    }
    setImporting(true);
    setAlert(null);
    setResult(null);
    try {
      const res = await adminAPI.importCsv(file);
      setResult(res.data);
      setAlert({ type: 'success', message: 'Importación completada' });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error al importar el archivo' });
    } finally {
      setImporting(false);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setResult(null);
    setAlert(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-opticolor-gray-900 mb-2">Importar Garantías desde CSV</h1>
        <p className="text-opticolor-gray-600">Migra garantías históricas desde un archivo CSV</p>
      </div>

      {alert && (
        <div className="mb-6">
          <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
        </div>
      )}

      {/* Instrucciones */}
      <Card className="mb-6">
        <h3 className="text-lg font-semibold text-opticolor-gray-800 mb-3">Formato del Archivo CSV</h3>
        <p className="text-sm text-opticolor-gray-600 mb-4">El archivo debe contener las siguientes columnas con encabezados exactos:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-opticolor-gray-200">
                <th className="text-left py-2 px-3 font-semibold text-opticolor-gray-700">Columna</th>
                <th className="text-left py-2 px-3 font-semibold text-opticolor-gray-700">Descripción</th>
                <th className="text-left py-2 px-3 font-semibold text-opticolor-gray-700">Requerido</th>
                <th className="text-left py-2 px-3 font-semibold text-opticolor-gray-700">Ejemplo</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-opticolor-gray-100">
                <td className="py-2 px-3 font-mono text-opticolor-gray-800">orden_numero</td>
                <td className="py-2 px-3 text-opticolor-gray-600">Número de orden en GesVision</td>
                <td className="py-2 px-3"><span className="text-green-600 font-semibold">SI</span></td>
                <td className="py-2 px-3 font-mono text-opticolor-gray-500">OV-001234</td>
              </tr>
              <tr className="border-b border-opticolor-gray-100">
                <td className="py-2 px-3 font-mono text-opticolor-gray-800">tienda_nombre</td>
                <td className="py-2 px-3 text-opticolor-gray-600">Nombre o ACCN de la tienda</td>
                <td className="py-2 px-3"><span className="text-green-600 font-semibold">SI</span></td>
                <td className="py-2 px-3 font-mono text-opticolor-gray-500">Óptica Centro</td>
              </tr>
              <tr className="border-b border-opticolor-gray-100">
                <td className="py-2 px-3 font-mono text-opticolor-gray-800">datos_corregidos</td>
                <td className="py-2 px-3 text-opticolor-gray-600">Datos de la garantía en formato JSON</td>
                <td className="py-2 px-3"><span className="text-gray-400">No</span></td>
                <td className="py-2 px-3 font-mono text-opticolor-gray-500">{'{"od_esfera":-1.25,...}'}</td>
              </tr>
              <tr className="border-b border-opticolor-gray-100">
                <td className="py-2 px-3 font-mono text-opticolor-gray-800">observaciones</td>
                <td className="py-2 px-3 text-opticolor-gray-600">Notas adicionales</td>
                <td className="py-2 px-3"><span className="text-gray-400">No</span></td>
                <td className="py-2 px-3 font-mono text-opticolor-gray-500">Garantía por error de montura</td>
              </tr>
              <tr className="border-b border-opticolor-gray-100">
                <td className="py-2 px-3 font-mono text-opticolor-gray-800">fecha_creacion</td>
                <td className="py-2 px-3 text-opticolor-gray-600">Fecha de creación (ISO 8601)</td>
                <td className="py-2 px-3"><span className="text-gray-400">No</span></td>
                <td className="py-2 px-3 font-mono text-opticolor-gray-500">2025-06-15T10:30:00Z</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-opticolor-gray-400 mt-4">Las garantías importadas se guardan con estado COMPLETED para que no sean procesadas por el agente.</p>
      </Card>

      {/* Upload */}
      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-opticolor-gray-700 mb-2">Seleccionar Archivo CSV</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-opticolor-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-opticolor-red file:text-white hover:file:bg-opticolor-red-dark file:cursor-pointer"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={handleImport} loading={importing} disabled={!file}>
              {importing ? 'Importando...' : 'Importar'}
            </Button>
            {file && (
              <Button variant="secondary" onClick={handleClearFile}>Cancelar</Button>
            )}
          </div>
        </div>
        {file && (
          <p className="mt-3 text-sm text-opticolor-gray-600">
            Archivo seleccionado: <span className="font-semibold text-opticolor-gray-800">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </Card>

      {/* Resultados */}
      {result && (
        <Card>
          <h3 className="text-lg font-semibold text-opticolor-gray-800 mb-4">Resultado de la Importación</h3>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{result.summary?.processed || 0}</p>
              <p className="text-sm text-blue-600">Procesadas</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{result.summary?.inserted || 0}</p>
              <p className="text-sm text-green-600">Insertadas</p>
            </div>
            <div className={`border rounded-lg p-4 text-center ${(result.summary?.errors || 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`text-2xl font-bold ${(result.summary?.errors || 0) > 0 ? 'text-red-700' : 'text-gray-400'}`}>{result.summary?.errors || 0}</p>
              <p className="text-sm text-gray-600">Errores</p>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-opticolor-red mb-2">Detalle de Errores</h4>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                {result.errors.map((err, idx) => (
                  <div key={idx} className="text-sm text-red-700 py-1 border-b border-red-100 last:border-0">
                    <span className="font-semibold">Fila {err.row}:</span> {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(result.summary?.errors === 0 || !result.errors?.length) && result.summary?.inserted > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-green-700 font-semibold">Todas las garantías se importaron correctamente sin errores.</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default AdminImportCsv;
