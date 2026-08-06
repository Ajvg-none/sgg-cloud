const axios = require('axios');
const config = require('../config/gesvision');
const logger = require('../config/logger');

const MAX_NETWORK_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 800;
const RETRY_MAX_DELAY_MS = 5000;

const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNABORTED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EAI_AGAIN',
  'EPIPE',
  'ECONNREFUSED',
  'ERR_NETWORK',
  'ERR_BAD_RESPONSE'
]);

const RETRYABLE_HTTP_STATUS = new Set([
  408,
  425,
  429,
  500,
  502,
  503,
  504
]);

let authToken = null;
let tokenExpiry = null;
let isAuthenticating = false;
const MAX_AUTH_RETRIES = 2;

/**
* Obtiene y cachea un token Bearer de GesVision con reintentos controlados.
* @returns {Promise<string>} Token válido para autenticación.
*/
async function authenticate() {
  if (isAuthenticating) {
    logger.warn('Autenticación en curso, esperando...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (authToken && Date.now() < tokenExpiry) return authToken;
  }
  isAuthenticating = true;
  for (let attempt = 1; attempt <= MAX_AUTH_RETRIES + 1; attempt++) {
    try {
      logger.info(`🔐 Intentando autenticación en GesVision (intento ${attempt}/${MAX_AUTH_RETRIES + 1})...`);
      const response = await axios.post(`${config.apiUrl}/auth/signin`, {
        username: config.user,
        password: config.password,
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });
      const rawToken = response.data;
      if (typeof rawToken === 'string' && rawToken.startsWith('Bearer ')) {
        authToken = rawToken.replace('Bearer ', '');
        tokenExpiry = Date.now() + 3600 * 1000;
        logger.info('✅ Autenticación exitosa en GesVision');
        return authToken;
      } else {
        throw new Error('Respuesta de autenticación no contiene Bearer token válido');
      }
    } catch (error) {
      const errorDetail = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.code || error.message || 'Error desconocido';
      logger.error(`❌ Error en autenticación GesVision (intento ${attempt}): ${errorDetail}`);
      if (attempt > MAX_AUTH_RETRIES) {
        throw new Error(`No se pudo obtener token de GesVision después de ${MAX_AUTH_RETRIES + 1} intentos: ${errorDetail}`);
      }
      const delay = 2000 * attempt;
      logger.warn(`⏳ Reintentando autenticación en ${delay / 1000} segundos...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  isAuthenticating = false;
}

/**
* Devuelve el token vigente o fuerza una nueva autenticación si expiró.
* @returns {Promise<string>} Token Bearer listo para usar.
*/
async function getToken() {
  if (!authToken || Date.now() >= tokenExpiry) {
    await authenticate();
  }
  return authToken;
}

/**
* Determina si una petición puede reintentarse sin riesgo de duplicar efectos secundarios.
* @param {Object} error - Error capturado por axios.
* @param {string} method - Método HTTP original.
* @returns {boolean}
*/
function isRetryableError(error, method) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (!safeMethods.includes(method.toUpperCase())) {
    return false;
  }
  if (error.code && RETRYABLE_NETWORK_CODES.has(error.code)) {
    return true;
  }
  if (error.response?.status && RETRYABLE_HTTP_STATUS.has(error.response.status)) {
    return true;
  }
  return false;
}

/**
* Calcula un retraso con jitter para evitar que varios workers reintenten al mismo tiempo.
* @param {number} attempt - Número de reintento.
* @returns {number}
*/
function calculateRetryDelay(attempt) {
  const exponentialDelay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  const delay = exponentialDelay + jitter;
  return Math.min(delay, RETRY_MAX_DELAY_MS);
}

/**
* Ejecuta una petición HTTP a GesVision y aplica recuperación automática ante fallos transitorios.
* @param {string} method - Método HTTP.
* @param {string} endpoint - Ruta relativa de GesVision.
* @param {Object|null} data - Cuerpo de la petición.
* @param {boolean} retried - Indica si ya se reintentó por 401.
* @param {number} attempt - Número de intento actual.
* @returns {Promise<Object>}
*/
async function request(method, endpoint, data = null, retried = false, attempt = 1) {
  const token = await getToken();
  const url = `${config.apiUrl}${endpoint}`;
  try {
    const response = await axios({
      method,
      url,
      data,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 6000
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 401 && !retried) {
      logger.warn(`Token expirado en ${method} ${endpoint}, reautenticando...`);
      authToken = null;
      tokenExpiry = null;
      return request(method, endpoint, data, true, attempt);
    }
    if (attempt <= MAX_NETWORK_RETRIES && isRetryableError(error, method)) {
      const delay = calculateRetryDelay(attempt);
      const errorCode = error.code || `HTTP ${error.response?.status}`;
      logger.warn(
        `⚠️ ${errorCode} en ${method} ${endpoint} (intento ${attempt}/${MAX_NETWORK_RETRIES}). ` +
        `Reintentando en ${(delay / 1000).toFixed(1)}s...`
      );
      await new Promise(resolve => setTimeout(resolve, delay));
      return request(method, endpoint, data, retried, attempt + 1);
    }
    logger.error(
      `Error en llamada a GesVision ${method} ${endpoint}: ` +
      `${error.response?.data || error.message}`
    );
    throw error;
  }
}

/**
* Recupera una orden de lentes desde GesVision.
* @param {number|string} orderId - Identificador externo.
* @returns {Promise<Object>}
*/
async function getGlassesOrder(orderId) {
  return request('GET', `/glasses-orders/${orderId}`);
}

/**
* Recupera una orden de lentes buscando por su número de orden legible.
* @param {string} orderNumber - Número de orden (ej: 100000001164).
* @returns {Promise<Object>}
*/
async function getGlassesOrderByNumber(orderNumber) {
  try {
    const code = orderNumber;
    let found = null;

    // 1. Búsqueda por código directo
    try {
      logger.info(`Buscando orden por código en GesVision: ${code}`);
      const response = await request('GET', `/glasses-orders?code=${encodeURIComponent(code)}`);
      const orders = Array.isArray(response) ? response : (response && response.data && Array.isArray(response.data) ? response.data : (response && response.items && Array.isArray(response.items) ? response.items : []));
      found = orders.find(o => String(o.code) === String(code) || String(o.number) === String(code));
      if (!found) {
        found = orders.find(o => String(o.code).toLowerCase() === String(code).toLowerCase() || String(o.number).toLowerCase() === String(code).toLowerCase());
      }
    } catch (err) {
      logger.warn(`⚠️ Error en la búsqueda por código: ${err.message}`);
    }

    // 2. Búsqueda por número directo (si no se encontró por código)
    if (!found) {
      try {
        logger.info(`Buscando orden por número en GesVision: ${code}`);
        const response = await request('GET', `/glasses-orders?number=${encodeURIComponent(code)}`);
        const orders = Array.isArray(response) ? response : (response && response.data && Array.isArray(response.data) ? response.data : (response && response.items && Array.isArray(response.items) ? response.items : []));
        found = orders.find(o => String(o.code) === String(code) || String(o.number) === String(code));
        if (!found) {
          found = orders.find(o => String(o.code).toLowerCase() === String(code).toLowerCase() || String(o.number).toLowerCase() === String(code).toLowerCase());
        }
      } catch (err) {
        logger.warn(`⚠️ Error en la búsqueda por número: ${err.message}`);
      }
    }

    // 3. Escaneo paginado (si todavía no se encuentra en las páginas principales)
    if (!found) {
      try {
        let skip = 0;
        const limit = 50;
        logger.info(`⚡ [Forzar Orden] Iniciando escaneo paginado en GesVision para: ${code}...`);
        while (true) {
          const response = await request('GET', `/glasses-orders?skip=${skip}&limit=${limit}`);
          const orders = Array.isArray(response) ? response : (response && response.data && Array.isArray(response.data) ? response.data : (response && response.items && Array.isArray(response.items) ? response.items : []));
          if (!orders || orders.length === 0) break;
          found = orders.find(o => String(o.code) === String(code) || String(o.number) === String(code));
          if (!found) {
            found = orders.find(o => String(o.code).toLowerCase() === String(code).toLowerCase() || String(o.number).toLowerCase() === String(code).toLowerCase());
          }
          if (found) {
            logger.info(`⚡ [Forzar Orden] Encontrado en escaneo paginado: ID ${found.id}`);
            break;
          }
          if (orders.length < limit) break;
          skip += limit;
        }
      } catch (err) {
        logger.error(`❌ Error en escaneo paginado: ${err.message}`);
      }
    }

    if (found) {
      return found;
    }
    throw new Error(`No se encontró ninguna orden con el número o código exacto: ${orderNumber}`);
  } catch (error) {
    logger.error(`❌ Error buscando orden por número/código ${orderNumber}: ${error.message}`);
    throw error;
  }
}

/**
* Obtiene una factura emitida para reconstruir los ítems de impresión.
* @param {number|string} invoiceId - Identificador externo.
* @returns {Promise<Object>}
*/
async function getIssuedInvoice(invoiceId) {
  return request('GET', `/issuedInvoices/${invoiceId}`);
}

/**
* Obtiene la orden emitida asociada a una orden de lentes.
* @param {number|string} orderId - Identificador externo.
* @returns {Promise<Object>}
*/
async function getIssuedOrder(orderId) {
  return request('GET', `/issuedOrders/${orderId}`);
}

/**
* Recupera datos de una bodega/tienda usada como warehouse en GesVision.
* @param {number|string} warehouseId - Identificador externo.
* @returns {Promise<Object>}
*/
async function getWarehouse(warehouseId) {
  return request('GET', `/warehouses/${warehouseId}`);
}

/**
* Lista órdenes de lentes sin paginación explícita.
* @returns {Promise<Object>}
*/
async function listGlassesOrders() {
  return request('GET', '/glasses-orders');
}

/**
* Formatea una fecha al esquema exacto que espera GesVision en sus filtros.
* @param {Date|string|number} date - Fecha de origen.
* @returns {string}
*/
function formatGesvisionDate(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
* Lista órdenes paginadas y opcionalmente acotadas por fecha.
* @param {number} skip - Desplazamiento inicial.
* @param {number} limit - Tamaño de página.
* @param {Date|null} fechaInicial - Filtro inferior de fecha.
* @returns {Promise<Object>}
*/
async function listGlassesOrdersPaginated(skip = 0, limit = 50, fechaInicial = null) {
  let endpoint = `/glasses-orders?skip=${skip}&limit=${limit}`;
  if (fechaInicial) {
    endpoint += `&fechaInicial=${encodeURIComponent(formatGesvisionDate(fechaInicial))}`;
  }
  return request('GET', endpoint);
}

/**
* Recupera el catálogo de productos para enriquecer la sincronización local.
* @param {number|string} productId - Identificador externo.
* @returns {Promise<Object>}
*/
async function getProduct(productId) {
  return request('GET', `/products/${productId}`);
}

/**
* Devuelve el listado global de issuedOrders para detectar cambios de fabricación.
* @returns {Promise<Array<Object>|null>}
*/
async function getAllIssuedOrders() {
  try {
    const issuedOrders = await request('GET', '/issuedOrders');
    return Array.isArray(issuedOrders) ? issuedOrders : null;
  } catch (err) {
    logger.error(`❌ Error al obtener listado global de issuedOrders: ${err.message}`);
    return null;
  }
}

/**
* Obtiene el listado de guías de entrega recibidas (recibidas por el laboratorio o tiendas).
* @param {number} skip - Desplazamiento inicial.
* @param {number} limit - Límite de registros.
* @returns {Promise<Array<Object>>}
*/
async function listReceivedDeliveryNotes(skip = 0, limit = 50) {
  return request('GET', `/receivedDeliveryNotes?skip=${skip}&limit=${limit}`);
}

/**
* Obtiene el detalle de un cliente (para extraer su nombre completo).
* @param {number|string} customerId - Identificador del cliente.
* @returns {Promise<Object>}
*/
async function getCustomer(customerId) {
  return request('GET', `/customers/${customerId}`);
}

/**
* ✅ NUEVO: Obtiene los datos del asesor/vendedor responsable de la venta.
* ⚠️ Si tu GesVision expone este recurso bajo otro nombre (employees/users/salesmen),
* cambia ÚNICAMENTE la ruta de esta función. Este es el único punto de cambio.
* @param {number|string} sellerId - Identificador del asesor/vendedor.
* @returns {Promise<Object>}
*/
async function getSeller(sellerId) {
  return request('GET', `/sellers/${sellerId}`);
}

module.exports = {
  authenticate,
  getToken,
  request,
  getGlassesOrder,
  getGlassesOrderByNumber,
  getIssuedInvoice,
  getIssuedOrder,
  getWarehouse,
  listGlassesOrders,
  listGlassesOrdersPaginated,
  formatGesvisionDate,
  getProduct,
  getAllIssuedOrders,
  listReceivedDeliveryNotes,
  getCustomer,
  getSeller
};