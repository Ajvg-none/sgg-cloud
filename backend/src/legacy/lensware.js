const fs = require('fs').promises;
const path = require('path');
const logger = require('../config/logger');

// ⚠️ IMPORTACIÓN TEMPORAL: Se eliminará en Fase 3 al migrar a Prisma
const { Tienda } = require('./legacyDependencies');

const BASE_VCA_FOLDER = process.env.LENSWARE_BASE_FOLDER || path.join(process.cwd(), 'vca_files');

/**
 * Normaliza valores numéricos al formato fijo requerido por VCA.
 * @param {*} value - Valor de entrada.
 * @param {number} decimals - Cantidad de decimales.
 * @returns {string}
 */
function formatVCAValue(value, decimals = 2) {
  if (value === null || value === undefined) return '0.00';
  const num = parseFloat(value);
  if (isNaN(num)) return '0.00';
  return num.toFixed(decimals);
}

/**
 * Elimina separadores para preservar el código de artículo exacto en Lensware.
 * @param {string} code - Código original.
 * @returns {string}
 */
function cleanArticleCode(code) {
  if (!code) return '000000';
  return String(code).trim().replace(/\s+/g, '');
}

/**
 * Construye el contenido VCA usando datos de la orden, ACCN activo y line items.
 * @param {Object} order - Orden interna normalizada.
 * @param {Array<Object>} items - Ítems asociados.
 * @returns {Promise<string>} Contenido del archivo VCA.
 */
async function generateVCAContent(order, items) {
  const DO = 'B';
  
  const tiendaId = order.tienda_id;
  let ACCN;
  if (tiendaCache[tiendaId]) {
    ACCN = tiendaCache[tiendaId];
  } else {
    // El ACCN se cachea por tienda para evitar repetir una consulta en cada archivo VCA.
    ACCN = await Tienda.getAccnByTiendaId(tiendaId) || '000';
    tiendaCache[tiendaId] = ACCN;
  }
  if (ACCN === '000') {
    logger.warn(`⚠️ Tienda ${tiendaId} sin código ACCN en BD`);
  }
  
  const _COMMENT = order.codigo_completo || order.orden_numero || '';
  
  const CLIENT = order.tienda_nombre ? `${ACCN} ${order.tienda_nombre}` : 'PACIENTE';

  let FRAM = 'PENDIENTE';
  let LNAM_OD = 'PENDIENTE';
  let LNAM_OI = 'PENDIENTE';
  
  if (items && items.length > 0) {
    for (const item of items) {
      const codigo = cleanArticleCode(item.codigo_articulo);
      if (!codigo || codigo === '000000') continue;
      
      const primeraLetra = codigo.charAt(0).toUpperCase();
      
      if (primeraLetra === 'M' && FRAM === 'PENDIENTE') {
        FRAM = codigo;
        logger.info(`🕶️ Montura detectada: ${codigo}`);
      }
      
      else if (['A', 'B', 'H', 'C'].includes(primeraLetra) && LNAM_OD === 'PENDIENTE') {
        LNAM_OD = codigo;
        LNAM_OI = codigo;
        logger.info(`🔬 Cristal detectado: ${codigo} (tipo: ${primeraLetra})`);
      }
    }
    
    if (FRAM === 'PENDIENTE') {
      // Fallback por descripción porque algunos catálogos no traen un prefijo estable.
      const monturaItem = items.find(item => {
        const desc = (item.descripcion || '').toLowerCase();
        return desc.includes('montura') || desc.includes('armazon') || desc.includes('armazón');
      });
      if (monturaItem && monturaItem.codigo_articulo) {
        FRAM = cleanArticleCode(monturaItem.codigo_articulo);
      }
    }
    
    if (LNAM_OD === 'PENDIENTE') {
      const cristalItem = items.find(item => {
        const desc = (item.descripcion || '').toLowerCase();
        return (desc.includes('cristal') || desc.includes('lente') ||
                desc.includes('progresivo') || desc.includes('bifocal') ||
                desc.includes('varilux') || desc.includes('essilor') ||
                desc.includes('hi-in') || desc.includes('hi in') ||
                desc.includes('balance') || desc.includes('pro ')) &&
               !desc.includes('montura') && !desc.includes('armazon');
      });
      if (cristalItem && cristalItem.codigo_articulo) {
        LNAM_OD = cleanArticleCode(cristalItem.codigo_articulo);
        LNAM_OI = LNAM_OD;
      }
    }
  }
  
  const LNAM = `${LNAM_OD};${LNAM_OI}`;

  const SPH = `${formatVCAValue(order.od_esfera)};${formatVCAValue(order.oi_esfera)}`;
  const CYL = `${formatVCAValue(order.od_cilindro)};${formatVCAValue(order.oi_cilindro)}`;
  const AX = `${formatVCAValue(order.od_eje, 0)};${formatVCAValue(order.oi_eje, 0)}`;
  const ADD = `${formatVCAValue(order.od_adicion)};${formatVCAValue(order.oi_adicion)}`;
  
  const NPD = `${formatVCAValue(order.od_dp_centro)};${formatVCAValue(order.oi_dp_centro)}`;
  const IPD = `${formatVCAValue(order.od_dp_cerca)};${formatVCAValue(order.oi_dp_cerca)}`;
  
  const DBL = formatVCAValue(order.montura_puente);
  const SEGHT = `${formatVCAValue(order.altura_od)};${formatVCAValue(order.altura_oi)}`;
  
  const _RECTYPE = 'E';

  const lines = [
    `DO=${DO}`,
    `ACCN=${ACCN}`,
    `_COMMENT=${_COMMENT}`,
    `CLIENT=${CLIENT}`,
    `LNAM=${LNAM}`,
    `SPH=${SPH}`,
    `CYL=${CYL}`,
    `AX=${AX}`,
    `ADD=${ADD}`,
    `NPD=${NPD}`,
    `IPD=${IPD}`,
    `DBL=${DBL}`,
    `SEGHT=${SEGHT}`,
    `FRAM=${FRAM}`,
    `_RECTYPE=${_RECTYPE}`
  ];
  
  return lines.join('\r\n');
}

/**
 * Persiste un archivo VCA en la carpeta destino y devuelve su metadato.
 * @param {Object} order - Orden interna.
 * @param {Array<Object>} items - Ítems asociados.
 * @param {string|null} carpetaRelativa - Carpeta opcional dentro del root Lensware.
 * @returns {Promise<Object>}
 */
async function saveVCAFile(order, items, carpetaRelativa = null) {
  const targetFolder = carpetaRelativa
    ? (path.isAbsolute(carpetaRelativa) ? carpetaRelativa : path.join(BASE_VCA_FOLDER, carpetaRelativa))
    : BASE_VCA_FOLDER;
  
  try {
    await fs.mkdir(targetFolder, { recursive: true });
    
    // Nombre de archivo determinista con nomenclatura personalizada
    const filename = `Pedido_${order.orden_numero}_${order.tienda_id}.vca`;
    const filepath = path.join(targetFolder, filename);

    // Verificar si el archivo ya existe
    try {
      await fs.access(filepath);
      logger.info(`✨ Archivo VCA ya existe (idempotencia): ${filepath}`);
      return {
        success: true,
        filepath,
        filename,
        folder: targetFolder,
        alreadyExisted: true
      };
    } catch (accessErr) {
      // Si no existe, procedemos a escribirlo
    }

    const vcaContent = await generateVCAContent(order, items);
    await fs.writeFile(filepath, vcaContent, 'utf8');
    
    logger.info(`✅ Archivo VCA generado: ${filepath}`);
    logger.debug(`Contenido VCA:\n${vcaContent}`);
    
    return {
      success: true,
      filepath,
      filename,
      folder: targetFolder
    };
  } catch (err) {
    logger.error(`❌ Error generando archivo VCA: ${err.message}`);
    throw new Error(`Error generando VCA: ${err.message}`);
  }
}

/**
 * Genera y guarda el archivo VCA para una orden dada.
 * @param {Object} order - Orden interna.
 * @param {Array<Object>} items - Ítems asociados.
 * @param {string|null} carpeta_lensware - Carpeta destino específica.
 * @returns {Promise<Object>}
 */
async function generateAndSaveVCA(order, items, carpeta_lensware = null) {
  logger.info(`🔍 Generando archivo VCA para orden ${order.orden_numero}`);
  logger.info(`📦 Items recibidos: ${items ? items.length : 0}`);
  
  try {
    const result = await saveVCAFile(order, items, carpeta_lensware);
    logger.info(`✅ VCA generado exitosamente para orden ${order.id}`);
    return result;
  } catch (err) {
    logger.error(`❌ Error en generateAndSaveVCA para orden ${order.id}: ${err.message}`);
    throw err;
  }
}

/**
 * Verifica prefijos de código usados por la heurística de clasificación.
 * @param {string} code - Código de artículo.
 * @param {string} expectedPrefix - Prefijo esperado.
 * @returns {boolean}
 */
function validateCodePrefix(code, expectedPrefix) {
  if (!code) return false;
  return code.startsWith(expectedPrefix);
}

/**
 * Convierte el contenido VCA a un objeto simple para pruebas y diagnósticos.
 * @param {string} vcaContent - Texto del archivo VCA.
 * @returns {Object}
 */
function parseVCAContent(vcaContent) {
  const lines = vcaContent.split('\r\n');
  const data = {};
  lines.forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      data[key.trim()] = value.trim();
    }
  });
  return data;
}

module.exports = {
  generateAndSaveVCA,
  generateVCAContent,
  saveVCAFile,
  cleanArticleCode,
  validateCodePrefix,
  parseVCAContent
};