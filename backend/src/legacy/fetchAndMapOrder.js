// backend/src/legacy/fetchAndMapOrder.js
const gesvisionApi = require('./gesvisionApi');
const logger = require('../config/logger');

const LENS_TYPE_MAP = { 'L': 'DE LEJOS', 'C': 'DE CERCA', 'B': 'BIFOCAL', 'P': 'PROGRESIVO' };

const productCache = new Map();

/**
 * @param {Array<Object>} items - Ítems normalizados.
 * @returns {string|null}
 */
function inferTipoLenteFromItems(items) {
  if (!items || items.length === 0) return null;
  const texto = items.map(i => (i.descripcion || '').toLowerCase()).join(' ');
  if (texto.includes('progresivo') || texto.includes('pro ') || texto.includes('balance')) return 'PROGRESIVO';
  if (texto.includes('bifocal')) return 'BIFOCAL';
  if (texto.includes('monofocal')) return 'MONOFOCAL';
  return null;
}

function getPupilHeight(order, eye) {
  const eyeKey = eye === 'OD' ? 'OD' : 'OI';
  const possibleRootFields = [`height${eyeKey}`, `pupilHeight${eyeKey}`, `verticalHeight${eyeKey}`, `eyeHeight${eyeKey}`, `pupillaryHeight${eyeKey}`, `alturaPupilar${eyeKey}`];
  for (const field of possibleRootFields) {
    if (order[field] !== undefined && order[field] !== null) return order[field];
  }
  const opticalData = order[`opticalData${eyeKey}`];
  if (opticalData) {
    const opticalFields = ['height', 'pupilHeight', 'verticalHeight', 'eyeHeight'];
    for (const field of opticalFields) {
      if (opticalData[field] !== undefined && opticalData[field] !== null) return opticalData[field];
    }
  }
  return null;
}

async function mapLineItems(lineItems) {
  const mappedItems = [];
  for (const item of lineItems) {
    let descripcion = item.extendedDescription?.trim();
    let codigoArticulo = null;
    let esMontura = false;
    let esCristal = false;
    let prefijoCodigo = '';
    if (item.product) {
      let productData = productCache.get(item.product);
      if (!productData) {
        try {
          const product = await gesvisionApi.getProduct(item.product);
          productData = {
            description: product.description || product.extendedDescription || null,
            reference: product.reference || null,
            barCode: product.barCode || null
          };
          productCache.set(item.product, productData);
        } catch (err) {
          logger.error(`Error al obtener producto ${item.product}: ${err.message}`);
          productData = null;
        }
      }
      if (productData) {
        if (!descripcion) descripcion = productData.description;
        codigoArticulo = (productData.reference || productData.barCode || '').trim();
        const descLower = (descripcion || '').toLowerCase();
        const refLower = (codigoArticulo || '').toLowerCase();
        if (descLower.includes('montura') || descLower.includes('armazon') || descLower.includes('armazón') || descLower.includes('frame') || refLower.startsWith('m')) {
          esMontura = true; prefijoCodigo = 'M';
        }
        if (descLower.includes('cristal') || descLower.includes('lente') || descLower.includes('lens') || descLower.includes('progresivo') || descLower.includes('bifocal') || descLower.includes('monofocal') || descLower.includes('varilux') || descLower.includes('essilor')) {
          esCristal = true;
          if (descLower.includes('progresivo') || descLower.includes('progressive')) prefijoCodigo = 'H';
          else if (descLower.includes('bifocal')) prefijoCodigo = 'B';
          else if (descLower.includes('high index') || descLower.includes('hi-in')) prefijoCodigo = 'H';
          else prefijoCodigo = 'C';
        }
      }
    }
    if (!descripcion || descripcion.trim() === '') descripcion = 'Descripción no disponible';
    mappedItems.push({
      descripcion, cantidad: parseFloat(item.quantity) || 1,
      codigo_articulo: codigoArticulo,
      codigo_completo: prefijoCodigo ? `${prefijoCodigo}${codigoArticulo}` : codigoArticulo,
      es_montura: esMontura, es_cristal: esCristal, prefijo: prefijoCodigo
    });
  }
  return mappedItems;
}

async function fetchOrderItems(order) {
  let invoice = null;
  let issuedOrder = null;
  let items = [];
  if (order.issuedInvoiceId) {
    try {
      invoice = await gesvisionApi.getIssuedInvoice(order.issuedInvoiceId);
      if (invoice?.lineItems?.length) items = await mapLineItems(invoice.lineItems);
    } catch (err) {
      logger.error(`Error al obtener factura ${order.issuedInvoiceId}: ${err.message}`);
    }
  }
  if (items.length === 0 && order.issuedOrderId) {
    try {
      issuedOrder = await gesvisionApi.getIssuedOrder(order.issuedOrderId);
      if (issuedOrder?.lineItems?.length) items = await mapLineItems(issuedOrder.lineItems);
    } catch (err) {
      logger.error(`Error al obtener pedido ${order.issuedOrderId}: ${err.message}`);
    }
  }
  return { items, invoice, issuedOrder };
}

