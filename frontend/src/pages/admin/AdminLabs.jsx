import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Select from '../../components/ui/Select';
import Pagination from '../../components/ui/Pagination';
import { Pencil, Trash2, KeyRound, Search, RefreshCw } from 'lucide-react';

const LIMIT_OPTIONS = [
  { value: 5, label: '5 filas' },
  { value: 10, label: '10 filas' },
  { value: 20, label: '20 filas' },
  { value: 50, label: '50 filas' },
];

const AdminLabs = () => {
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLab, setEditingLab] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', agentIp: '', agentPort: '', vcaNetworkPath: '' });
  const [formErrors, setFormErrors] = useState({});
  const [generatedKey, setGeneratedKey] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => { loadLabs(); }, []);

  const loadLabs = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getLabs();
      setLabs(res.data.labs || []);
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error al cargar laboratorios' });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingLab(null);
    setForm({ name: '', agentIp: '', agentPort: '', vcaNetworkPath: '' });
    setFormErrors({});
    setGeneratedKey(null);
    setModalOpen(true);
  };

  const openEdit = (lab) => {
    setEditingLab(lab);
    setForm({ name: lab.name, agentIp: lab.agentIp, agentPort: lab.agentPort, vcaNetworkPath: lab.vcaNetworkPath });
    setFormErrors({});
    setGeneratedKey(null);
    setModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'El nombre es obligatorio';
    if (!form.agentIp.trim()) errors.agentIp = 'La IP del agente es obligatoria';
    if (!form.agentPort || isNaN(parseInt(form.agentPort)) || parseInt(form.agentPort) < 1 || parseInt(form.agentPort) > 65535)
      errors.agentPort = 'Puerto inválido (1-65535)';
    if (!form.vcaNetworkPath.trim()) errors.vcaNetworkPath = 'La ruta VCA es obligatoria';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      if (editingLab) {
        await adminAPI.updateLab(editingLab.id, form);
        setAlert({ type: 'success', message: 'Laboratorio actualizado exitosamente' });
      } else {
        const res = await adminAPI.createLab(form);
        setGeneratedKey(res.data.lab?.apiKey || null);
        setAlert({ type: 'success', message: 'Laboratorio creado. Guarda la API Key.' });
      }
      setModalOpen(false);
      loadLabs();
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lab) => {
    if (!window.confirm(`¿Eliminar "${lab.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await adminAPI.deleteLab(lab.id);
      setAlert({ type: 'success', message: 'Laboratorio eliminado' });
      loadLabs();
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error al eliminar' });
    }
  };

  const handleRegenerateKey = async (lab) => {
    if (!window.confirm(`¿Regenerar API Key para "${lab.name}"? El agente actual dejará de funcionar hasta que se actualice.`)) return;
    try {
      const res = await adminAPI.regenerateLabApiKey(lab.id);
      setGeneratedKey(res.data.apiKey);
      setAlert({ type: 'success', message: 'API Key regenerada. Copia la nueva clave ahora.' });
      loadLabs();
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error al regenerar' });
    }
  };

  const handleCopyKey = (key) => {
    navigator.clipboard.writeText(key).then(() => {
      setAlert({ type: 'info', message: 'API Key copiada al portapapeles' });
    });
  };

  // Filtro y paginación en el navegador (el endpoint trae todos los labs)
  const filteredLabs = (labs || []).filter((lab) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (lab.name || '').toLowerCase().includes(q) ||
      (lab.agentIp || '').toLowerCase().includes(q) ||
      (lab.vcaNetworkPath || '').toLowerCase().includes(q)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredLabs.length / limit));
  const safePage = Math.min(page, totalPages);
  const pagedLabs = filteredLabs.slice((safePage - 1) * limit, safePage * limit);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: null }));
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-opticolor-gray-900 mb-2">Laboratorios</h1>
          <p className="text-opticolor-gray-600">Gestiona los laboratorios y sus configuraciones de agente</p>
        </div>
        <Button onClick={openCreate}>+ Nuevo Laboratorio</Button>
      </div>

      {alert && (
        <div className="mb-6">
          <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
        </div>
      )}

      {generatedKey && (
        <Card className="mb-6 border-2 border-green-300 bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-800 mb-1">Clave API Generada</p>
              <p className="font-mono text-sm text-green-900 bg-green-100 px-3 py-1 rounded">{generatedKey}</p>
              <p className="text-xs text-green-700 mt-1">Guarda esta clave. No se mostrará de nuevo.</p>
            </div>
            <Button variant="secondary" onClick={() => handleCopyKey(generatedKey)} className="text-sm">Copiar</Button>
          </div>
        </Card>
      )}

      <Card>
        {/* Toolbar: búsqueda, filas por página y actualizar */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-opticolor-gray-400" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar por nombre, IP o ruta…"
              aria-label="Buscar laboratorio"
              className="pl-9 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 md:ml-auto">
            <Select
              value={limit}
              onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); }}
              options={LIMIT_OPTIONS}
              aria-label="Filas por página"
              className="py-2 text-sm"
            />
            <Button variant="secondary" onClick={loadLabs} disabled={loading} className="px-3 py-2 text-sm">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Actualizar
            </Button>
          </div>
        </div>
        {loading ? (
          <Spinner size="lg" className="py-12" />
        ) : labs.length === 0 ? (
          <EmptyState
            title="No hay laboratorios"
            description="Crea el primer laboratorio para comenzar"
            action={<Button onClick={openCreate}>+ Crear Laboratorio</Button>}
          />
                ) : filteredLabs.length === 0 ? (
          <EmptyState
            title="Sin resultados"
            description={`No se encontraron laboratorios para "${search}"`}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '19%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '29%' }} />
                </colgroup>
                <thead>
                  <tr className="bg-opticolor-gray-100 border-b-2 border-opticolor-red">
                    <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-opticolor-gray-600">Nombre</th>
                    <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-opticolor-gray-600">IP Agente</th>
                    <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-opticolor-gray-600">Puerto</th>
                    <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-opticolor-gray-600">Ruta VCA</th>
                    <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-opticolor-gray-600">Tiendas</th>
                    <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-opticolor-gray-600">Garantías</th>
                    <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-opticolor-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-opticolor-gray-100 bg-white">
                  {pagedLabs.map((lab) => (
                    <tr key={lab.id} className="transition-colors even:bg-opticolor-gray-50/60 hover:bg-red-50/70">
                      <td className="py-3.5 px-4 align-middle text-center text-sm font-semibold text-opticolor-gray-800 overflow-hidden whitespace-nowrap text-ellipsis">{lab.name}</td>
                      <td className="py-3.5 px-4 align-middle text-center text-sm text-opticolor-gray-700 tabular-nums">{lab.agentIp}</td>
                      <td className="py-3.5 px-4 align-middle text-center text-sm text-opticolor-gray-700 tabular-nums">{lab.agentPort}</td>
                      <td className="py-3.5 px-4 align-middle text-center text-sm text-opticolor-gray-600 overflow-hidden whitespace-nowrap text-ellipsis" title={lab.vcaNetworkPath}>{lab.vcaNetworkPath}</td>
                      <td className="py-3.5 px-4 align-middle text-center text-sm font-semibold text-opticolor-gray-700 tabular-nums">{lab._count?.stores || 0}</td>
                      <td className="py-3.5 px-4 align-middle text-center text-sm font-semibold text-opticolor-gray-700 tabular-nums">{lab._count?.warranties || 0}</td>
                      <td className="py-3.5 px-2 align-middle text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEdit(lab)}
                            className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-1.5 text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 hover:border-blue-300 transition-colors"
                            title="Editar laboratorio"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => handleRegenerateKey(lab)}
                            className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-1.5 text-[11px] font-medium text-opticolor-gray-600 hover:text-opticolor-gray-900 hover:bg-opticolor-gray-100 rounded-md transition-colors border border-transparent hover:border-opticolor-gray-200"
                            title="Regenerar API Key"
                          >
                            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Nueva Key</span>
                          </button>
                          <button
                            onClick={() => handleDelete(lab)}
                            className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-1.5 text-[11px] font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors border border-transparent hover:border-red-200"
                            title="Eliminar laboratorio"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Eliminar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5">
              <p className="text-sm text-opticolor-gray-600">
                Mostrando <span className="font-semibold">{(safePage - 1) * limit + 1}–{Math.min(safePage * limit, filteredLabs.length)}</span> de <span className="font-semibold">{filteredLabs.length}</span> laboratorios
              </p>
              <Pagination page={safePage} totalPages={totalPages} onChange={(p) => setPage(p)} />
            </div>
          </>
        )}
      </Card>

      {/* Modal Crear/Editar */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingLab ? 'Editar Laboratorio' : 'Nuevo Laboratorio'} size="md">
        <div className="space-y-4">
          <Input label="Nombre" value={form.name} onChange={(e) => handleChange('name', e.target.value)} error={formErrors.name} placeholder="Ej: Laboratorio Central" />
          <Input label="IP del Agente" value={form.agentIp} onChange={(e) => handleChange('agentIp', e.target.value)} error={formErrors.agentIp} placeholder="Ej: 192.168.1.100" />
          <Input label="Puerto del Agente" value={form.agentPort} onChange={(e) => handleChange('agentPort', e.target.value)} error={formErrors.agentPort} placeholder="Ej: 3001" />
          <Input label="Ruta VCA de Red" value={form.vcaNetworkPath} onChange={(e) => handleChange('vcaNetworkPath', e.target.value)} error={formErrors.vcaNetworkPath} placeholder="Ej: \\192.168.1.100\Lensware\VCA" />
          <div className="flex justify-end gap-3 pt-4 border-t border-opticolor-gray-200">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>{editingLab ? 'Guardar Cambios' : 'Crear Laboratorio'}</Button>
          </div>
        </div>
      </Modal>
      </div>
    </div>
  );
};

export default AdminLabs;
