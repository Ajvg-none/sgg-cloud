import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../services/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';

const LEVEL_COLORS = {
  error: 'bg-red-50 border-l-red-500 text-red-800',
  warn: 'bg-yellow-50 border-l-yellow-500 text-yellow-800',
  info: 'bg-blue-50 border-l-blue-500 text-blue-800',
  debug: 'bg-gray-50 border-l-gray-400 text-gray-700',
};

const AdminLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [totalLines, setTotalLines] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [lines, setLines] = useState(200);
  const [level, setLevel] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { lines };
      if (level) params.level = level;
      const res = await adminAPI.getLogs(params);
      setLogs(res.data.logs || []);
      setTotalLines(res.data.totalLines || 0);
      setCurrentFile(res.data.file || '');
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error al cargar logs' });
    } finally {
      setLoading(false);
    }
  }, [lines, level]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadLogs]);

  const getLogLevel = (log) => {
    if (log.level) return log.level.toLowerCase();
    if (log.raw) {
      const match = log.raw.match(/"level":"(\w+)"/);
      if (match) return match[1].toLowerCase();
    }
    return 'info';
  };

  const getLogMessage = (log) => {
    if (log.message) return log.message;
    if (log.raw) return log.raw;
    return JSON.stringify(log);
  };

  const getLogTimestamp = (log) => {
    if (log.timestamp) return new Date(log.timestamp).toLocaleString('es-ES');
    return '';
  };

  const getLogContext = (log) => {
    if (log.context) return log.context;
    return null;
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-opticolor-gray-900 mb-2">Logs del Sistema</h1>
          <p className="text-opticolor-gray-600">
            {currentFile ? `Archivo: ${currentFile} — ${totalLines} líneas totales` : 'Monitor de logs del backend'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={autoRefresh ? 'primary' : 'secondary'}
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="text-sm"
          >
            {autoRefresh ? '⏸ Auto-Refresh ON' : '▶ Auto-Refresh OFF'}
          </Button>
          <Button onClick={loadLogs} className="text-sm">Actualizar</Button>
        </div>
      </div>

      {alert && (
        <div className="mb-6">
          <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
        </div>
      )}

      {/* Filtros */}
      <Card className="mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-opticolor-gray-700 mb-1">Líneas</label>
            <select
              value={lines}
              onChange={(e) => setLines(parseInt(e.target.value))}
              className="px-3 py-2 border border-opticolor-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-opticolor-red focus:border-transparent"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-opticolor-gray-700 mb-1">Nivel</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="px-3 py-2 border border-opticolor-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-opticolor-red focus:border-transparent"
            >
              <option value="">Todos</option>
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Lista de Logs */}
      <Card>
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-opticolor-red"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-opticolor-gray-700 mb-2">No hay logs</h3>
            <p className="text-opticolor-gray-500">No se encontraron entradas de log con los filtros actuales</p>
          </div>
        ) : (
          <div className="space-y-1 font-mono text-sm max-h-[70vh] overflow-y-auto">
            {logs.map((log, idx) => {
              const logLevel = getLogLevel(log);
              const borderColor = LEVEL_COLORS[logLevel] || LEVEL_COLORS.info;
              const isExpanded = expandedIndex === idx;
              const context = getLogContext(log);

              return (
                <div
                  key={idx}
                  className={`border-l-4 px-4 py-2 cursor-pointer hover:bg-opticolor-gray-50 transition-colors ${borderColor}`}
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-opticolor-gray-400 whitespace-nowrap">{getLogTimestamp(log)}</span>
                    <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${logLevel === 'error' ? 'bg-red-100 text-red-700' : logLevel === 'warn' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                      {logLevel}
                    </span>
                    <span className="flex-1 text-xs text-opticolor-gray-800 truncate">{getLogMessage(log)}</span>
                  </div>
                  {isExpanded && context && (
                    <pre className="mt-2 text-xs text-opticolor-gray-600 bg-opticolor-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(context, null, 2)}
                    </pre>
                  )}
                  {isExpanded && !context && log.raw && (
                    <pre className="mt-2 text-xs text-opticolor-gray-600 bg-opticolor-gray-50 p-2 rounded overflow-x-auto">
                      {log.raw}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminLogs;