// ============================================================
// ✅ RESOLUCIÓN DEL ASESOR / RESPONSABLE DE LA VENTA (CORREGIDO)
// ============================================================
// ❌ Campos que NUNCA son asesores (aunque la regex los detecte)
const EXCLUDED_KEYS = new Set([
  'optometryExamId', 'customerId', 'warehouseId', 'issuedInvoiceId',
  'issuedOrderId', 'receivedOrderId', 'frameId', 'companyId',
  'id', 'productId', 'lineItems'
]);
// Regex estricta (sin 'user' ni 'optic/optom' para evitar falsos positivos)
const ASESOR_REGEX = /sell|sales|vended|asesor|advisor|employ|agent|attend|sold|vendor|worker|staff|created_?by|updated_?by/i;
// Campos prioritarios en orden de preferencia
const PRIORITY_KEYS = ['employee', 'seller', 'salesperson', 'createdBy'];

function extractPersonName(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return (
    [obj.name, obj.lastName].filter(Boolean).join(' ').trim() ||
    [obj.firstName, obj.lastName].filter(Boolean).join(' ').trim() ||
    obj.fullName || obj.username || obj.nombre || obj.nombreCompleto || null
  );
}

async function fetchAsesorNameById(id) {
  // ✅ Solo /employees funciona en tu GesVision
  // Mantengo /sellers y /users como fallback por si otras versiones lo usan
  const endpoints = [`/employees/${id}`, `/sellers/${id}`, `/users/${id}`];
  for (const endpoint of endpoints) {
    try {
      const data = await gesvisionApi.request('GET', endpoint);
      const name = extractPersonName(data);
      if (name) {
        logger.info(`👔 Asesor resuelto vía ${endpoint}: ${name}`);
        return name;
      }
    } catch (err) {
      // Endpoint no existe: probar el siguiente silenciosamente
    }
  }
  logger.warn(`⚠️ No se pudo resolver el nombre del asesor con ID ${id}`);
  return null;
}

/**
 * Intenta resolver un valor crudo a nombre de asesor.
 * Retorna el nombre si tiene éxito, o null si falla.
 */
async function tryResolveAsesor(raw) {
  if (!raw) return null;
  // 1) Objeto embebido
  if (typeof raw === 'object') {
    return extractPersonName(raw);
  }
  // 2) String no numérico → es el nombre directamente
  if (typeof raw === 'string' && raw.trim() && isNaN(Number(raw))) {
    return raw.trim();
  }
  // 3) ID numérico → consultar GesVision
  return await fetchAsesorNameById(raw);
}

/**
 * ✅ CORREGIDO: Busca el asesor en ORDEN → FACTURA → PEDIDO.
 * Si un candidato falla, CONTINÚA con la siguiente fuente.
 * Prioriza 'employee' que es el campo confirmado en tu GesVision.
 */
async function resolveAsesorNombre(order, invoice, issuedOrder) {
  const sources = [
    { label: 'ORDEN', doc: order },
    { label: 'FACTURA', doc: invoice },
    { label: 'PEDIDO', doc: issuedOrder },
  ];
  for (const { label, doc } of sources) {
    if (!doc || typeof doc !== 'object') continue;
    const keys = Object.keys(doc);
    // ✅ PASO 1: Buscar primero en campos prioritarios
    for (const priorityKey of PRIORITY_KEYS) {
      if (!keys.includes(priorityKey) || EXCLUDED_KEYS.has(priorityKey)) continue;
      const raw = doc[priorityKey];
      logger.info(`🔍 Campo prioritario en ${label}: ${priorityKey} = ${JSON.stringify(raw)}`);
      const name = await tryResolveAsesor(raw);
      if (name) return name;
    }
    // ✅ PASO 2: Buscar otros candidatos por regex
    const candidateKey = keys.find(
      (k) => !EXCLUDED_KEYS.has(k) && !PRIORITY_KEYS.includes(k) && ASESOR_REGEX.test(k)
    );
    if (!candidateKey) continue;
    const raw = doc[candidateKey];
    logger.info(`🔍 Campo candidato en ${label}: ${candidateKey} = ${JSON.stringify(raw)}`);
    const name = await tryResolveAsesor(raw);
    if (name) return name;
    // ✅ Si llegamos aquí, el candidato falló → CONTINUAR con la siguiente fuente
  }
  return null;
}

