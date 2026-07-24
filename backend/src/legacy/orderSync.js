const gesvisionApi = require('./gesvisionApi');
const logger = require('../config/logger');

// ⚠️ IMPORTACIÓN TEMPORAL: Se eliminará en Fase 3 al migrar a Prisma
const { Tienda, Laboratorio, OrdenTrabajo, OrdenItem, pool, productCache } = require('./legacyDependencies');

const LENS_TYPE_MAP = { 'L': 'DE LEJOS', 'C': 'DE CERCA', 'B': 'BIFOCAL', 'P': 'PROGRESIVO' };
const EXCLUDED_WAREHOUSE_IDS = (process.env.EXCLUDED_WAREHOUSE_IDS || '').split(',').map(Number).filter(n => !isNaN(n));

/**
 * Intenta inferir el tipo de lente desde la descripción de los ítems.
 * @param {Array<Object>} items - Ítems normalizados.
 * @returns {string}
 */
function inferTipoLenteFromItems(items) {
  if (!items || items.length === 0) return 'NO_DEFINIDO';
  const texto = items.map(i => i.descripcion.toLowerCase()).join(' ');
  if (texto.includes('progresivo') || texto.includes('pro ') || texto.includes('balance')) return 'PROGRESIVO';
  if (texto.includes('bifocal')) return 'BIFOCAL';
  if (texto.includes('monofocal')) return 'MONOFOCAL';
  return 'NO_DEFINIDO';
}

/**
 * Resuelve la altura pupilar desde múltiples fuentes porque GesVision no la expone de forma uniforme.
 * @param {Object} order - Orden origen.
 * @param {string} eye - OD u OI.
 * @returns {*}
 */
function getPupilHeight(order, eye) {
  const eyeKey = eye === 'OD' ? 'OD' : 'OI';
  const possibleRootFields = [`height${eyeKey}`, `pupilHeight${eyeKey}`, `verticalHeight${eyeKey}`, `eyeHeight${eyeKey}`, `pupillaryHeight${eyeKey}`, `alturaPupilar${eyeKey}`];
  for (const field of possibleRootFields) {
    if (order[field] !== undefined && order[field] !== null) {
      return order[field];
    }
  }
  const opticalData = order[`opticalData${eyeKey}`];
  if (opticalData) {
    const opticalFields = ['height', 'pupilHeight', 'verticalHeight', 'eyeHeight'];
    for (const field of opticalFields) {
      if (opticalData[field] !== undefined && opticalData[field] !== null) {
        return opticalData[field];
      }
    }
  }
  return null;
}

/**
 * Normaliza line items de GesVision para persistencia local e impresión.
 * @param {Array<Object>} lineItems - Ítems crudos de la API.
 * @returns {Promise<Array<Object>>}
 */
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
            barCode: product.barCode || null,
            category: product.category || null,
            brand: product.brand || null
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

    if (!descripcion || descripcion.trim() === '') {
      descripcion = 'Descripción no disponible';
      logger.warn(`⚠️ Ítem sin descripción (producto ${item.product || 'N/A'}). Usando fallback.`);
    }

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
      if (invoice.lineItems?.length) {
        logger.info(`Ítems obtenidos desde la factura issuedInvoiceId=${order.issuedInvoiceId}`);
        return await mapLineItems(invoice.lineItems);
      }
    } catch (err) {
      logger.error(`Error al obtener factura ${order.issuedInvoiceId}: ${err.message}`);
    }
  }
  if (order.issuedOrderId) {
    try {
      const issuedOrder = await gesvisionApi.getIssuedOrder(order.issuedOrderId);
      if (issuedOrder.lineItems?.length) {
        logger.info(`Ítems obtenidos desde el pedido issuedOrderId=${order.issuedOrderId}`);
        return await mapLineItems(issuedOrder.lineItems);
      }
    } catch (err) {
      logger.error(`Error al obtener pedido ${order.issuedOrderId}: ${err.message}`);
    }
  }
  return [];
}

/**
 * Sincroniza una orden externa de GesVision hacia el modelo local y sus colas derivadas.
 * @param {number|string} gesvisionOrderId - Identificador externo.
 * @returns {Promise<Object>}
 */
