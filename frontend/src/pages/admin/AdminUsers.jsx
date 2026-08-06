// frontend/src/pages/admin/AdminUsers.jsx
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
import { Pencil, KeyRound, Trash2 } from 'lucide-react';

const ROLE_LABELS = { ADMIN: 'Administrador', TIENDA: 'Tienda', LABORATORIO: 'Laboratorio' };

const ROLE_COLORS = {
  ADMIN: 'bg-purple-100 text-purple-800 border-purple-300',
  TIENDA: 'bg-blue-100 text-blue-800 border-blue-300',
  LABORATORIO: 'bg-teal-100 text-teal-800 border-teal-300',
};

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'TIENDA', storeId: '', labId: '' });
  const [formErrors, setFormErrors] = useState({});
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);
  const [resetUsername, setResetUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  // ✅ NUEVO: Modal de confirmación de eliminación (reemplaza window.confirm)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [stores, setStores] = useState([]);
  const [labs, setLabs] = useState([]);

  useEffect(() => {
    loadMeta();
    loadUsers();
  }, []);

  const loadMeta = async () => {
    try {
      const [storesRes, labsRes] = await Promise.all([
        adminAPI.getStores(),
        adminAPI.getLabs(),
      ]);
      setStores(storesRes.data.stores || []);
      setLabs(labsRes.data.labs || []);
    } catch (e) { /* silencioso */ }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getUsers();
      setUsers(res.data.users || []);
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error al cargar usuarios' });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm({ username: '', password: '', role: 'TIENDA', storeId: '', labId: '' });
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({ username: user.username, password: '', role: user.role, storeId: user.storeId || '', labId: user.labId || '' });
    setFormErrors({});
    setModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!form.username.trim()) errors.username = 'El usuario es obligatorio';
    if (!editingUser && (!form.password || form.password.length < 6)) errors.password = 'Mínimo 6 caracteres';
    if (form.role === 'TIENDA' && !form.storeId) errors.storeId = 'Asigna una tienda';
    if (form.role === 'LABORATORIO' && !form.labId) errors.labId = 'Asigna un laboratorio';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      if (editingUser) {
        await adminAPI.updateUser(editingUser.id, { username: form.username, active: editingUser.active });
        if (form.password) {
          await adminAPI.resetUserPassword(editingUser.id, form.password);
        }
        setAlert({ type: 'success', message: 'Usuario actualizado' });
      } else {
        await adminAPI.createUser(form);
        setAlert({ type: 'success', message: 'Usuario creado exitosamente' });
      }
      setModalOpen(false);
      loadUsers();
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  const openResetPassword = (user) => {
    setResetUserId(user.id);
    setResetUsername(user.username);
    setNewPassword('');
    setResetModalOpen(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setAlert({ type: 'warning', message: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }
    setResetting(true);
    try {
      await adminAPI.resetUserPassword(resetUserId, newPassword);
      setAlert({ type: 'success', message: `Contraseña reseteada para "${resetUsername}"` });
      setResetModalOpen(false);
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error al resetear' });
    } finally {
      setResetting(false);
    }
  };

  // ✅ NUEVO: Abrir modal de confirmación (reemplaza window.confirm)
  const openDeleteModal = (user) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setUserToDelete(null);
  };

  // ✅ NUEVO: Confirmar eliminación desde el modal
  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      await adminAPI.deleteUser(userToDelete.id);
      setAlert({ type: 'success', message: `Usuario "${userToDelete.username}" eliminado exitosamente.` });
      closeDeleteModal();
      loadUsers();
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.error || 'Error al eliminar el usuario' });
    } finally {
      setDeleting(false);
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: null }));
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-opticolor-gray-900 mb-2">Usuarios</h1>
            <p className="text-opticolor-gray-600">Gestiona las cuentas de acceso al sistema</p>
          </div>
          <Button onClick={openCreate}>+ Nuevo Usuario</Button>
        </div>

        {alert && (
          <div className="mb-6">
            <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
          </div>
        )}

        <Card>
          {loading ? (
            <Spinner size="lg" className="py-12" />
          ) : users.length === 0 ? (
            <EmptyState
              title="No hay usuarios"
              description="Crea el primer usuario para comenzar"
              action={<Button onClick={openCreate}>+ Crear Usuario</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-opticolor-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Usuario</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Rol</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Asociado a</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Estado</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-opticolor-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-opticolor-gray-100 hover:bg-opticolor-gray-50 transition-colors">
                      <td className="py-4 px-4 font-medium text-opticolor-gray-800">{user.username}</td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-700'}`}>
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-opticolor-gray-700">
                        {user.store ? `${user.store.name} (${user.store.accn})` : user.lab ? user.lab.name : '-'}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${user.active ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                          {user.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="grid grid-cols-3 gap-2 items-center">
                          {/* Botón Editar */}
                          <button
                            onClick={() => openEdit(user)}
                            className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-1.5 text-xs font-medium
                              bg-blue-50 text-blue-700 border border-blue-200 rounded-md
                              hover:bg-blue-100 hover:border-blue-300 transition-colors"
                            title="Editar usuario"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Editar</span>
                          </button>
                          {/* Botón Reset */}
                          <button
                            onClick={() => openResetPassword(user)}
                            className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-1.5 text-xs font-medium
                              text-opticolor-gray-600 hover:text-opticolor-gray-900 hover:bg-opticolor-gray-100
                              rounded-md transition-colors border border-transparent hover:border-opticolor-gray-200"
                            title="Resetear contraseña"
                          >
                            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Reset</span>
                          </button>
                          {/* ✅ Botón Eliminar (abre modal de confirmación) */}
                          {user.role !== 'ADMIN' ? (
                            <button
                              onClick={() => openDeleteModal(user)}
                              className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-1.5 text-xs font-medium
                                text-red-600 hover:text-red-700 hover:bg-red-50
                                rounded-md transition-colors border border-transparent hover:border-red-200"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Eliminar</span>
                            </button>
                          ) : (
                            <div className="w-full"></div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Modal Crear/Editar Usuario */}
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'} size="md">
          <div className="space-y-4">
            <Input label="Nombre de Usuario" value={form.username} onChange={(e) => handleChange('username', e.target.value)} error={formErrors.username} placeholder="Ej: tienda001" disabled={!!editingUser} />
            <Input label={editingUser ? 'Nueva Contraseña (dejar vacío para no cambiar)' : 'Contraseña'} type="password" value={form.password} onChange={(e) => handleChange('password', e.target.value)} error={formErrors.password} placeholder="Mínimo 6 caracteres" />
            <Select
              label="Rol"
              value={form.role}
              onChange={(e) => handleChange('role', e.target.value)}
              disabled={!!editingUser}
              options={[
                { value: 'TIENDA', label: 'Tienda' },
                { value: 'LABORATORIO', label: 'Laboratorio' },
              ]}
            />
            {form.role === 'TIENDA' && (
              <Select
                label="Tienda Asociada"
                value={form.storeId}
                onChange={(e) => handleChange('storeId', e.target.value)}
                error={formErrors.storeId}
                placeholder="Seleccionar..."
                options={stores.map((s) => ({ value: s.id, label: `${s.name} (${s.accn})` }))}
              />
            )}
            {form.role === 'LABORATORIO' && (
              <Select
                label="Laboratorio Asociado"
                value={form.labId}
                onChange={(e) => handleChange('labId', e.target.value)}
                error={formErrors.labId}
                placeholder="Seleccionar..."
                options={labs.map((l) => ({ value: l.id, label: l.name }))}
              />
            )}
            <div className="flex justify-end gap-3 pt-4 border-t border-opticolor-gray-200">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} loading={saving}>{editingUser ? 'Guardar Cambios' : 'Crear Usuario'}</Button>
            </div>
          </div>
        </Modal>

        {/* Modal Reset Password */}
        <Modal isOpen={resetModalOpen} onClose={() => setResetModalOpen(false)} title={`Resetear Contraseña — ${resetUsername}`} size="sm">
          <div className="space-y-4">
            <Input label="Nueva Contraseña" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setResetModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleResetPassword} loading={resetting}>Resetear</Button>
            </div>
          </div>
        </Modal>

        {/* ✅ NUEVO: Modal de Confirmación de Eliminación */}
        <Modal isOpen={deleteModalOpen} onClose={closeDeleteModal} title="Eliminar Usuario" size="sm">
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5 bg-red-100 rounded-full p-2">
                <Trash2 className="h-5 w-5 text-red-600" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800 mb-1">
                  ¿Eliminar al usuario <span className="font-mono">"{userToDelete?.username}"</span>?
                </p>
                <p className="text-sm text-red-700">
                  Esta acción eliminará la cuenta permanentemente de la base de datos y no se puede deshacer.
                </p>
                {userToDelete?.store && (
                  <p className="text-xs text-red-600 mt-2">
                    Tienda asociada: {userToDelete.store.name} ({userToDelete.store.accn})
                  </p>
                )}
                {userToDelete?.lab && (
                  <p className="text-xs text-red-600 mt-2">
                    Laboratorio asociado: {userToDelete.lab.name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={closeDeleteModal} disabled={deleting}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleDeleteConfirm} loading={deleting}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Eliminar definitivamente
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default AdminUsers;