async function fetchAndMapOrder(searchIdentifier) {
  logger.info(`🔄 Iniciando mapeo de orden con identificador: ${searchIdentifier}`);
  let order = null;
  try {
    logger.info(`Intentando buscar por Número de Orden: ${searchIdentifier}`);
    order = await gesvisionApi.getGlassesOrderByNumber(searchIdentifier);
  } catch (searchErr) {
    logger.warn(`⚠️ No encontrada por Número de Orden: ${searchIdentifier}. Intentando por ID interno...`);
  }
  if (!order) {
    try {
      order = await gesvisionApi.getGlassesOrder(searchIdentifier);
    } catch (err) {
      throw new Error(`No se pudo encontrar la orden con ID o Número: ${searchIdentifier}. Verifica que exista en GesVision.`);
    }
  }
  if (!order) throw new Error(`Orden ${searchIdentifier} no encontrada`);

  const { items, invoice, issuedOrder } = await fetchOrderItems(order);

  let tipoLente = null;
  const rawLensType = order.opticalDataOD?.lensType || order.opticalDataOI?.lensType;
  if (rawLensType && LENS_TYPE_MAP[rawLensType]) {
    tipoLente = LENS_TYPE_MAP[rawLensType];
    logger.info(`🔬 Tipo de lente desde GesVision: ${rawLensType} → ${tipoLente}`);
  } else {
    tipoLente = inferTipoLenteFromItems(items);
    if (tipoLente) logger.info(`🔬 Tipo de lente inferido desde items: ${tipoLente}`);
  }
  if (!tipoLente) {
    tipoLente = 'NO_DEFINIDO';
    logger.warn(`⚠️ No se pudo determinar el tipo de lente para orden ${searchIdentifier}`);
  }

  const mapDP = (opticalData, pupillaryDistanceTotal) => {
    const dpCentro = opticalData?.distancePupilCenter;
    const dpCerca = opticalData?.nearPupilCenter;
    if ((!dpCentro && dpCentro !== 0) && (!dpCerca && dpCerca !== 0)) {
      return { unico: pupillaryDistanceTotal || null, centro: null, cerca: null };
    }
    return { unico: null, centro: dpCentro, cerca: dpCerca };
  };
  const dpOD = mapDP(order.opticalDataOD, order.pupillaryDistance);
  const dpOI = mapDP(order.opticalDataOI, order.pupillaryDistance);

  let clienteNombre = null;
  if (order.customerId) {
    try {
      const customer = await gesvisionApi.getCustomer(order.customerId);
      if (customer) clienteNombre = [customer.name, customer.lastName].filter(Boolean).join(' ').trim() || null;
    } catch (custErr) {
      logger.error(`Error al obtener cliente ${order.customerId}: ${custErr.message}`);
    }
  }

  let tiendaNombre = null;
  if (order.warehouseId) {
    try {
      logger.info(`📦 Obteniendo datos de la tienda/warehouse ID ${order.warehouseId}`);
      const warehouse = await gesvisionApi.getWarehouse(order.warehouseId);
      if (warehouse) {
        tiendaNombre = warehouse.name || null;
        logger.info(`✅ Tienda encontrada: ${tiendaNombre}`);
      }
    } catch (whErr) {
      logger.error(`Error al obtener warehouse ${order.warehouseId}: ${whErr.message}`);
    }
  }

  // ✅ NUEVO: Obtener el asesor/responsable (ORDEN → FACTURA → PEDIDO)
  let asesorNombre = null;
  try {
    asesorNombre = await resolveAsesorNombre(order, invoice, issuedOrder);
    if (asesorNombre) {
      logger.info(`👔 Asesor/responsable de la venta: ${asesorNombre}`);
    } else {
      logger.warn(`⚠️ No se pudo determinar el asesor de la orden ${searchIdentifier}`);
    }
  } catch (asesorErr) {
    logger.error(`Error al resolver asesor de la orden: ${asesorErr.message}`);
  }

  return {
    orden_gesvision_id: order.id,
    orden_numero: String(order.number),
    codigo_completo: order.code || null,
    serial: order.serial || null,
    referencia_interna: order.reference || null,
    fecha_emision_origen: order.date ? new Date(order.date).toISOString() : new Date().toISOString(),
    od_esfera: order.opticalDataOD?.sphere ?? 0,
    od_cilindro: order.opticalDataOD?.cylinder || null,
    od_eje: order.opticalDataOD?.axis || null,
    od_adicion: order.opticalDataOD?.addition || null,
    od_dp_unico: dpOD.unico, od_dp_centro: dpOD.centro, od_dp_cerca: dpOD.cerca,
    oi_esfera: order.opticalDataOI?.sphere ?? 0,
    oi_cilindro: order.opticalDataOI?.cylinder || null,
    oi_eje: order.opticalDataOI?.axis || null,
    oi_adicion: order.opticalDataOI?.addition || null,
    oi_dp_unico: dpOI.unico, oi_dp_centro: dpOI.centro, oi_dp_cerca: dpOI.cerca,
    pupillary_distance_total: order.pupillaryDistance || null,
    average_distance_total: order.averageDistance || null,
    tipo_lente: tipoLente,
    altura_od: getPupilHeight(order, 'OD'),
    altura_oi: getPupilHeight(order, 'OI'),
    montura_horizontal: order.horizontal || null,
    montura_vertical: order.vertical || null,
    montura_puente: order.bridge || null,
    montura_diametro_max: order.maxDiameter || null,
    cliente_trae_montura: order.customerOwnFrame || false,
    estado_gesvision: order.status || null,
    issued_invoice_id: order.issuedInvoiceId || null,
    issued_order_id: order.issuedOrderId || null,
    cliente_nombre: clienteNombre,
    asesor_nombre: asesorNombre,
    tienda_nombre: tiendaNombre,
    warehouse_id: order.warehouseId || null,
    items: items
  };
}

module.exports = { fetchAndMapOrder };