// backend/src/legacy/fetchAndMapOrder.js
const gesvisionApi = require('./gesvisionApi');
const logger = require('../config/logger');

// ✅ CORREGIDO: Mapa ampliado de tipos de lente
const LENS_TYPE_MAP = {
  'L': 'MONOFOCAL LEJOS',
  'C': 'MONOFOCAL CERCA',
  'B': 'BIFOCAL',
  'P': 'PROGRESIVO',
  'M': 'MULTIFOCAL',
  'S': 'SINGLE VISION',
  'O': 'OCUPACIONAL',
  'T': 'TRIFOCAL',
};

const productCache = new Map();

// ✅ CORREGIDO: Ahora devuelve null si no puede inferir el tipo
function inferTipoLenteFromItems(items) {
  if (!items || items.length === 0) return null;
  
  const texto = items.map(i => (i.descripcion || '').toLowerCase()).join(' ');
  
  // Orden de prioridad (de más específico a más general)
  if (texto.includes('progresivo') || texto.includes('progressive') || 
      texto.includes('varilux') || texto.includes('balance') || 
      texto.includes('pro ') || texto.includes('multifocal')) {
    return 'PROGRESIVO';
  }
  if (texto.includes('bifocal') || texto.includes('bifocales')) {
    return 'BIFOCAL';
  }
  if (texto.includes('trifocal')) {
    return 'TRIFOCAL';
  }
  if (texto.includes('ocupacional') || texto.includes('office') || 
      texto.includes('de office') || texto.includes('intermedia')) {
    return 'OCUPACIONAL';
  }
  if (texto.includes('monofocal') || texto.includes('single vision') || 
      texto.includes('single-vision') || texto.includes('de lejos') || 
      texto.includes('de cerca')) {
    return 'MONOFOCAL';
  }
  
  return null; // ← null en vez de 'NO_DEFINIDO'
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
          esMontura = true;
          prefijoCodigo = 'M';
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
      descripcion,
      cantidad: parseFloat(item.quantity) || 1,
      codigo_articulo: codigoArticulo,
      codigo_completo: prefijoCodigo ? `${prefijoCodigo}${codigoArticulo}` : codigoArticulo,
      es_montura: esMontura,
      es_cristal: esCristal,
      prefijo: prefijoCodigo
    });
  }
  
  return mappedItems;
}

async function fetchOrderItems(order) {
  if (order.issuedInvoiceId) {
    try {
      const invoice = await gesvisionApi.getIssuedInvoice(order.issuedInvoiceId);
      if (invoice.lineItems?.length) return await mapLineItems(invoice.lineItems);
    } catch (err) {
      logger.error(`Error al obtener factura ${order.issuedInvoiceId}: ${err.message}`);
    }
  }
  
  if (order.issuedOrderId) {
    try {
      const issuedOrder = await gesvisionApi.getIssuedOrder(order.issuedOrderId);
      if (issuedOrder.lineItems?.length) return await mapLineItems(issuedOrder.lineItems);
    } catch (err) {
      logger.error(`Error al obtener pedido ${order.issuedOrderId}: ${err.message}`);
    }
  }
  
  return [];
}

/**
* Función PURA que obtiene y mapea una orden de GesVision.
* Ahora es inteligente: intenta por ID, y si falla (404), intenta por Número de Orden.
*/
async function fetchAndMapOrder(searchIdentifier) {
  logger.info(`🔄 Iniciando mapeo de orden con identificador: ${searchIdentifier}`);
  
  let order = null;
  
  // 1. Intentar buscar primero por Número de Orden / Código exacto
  try {
    logger.info(`Intentando buscar por Número de Orden: ${searchIdentifier}`);
    order = await gesvisionApi.getGlassesOrderByNumber(searchIdentifier);
  } catch (searchErr) {
    logger.warn(`⚠️ No encontrada por Número de Orden: ${searchIdentifier}. Intentando por ID interno...`);
  }
  
  // 2. Si no se encontró por número, intentar buscar por ID interno
  if (!order) {
    try {
      order = await gesvisionApi.getGlassesOrder(searchIdentifier);
    } catch (err) {
      throw new Error(`No se pudo encontrar la orden con ID o Número: ${searchIdentifier}. Verifica que exista en GesVision.`);
    }
  }
  
  if (!order) throw new Error(`Orden ${searchIdentifier} no encontrada`);
  
  const items = await fetchOrderItems(order);
  
  // ✅ CORREGIDO: Primero intentar lensType de GesVision, luego inferir de items
  let tipoLente = null;
  const rawLensType = order.opticalDataOD?.lensType || order.opticalDataOI?.lensType;
  
  if (rawLensType && LENS_TYPE_MAP[rawLensType]) {
    tipoLente = LENS_TYPE_MAP[rawLensType];
    logger.info(`🔬 Tipo de lente desde GesVision: ${rawLensType} → ${tipoLente}`);
  } else {
    tipoLente = inferTipoLenteFromItems(items);
    if (tipoLente) {
      logger.info(`🔬 Tipo de lente inferido desde items: ${tipoLente}`);
    }
  }
  
  // Fallback final
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
  
  // ✅ NUEVO: Obtener nombre de la tienda/warehouse
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
    tienda_nombre: tiendaNombre,
    warehouse_id: order.warehouseId || null,
    items: items
  };
}

module.exports = { fetchAndMapOrder };