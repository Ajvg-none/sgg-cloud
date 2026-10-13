// backend/src/legacy/fetchAndMapOrder.js
const gesvisionApi = require('./gesvisionApi');
const { mapOpticalOrderV2ToV1 } = require('./opticalOrderV2Mapper');
const logger = require('../config/logger');

// ✅ Alineado con el sistema en producción.
// 'L': 'DE LEJOS', 'C': 'DE CERCA' (nunca "MONOFOCAL")
const LENS_TYPE_MAP = { 'L': 'DE LEJOS', 'C': 'DE CERCA', 'B': 'BIFOCAL', 'P': 'PROGRESIVO' };

const productCache = new Map();

/**
 * Intenta inferir el tipo de lente desde la descripción de los ítems.
 * NUNCA devuelve "MONOFOCAL": lo convierte a DE LEJOS / DE CERCA.
 * @param {Array<Object>} items - Ítems normalizados.
 * @returns {string|null}
 */
function inferTipoLenteFromItems(items) {
  if (!items || items.length === 0) return null;
  const texto = items.map(i => (i.descripcion || '').toLowerCase()).join(' ');
  if (texto.includes('progresivo') || texto.includes('pro ') || texto.includes('balance')) return 'PROGRESIVO';
  if (texto.includes('bifocal')) return 'BIFOCAL';
  if (texto.includes('monofocal') || texto.includes('single vision') ||
      texto.includes('de lejos') || texto.includes('de cerca')) {
    if (texto.includes('cerca')) return 'DE CERCA';
    return 'DE LEJOS';
  }
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

/**
 * Normaliza las líneas de una factura/pedido v2 (`InvoiceLineDocument` /
 * `OrderLineDocument`) al contrato interno de ítems.
 * @param {Array<Object>} lines - Arreglo `lines` del documento de venta v2.
 * @returns {Promise<Array<Object>>}
 */
async function mapLineItems(lines) {
  const mappedItems = [];
  for (const line of lines) {
    let descripcion = line.extendedDescription?.trim()
      || line.productDescription?.trim()
      || line.productName?.trim()
      || null;
    let codigoArticulo = null;
    let esMontura = false;
    let esCristal = false;
    let prefijoCodigo = '';
    const productId = line.productId ?? line.product;
    if (productId) {
      let productData = productCache.get(productId);
      if (!productData) {
        try {
          const product = await gesvisionApi.getProduct(productId);
          productData = {
            description: product.description || product.name || product.extendedDescription || null,
            reference: product.reference || null,
            barCode: product.barCode || null
          };
          productCache.set(productId, productData);
        } catch (err) {
          logger.error(`Error al obtener producto ${productId}: ${err.message}`);
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
      descripcion, cantidad: parseFloat(line.quantity) || 1,
      codigo_articulo: codigoArticulo,
      codigo_completo: prefijoCodigo ? `${prefijoCodigo}${codigoArticulo}` : codigoArticulo,
      es_montura: esMontura, es_cristal: esCristal, prefijo: prefijoCodigo
    });
  }
  return mappedItems;
}

/**
 * Obtiene los items de una orden v2: primero desde la factura de venta
 * (`sales-invoices/{id}.lines`), luego desde el pedido de venta
 * (`sales-orders/{id}.lines`).
 * @param {Object} order - Orden mapeada a forma v1.
 * @returns {Promise<Object>} { items }
 */
async function fetchOrderItems(order) {
  let items = [];
  if (order.issuedInvoiceId) {
    try {
      const invoice = await gesvisionApi.getSalesInvoice(order.issuedInvoiceId);
      if (invoice?.lines?.length) items = await mapLineItems(invoice.lines);
    } catch (err) {
      logger.error(`Error al obtener factura ${order.issuedInvoiceId}: ${err.message}`);
    }
  }
  if (items.length === 0 && order.issuedOrderId) {
    try {
      const salesOrder = await gesvisionApi.getSalesOrder(order.issuedOrderId);
      if (salesOrder?.lines?.length) items = await mapLineItems(salesOrder.lines);
    } catch (err) {
      logger.error(`Error al obtener pedido ${order.issuedOrderId}: ${err.message}`);
    }
  }
  return { items };
}

/**
 * Resuelve el identificador de búsqueda a un objeto de orden en forma v1.
 * Busca por número/código (lista v2) y luego trae el detalle (con graduación).
 * @param {string|number} searchIdentifier
 * @returns {Promise<Object>}
 */
async function resolveOrder(searchIdentifier) {
  let listItem = null;
  try {
    logger.info(`Intentando buscar por Número de Orden: ${searchIdentifier}`);
    listItem = await gesvisionApi.getOpticalOrderByNumber(searchIdentifier);
  } catch (searchErr) {
    logger.warn(`⚠️ No encontrada por Número de Orden: ${searchIdentifier}. Intentando por ID interno...`);
  }

  let detail = null;
  if (listItem && listItem.id !== undefined && listItem.id !== null) {
    detail = await gesvisionApi.getOpticalOrder(listItem.id);
  } else {
    try {
      detail = await gesvisionApi.getOpticalOrder(searchIdentifier);
    } catch (err) {
      throw new Error(`No se pudo encontrar la orden con ID o Número: ${searchIdentifier}. Verifica que exista en GesVision.`);
    }
  }
  if (!detail) throw new Error(`Orden ${searchIdentifier} no encontrada`);

  return mapOpticalOrderV2ToV1(detail, listItem);
}

async function fetchAndMapOrder(searchIdentifier) {
  logger.info(`🔄 Iniciando mapeo de orden con identificador: ${searchIdentifier}`);
  const order = await resolveOrder(searchIdentifier);

  const { items } = await fetchOrderItems(order);

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

  let clienteNombre = order.customerName || null;
  if (!clienteNombre && order.customerId) {
    try {
      const customer = await gesvisionApi.getCustomer(order.customerId);
      if (customer) clienteNombre = [customer.name, customer.lastName].filter(Boolean).join(' ').trim() || null;
    } catch (custErr) {
      logger.error(`Error al obtener cliente ${order.customerId}: ${custErr.message}`);
    }
  }

  // v2 entrega el nombre de la tienda en la propia orden (no existe /warehouses en v2).
  const tiendaNombre = order.warehouseName || null;

  // v2 no expone /employees ni un ID de asesor: el usuario creador es la única fuente.
  const asesorNombre = order.createdBy || null;
  if (asesorNombre) {
    logger.info(`👔 Asesor/responsable de la venta: ${asesorNombre}`);
  } else {
    logger.warn(`⚠️ No se pudo determinar el asesor de la orden ${searchIdentifier}`);
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