async function syncOrder(gesvisionOrderId) {
  logger.info(`🔄 Iniciando sincronización de orden ${gesvisionOrderId}`);
  const order = await gesvisionApi.getGlassesOrder(gesvisionOrderId);
  if (!order) throw new Error(`Orden ${gesvisionOrderId} no encontrada`);

  // ✅ orderFromSupplier es el indicador correcto de "Fabricación Planificada"
  const tieneFP = order.orderFromSupplier === true;
  const estadoPlanificacion = tieneFP ? 'PLANIFICADA' : 'ESPERANDO_PLANIFICACION';

  if (!tieneFP) {
    logger.info(`⏸️ Orden ${gesvisionOrderId} sin Fabricación Planificada (orderFromSupplier=false)`);
  }

  const odSphere = order.opticalDataOD?.sphere ?? 0;
  const oiSphere = order.opticalDataOI?.sphere ?? 0;
  let tipoLente = 'NO_DEFINIDO';
  const rawLensType = order.opticalDataOD?.lensType || order.opticalDataOI?.lensType;
  if (rawLensType && LENS_TYPE_MAP[rawLensType]) tipoLente = LENS_TYPE_MAP[rawLensType];

  if (EXCLUDED_WAREHOUSE_IDS.includes(order.warehouseId)) {
    throw new Error(`Orden ${gesvisionOrderId} pertenece a tienda excluida (ID ${order.warehouseId})`);
  }

  let tienda = await Tienda.findById(order.warehouseId);
  if (!tienda) {
    const warehouse = await gesvisionApi.getWarehouse(order.warehouseId);
    tienda = await Tienda.create(warehouse.id, warehouse.name);
    logger.info(`Tienda ${tienda.id} creada/actualizada`);
  }

  if (!tienda.laboratorio_asignado_id) {
    throw new Error(`La tienda ${tienda.nombre} (ID ${tienda.id}) no tiene laboratorio asignado`);
  }

  const laboratorio = await Laboratorio.findById(tienda.laboratorio_asignado_id);
  if (!laboratorio) throw new Error(`Laboratorio ${tienda.laboratorio_asignado_id} no encontrado o inactivo`);

  // La máquina de estados local solo avanza a PENDIENTE cuando la FP está activada.
  let estadoImpresion;
  if (!laboratorio.impresion_activa) {
    estadoImpresion = 'PAUSADO';
    logger.info(`⏸️ Orden ${gesvisionOrderId} → PAUSADO`);
  } else if (!tieneFP) {
    estadoImpresion = 'ESPERANDO_FABRICACION';
    logger.info(`⏳ Orden ${gesvisionOrderId} → ESPERANDO_FABRICACION (orderFromSupplier=false)`);
  } else {
    estadoImpresion = 'PENDIENTE';
    logger.info(`✅ Orden ${gesvisionOrderId} → PENDIENTE (orderFromSupplier=true)`);
  }

  let items = await fetchOrderItems(order);
  if (tipoLente === 'NO_DEFINIDO' && items.length) tipoLente = inferTipoLenteFromItems(items);

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
  const alturaOD = getPupilHeight(order, 'OD');
  const alturaOI = getPupilHeight(order, 'OI');

  const ordenData = {
    orden_gesvision_id: order.id,
    orden_numero: String(order.number),
    codigo_completo: order.code || null,
    serial: order.serial || null,
    referencia_interna: order.reference || null,
    tienda_id: tienda.id,
    laboratorio_id: laboratorio.id,
    fecha_emision_origen: order.date ? new Date(order.date) : new Date(),
    od_esfera: odSphere,
    od_cilindro: order.opticalDataOD?.cylinder || null,
    od_eje: order.opticalDataOD?.axis || null,
    od_adicion: order.opticalDataOD?.addition || null,
    od_dp_unico: dpOD.unico, od_dp_centro: dpOD.centro, od_dp_cerca: dpOD.cerca,
    oi_esfera: oiSphere,
    oi_cilindro: order.opticalDataOI?.cylinder || null,
    oi_eje: order.opticalDataOI?.axis || null,
    oi_adicion: order.opticalDataOI?.addition || null,
    oi_dp_unico: dpOI.unico, oi_dp_centro: dpOI.centro, oi_dp_cerca: dpOI.cerca,
    pupillary_distance_total: order.pupillaryDistance || null,
    average_distance_total: order.averageDistance || null,
    tipo_lente: tipoLente,
    altura_od: alturaOD, altura_oi: alturaOI,
    montura_horizontal: order.horizontal || null,
    montura_vertical: order.vertical || null,
    montura_puente: order.bridge || null,
    montura_diametro_max: order.maxDiameter || null,
    cliente_trae_montura: order.customerOwnFrame || false,
    estado_gesvision: order.status || null,
    issued_invoice_id: order.issuedInvoiceId || null,
    issued_order_id: order.issuedOrderId || null,
    estado_planificacion: estadoPlanificacion,
    estado_impresion: estadoImpresion,
    cliente_nombre: null,
    guia_envio_id: null,
    fecha_guia: null
  };

  // Sincronizar el nombre del cliente
  if (order.customerId) {
    try {
      logger.info(`👤 Obteniendo datos del cliente ID ${order.customerId} para la orden ${gesvisionOrderId}`);
      const customer = await gesvisionApi.getCustomer(order.customerId);
      if (customer) {
        const nombreCompleto = [customer.name, customer.lastName].filter(Boolean).join(' ').trim();
        ordenData.cliente_nombre = nombreCompleto || null;
      }
    } catch (custErr) {
      logger.error(`Error al obtener cliente ${order.customerId} de GesVision: ${custErr.message}`);
    }
  }

  // v9.0: TRANSACCIÓN ATÓMICA que abarca orden + items
  // Esto previene duplicados por concurrencia entre scheduler y checkWaitingOrders
  const client = await pool.connect();
  let saved;
  
  try {
    await client.query('BEGIN');
    
    // v9.0: Lock sobre la orden para evitar carreras
    // Si la orden ya existe, la bloqueamos; si no, el INSERT la creará
    const existingOrder = await client.query(
      'SELECT id FROM ordenes_trabajo WHERE orden_gesvision_id = $1 FOR UPDATE',
      [gesvisionOrderId]
    );
    
    // v9.0: Upsert usando el client de transacción
    saved = await OrdenTrabajo.upsert(ordenData, client);
    logger.info(`Orden ${gesvisionOrderId} guardada con ID interno ${saved.id}`);
    
    // v9.0: Items dentro de la misma transacción
    if (items.length) {
      await OrdenItem.createMany(client, saved.id, items);
      logger.info(`${items.length} ítems guardados (transacción atómica)`);
    }
    
    await client.query('COMMIT');
    logger.info(`✅ Transacción completada para orden ${gesvisionOrderId}`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error(`❌ Error en transacción de orden ${gesvisionOrderId}: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
  
  logger.info(`✅ Sincronización en BD completada para orden ${saved.id}. El pipeline de producción se encargará del VCA e impresión.`);

  return { ...saved, items };
}


module.exports = { syncOrder };