import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';

const AdminStores = () => {
  const [stores, setStores] = useState([]);
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', accn: '', labId: '' });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [storesRes, labsRes] = await Promise.all([
        adminAPI.getStores(),
        adminAPI.getLabs(),
      ]);
      setStores(storesRes.data.stores || []);
      setLabs(labsRes.data.labs || []);
    } catch (e) {
      setAlert({ type: 'error', message: 'Error al cargar datos' });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingStore(null);
    setForm({ name: '', accn: '', labId: labs[0]?.id || '' });
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (store) => {
    setEditingStore(store);
    setForm({
      name: store.name,
      accn: store.accn,
      labId: store.labId || store.lab?.id || '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'El nombre es obligatorio';
    if (!form.accn || !/^\d{3}$/.test(form.accn)) errors.accn = 'El ACCN debe ser 3 dígitos numéricos';
    if (!form.labId) errors.labId = 'Selecciona un laboratorio';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      if (editingStore) {
        const data = { name: form.name, accn: form.accn, labId: form.labId };
        await adminAPI.updateStore(editingStore.id, data);
        setAlert({ type: 'success', message: 'Tienda actualizada' });
      } else {
        await adminAPI.createStore(form);
        setAlert({ type: 'success', message: 'Tienda creada exitosamente' });
      }
      setModalOpen(false);
      loadData();
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (store) => {
    try {
      await adminAPI.updateStore(store.id, { active: !store.active });
      setAlert({ type: 'success', message: `Tienda ${store.active ? 'desactivada' : 'activada'}` });
      loadData();
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error' });
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: null }));
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-opticolor-gray-900 mb-2">Tiendas</h1>
          <p className="text-opticolor-gray-600">Gestiona las tiendas y sus códigos ACCN</p>
        </div>
        <Button onClick={openCreate}>+ Nueva Tienda</Button>
      </div>

      {alert && (
        <div className="mb-6">
          <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
        </div>
      )}

      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-opticolor-red"></div>
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏪</div>
            <h3 className="text-xl font-semibold text-opticolor-gray-700 mb-2">No hay tiendas</h3>
            <p className="text-opticolor-gray-500 mb-4">Crea la primera tienda para empezar</p>
            <Button onClick={openCreate}>+ Crear Tienda</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-opticolor-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Nombre</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">ACCN</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Laboratorio</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Garantías</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Usuarios</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Estado</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.id} className="border-b border-opticolor-gray-100 hover:bg-opticolor-gray-50 transition-colors">
                    <td className="py-4 px-4 font-medium text-opticolor-gray-800">{store.name}</td>
                    <td className="py-4 px-4 font-mono text-sm text-opticolor-gray-700">{store.accn}</td>
                    <td className="py-4 px-4 text-sm text-opticolor-gray-700">{store.lab?.name || '-'}</td>
                    <td className="py-4 px-4 text-sm text-opticolor-gray-700">{store._count?.warranties || 0}</td>
                    <td className="py-4 px-4 text-sm text-opticolor-gray-700">{store._count?.users || 0}</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        store.active 
                          ? 'bg-green-100 text-green-800 border-green-300' 
                          : 'bg-gray-100 text-gray-600 border-gray-300'
                      }`}>
                        {store.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(store)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                            bg-blue-50 text-blue-700 border border-blue-200 rounded-md
                            hover:bg-blue-100 hover:border-blue-300 transition-colors"
                          title="Editar tienda"
                        >
                          <span className="text-sm">✏️</span>
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggleActive(store)}
                          className={`inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            store.active
                              ? 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
                              : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                          }`}
                          title={store.active ? 'Desactivar tienda' : 'Activar tienda'}
                        >
                          <span className="text-sm">{store.active ? '⏸️' : '▶️'}</span>
                          <span className="hidden xl:inline">{store.active ? 'Desactivar' : 'Activar'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingStore ? 'Editar Tienda' : 'Nueva Tienda'} size="md">
        <div className="space-y-4">
          <Input 
            label="Nombre de la Tienda" 
            value={form.name} 
            onChange={(e) => handleChange('name', e.target.value)} 
            error={formErrors.name} 
            placeholder="Ej: Óptica Centro" 
          />
          <Input 
            label="Código ACCN (3 dígitos)" 
            value={form.accn} 
            onChange={(e) => handleChange('accn', e.target.value)} 
            error={formErrors.accn} 
            placeholder="Ej: 001" 
            maxLength={3} 
          />
          <div>
            <label className="block text-sm font-medium text-opticolor-gray-700 mb-1">Laboratorio Asignado</label>
            <select
              value={form.labId}
              onChange={(e) => handleChange('labId', e.target.value)}
              className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-opticolor-red focus:border-transparent ${
                formErrors.labId ? 'border-opticolor-red-light bg-red-50' : 'border-opticolor-gray-200'
              }`}
            >
              <option value="">Seleccionar...</option>
              {labs.map((lab) => (
                <option key={lab.id} value={lab.id}>{lab.name}</option>
              ))}
            </select>
            {formErrors.labId && <p className="text-sm text-opticolor-red-light mt-1">{formErrors.labId}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-opticolor-gray-200">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>
              {editingStore ? 'Guardar Cambios' : 'Crear Tienda'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminStores;