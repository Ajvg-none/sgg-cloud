// frontend/src/store/warrantyFormStore.js
import { create } from 'zustand';
import { storeAPI } from '../services/api';

/**
 * 🌐 STORE GLOBAL del formulario "Nueva Garantía".
 *
 * ¿Por qué existe? Antes todo el estado vivía en useState dentro de
 * StoreWarranty.jsx. Al navegar a "Historial", React desmontaba el
 * componente y la sincronización en curso se perdía.
 *
 * Con Zustand, el estado y la petición viven FUERA del árbol de React:
 * la búsqueda continúa en segundo plano y, al regresar, el formulario
 * aparece exactamente como quedó (cargando o con el resultado).
 */
const useWarrantyFormStore = create((set, get) => ({
  // ---------- Estado del formulario ----------
  orderNumber: '',
  orderData: null,
  warrantyType: '',
  storeObservations: '',
  // ✅ NUEVO: Ojos afectados para Error de RX / Transcripción.
  // Array con 'OD' y/o 'OI'. Ambos marcados = ambos ojos.
  affectedEyes: ['OD', 'OI'],
  errors: {},
  loading: false,
  saving: false,
  alert: null,
  // Token interno: ignora respuestas de búsquedas obsoletas
  _searchToken: 0,

  // ---------- Setters ----------
  setOrderNumber: (value) => set({ orderNumber: value }),
  setWarrantyType: (value) =>
    set((state) => ({
      warrantyType: value,
      // ✅ NUEVO: al cambiar el tipo de garantía, los ojos vuelven a "ambos"
      affectedEyes: ['OD', 'OI'],
      errors: { ...state.errors, warrantyType: null, affectedEyes: null },
    })),
  // ✅ NUEVO: marca / desmarca un ojo afectado (OD u OI)
  toggleAffectedEye: (eye) =>
    set((state) => {
      const isSelected = state.affectedEyes.includes(eye);
      const toggled = isSelected
        ? state.affectedEyes.filter((e) => e !== eye)
        : [...state.affectedEyes, eye];
      // Normaliza el orden: OD siempre primero
      const next = ['OD', 'OI'].filter((e) => toggled.includes(e));
      return {
        affectedEyes: next,
        errors: { ...state.errors, affectedEyes: null },
      };
    }),
  setStoreObservations: (value) => set({ storeObservations: value }),
  setAlert: (value) => set({ alert: value }),
  clearAlert: () => set({ alert: null }),
  setErrors: (value) => set({ errors: value }),
  setSaving: (value) => set({ saving: value }),
  handleFieldChange: (field, value) =>
    set((state) => ({
      orderData: state.orderData ? { ...state.orderData, [field]: value } : state.orderData,
      errors: { ...state.errors, [field]: null },
    })),

  // ---------- Búsqueda (continúa en segundo plano) ----------
  searchOrder: async () => {
    const { orderNumber, loading } = get();
    if (!orderNumber.trim()) {
      set({ alert: { type: 'warning', message: 'Por favor ingresa un número de OTG' } });
      return;
    }
    if (loading) return; // ya hay una sincronización en curso, no duplicar
    const token = get()._searchToken + 1;
    set({ _searchToken: token, loading: true, alert: null, orderData: null, errors: {} });
    try {
      const response = await storeAPI.getOrder(orderNumber);
      if (get()._searchToken !== token) return; // el usuario lanzó otra búsqueda
      set({
        loading: false,
        orderData: response.data.order,
        alert: {
          type: 'success',
          message: 'OTG encontrada. Selecciona un tipo de garantía para editar los campos.',
        },
      });
    } catch (error) {
      if (get()._searchToken !== token) return;
      set({
        loading: false,
        orderData: null,
        alert: {
          type: 'error',
          message: error.response?.data?.details || 'Error al buscar la OTG',
        },
      });
    }
  },

  // ---------- Reset después de guardar con éxito ----------
  resetForm: () =>
    set({
      orderNumber: '',
      orderData: null,
      warrantyType: '',
      storeObservations: '',
      affectedEyes: ['OD', 'OI'],
      errors: {},
      alert: null,
      saving: false,
    }),
}));

export default useWarrantyFormStore;