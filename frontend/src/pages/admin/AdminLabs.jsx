import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';

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

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: null }));
  };

  return (
    <div className="p-8">
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
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-opticolor-red"></div></div>
        ) : labs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔬</div>
            <h3 className="text-xl font-semibold text-opticolor-gray-700 mb-2">No hay laboratorios</h3>
            <p className="text-opticolor-gray-500 mb-4">Crea el primer laboratorio para comenzar</p>
            <Button onClick={openCreate}>+ Crear Laboratorio</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-opticolor-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Nombre</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">IP Agente</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Puerto</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Ruta VCA</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Tiendas</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Garantías</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {labs.map((lab) => (
                  <tr key={lab.id} className="border-b border-opticolor-gray-100 hover:bg-opticolor-gray-50 transition-colors">
                    <td className="py-4 px-4 font-medium text-opticolor-gray-800">{lab.name}</td>
                    <td className="py-4 px-4 font-mono text-sm text-opticolor-gray-700">{lab.agentIp}</td>
                    <td className="py-4 px-4 font-mono text-sm text-opticolor-gray-700">{lab.agentPort}</td>
                    <td className="py-4 px-4 text-sm text-opticolor-gray-600 max-w-xs truncate" title={lab.vcaNetworkPath}>{lab.vcaNetworkPath}</td>
                    <td className="py-4 px-4 text-sm text-opticolor-gray-700">{lab._count?.stores || 0}</td>
                    <td className="py-4 px-4 text-sm text-opticolor-gray-700">{lab._count?.warranties || 0}</td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="secondary" onClick={() => openEdit(lab)} className="px-3 py-1 text-xs">Editar</Button>
                        <Button variant="ghost" onClick={() => handleRegenerateKey(lab)} className="px-3 py-1 text-xs">Nueva Key</Button>
                        <Button variant="ghost" onClick={() => handleDelete(lab)} className="px-3 py-1 text-xs text-red-600 hover:text-red-800">Eliminar</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  );
};

export default AdminLabs;
