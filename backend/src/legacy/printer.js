const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const escpos = require('escpos');
const logger = require('../config/logger');

const AGENT_API_KEY = process.env.AGENT_API_KEY;
const DEFAULT_AGENT_URL = process.env.AGENT_URL;
const TICKET_FORMAT = process.env.TICKET_FORMAT || 'bin';
const FALLBACK_FOLDER = process.env.TICKET_OUTPUT_FOLDER || path.join(process.cwd(), 'tickets');

const LINE_WIDTH = 39;
/**
 * Alinea texto a la derecha para impresión de ancho fijo.
 * @param {string} str - Texto de entrada.
 * @param {number} width - Ancho objetivo.
 * @returns {string}
 */
function padRight(str, width) { return String(str).padEnd(width, ' '); }
/**
 * Alinea texto a la izquierda para impresión de ancho fijo.
 * @param {string} str - Texto de entrada.
 * @param {number} width - Ancho objetivo.
 * @returns {string}
 */
function padLeft(str, width) { return String(str).padStart(width, ' '); }
/**
 * Parte texto largo en líneas ajustadas al ancho máximo del ticket.
 * @param {string} text - Texto original.
 * @param {number} maxLength - Longitud máxima por línea.
 * @returns {Array<string>}
 */
function wrapText(text, maxLength) {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';
  words.forEach(word => {
    if (!word) return;
    if ((currentLine + (currentLine ? ' ' : '') + word).length <= maxLength) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      let remainingWord = word;
      while (remainingWord.length > maxLength) {
        lines.push(remainingWord.substring(0, maxLength));
        remainingWord = remainingWord.substring(maxLength);
      }
      currentLine = remainingWord;
    }
  });
  if (currentLine) lines.push(currentLine);
  return lines;
}
/**
 * Normaliza una esfera/cilindro a formato de ticket.
 * @param {*} value - Valor numérico o textual.
 * @returns {string}
 */
function formatEsfCil(value) {
  if (value === null || value === undefined) return '      ';
  const num = parseFloat(value);
  if (isNaN(num)) return '      ';
  const sign = num >= 0 ? '+' : '';
  return padLeft(`${sign}${num.toFixed(2)}`, 6);
}
/**
 * Normaliza campos enteros del ticket con padding fijo.
 * @param {*} value - Valor de entrada.
 * @param {number} width - Ancho objetivo.
 * @returns {string}
 */
function formatInt(value, width) {
  if (value === null || value === undefined) return padLeft('', width);
  const num = parseInt(value);
  if (isNaN(num)) return padLeft('', width);
  return padLeft(num.toString(), width);
}
/**
 * Normaliza distancias pupilares con ancho fijo.
 * @param {*} value - Valor de entrada.
 * @returns {string}
 */
function formatDP(value) {
  if (value === null || value === undefined) return '    ';
  const num = parseFloat(value);
  if (isNaN(num)) return '    ';
  const str = num % 1 === 0 ? `${num}. ` : `${num}`;
  return padRight(str, 4);
}

/**
 * Renderiza el ticket de impresión en texto plano.
 * @param {Object} order - Orden con datos ópticos y de montura.
 * @param {Array<Object>} items - Ítems asociados.
 * @returns {string}
 */
function generateTicketText(order, items) {
  const codigoCompleto = order.codigo_completo || '';
  const sucursal = codigoCompleto.substring(0, 4) || '';
  const accnCode = order.accn || '000';
  const clienteNombre = order.tienda_nombre || '';
  const cliente = clienteNombre ? `${accnCode} ${clienteNombre}` : `${accnCode}`;
  const fechaImpresion = new Date().toLocaleString('es-ES', {
    day: 'numeric', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).replace(',', '');
  const odEsf = formatEsfCil(order.od_esfera);
  const odCil = formatEsfCil(order.od_cilindro);
  const odEje = formatInt(order.od_eje, 3);
  const odAdd = formatEsfCil(order.od_adicion);
  const odDp = formatDP(order.od_dp_cerca ?? order.od_dp_centro);
  const oiEsf = formatEsfCil(order.oi_esfera);
  const oiCil = formatEsfCil(order.oi_cilindro);
  const oiEje = formatInt(order.oi_eje, 3);
  const oiAdd = formatEsfCil(order.oi_adicion);
  const oiDp = formatDP(order.oi_dp_cerca ?? order.oi_dp_centro);
  const tipoLente = order.tipo_lente || '';
  const alturaOD = order.altura_od !== null ? String(order.altura_od) : '-';
  const alturaOI = order.altura_oi !== null ? String(order.altura_oi) : '-';
  const horizontal = order.montura_horizontal || '-';
  const vertical   = order.montura_vertical   || '-';
  const puente     = order.montura_puente     || '-';
  const diametro   = order.montura_diametro_max || '-';
  const sep = '---------------------------------------';
  const tableSep = '  +------+------+---+------+----+';
  const allLines = [];
  allLines.push('OPTI-COLOR #2, C.A.');
  const ordText = `Orden: ${codigoCompleto} | Suc: ${sucursal}`;
  const ordLines = wrapText(ordText, LINE_WIDTH);
  ordLines.forEach(l => allLines.push(l));
  const clienteLines = wrapText(`Cliente: ${cliente}`, LINE_WIDTH);
  clienteLines.forEach(l => allLines.push(l));
  allLines.push(`Fecha Impresion: ${fechaImpresion}`);
  allLines.push('');
  allLines.push('    Esf    Cil   Eje  Add   DP');
  allLines.push(tableSep);
  allLines.push(`OD|${odEsf}|${odCil}|${odEje}|${odAdd}|${odDp}|`);
  allLines.push(tableSep);
  allLines.push(`OI|${oiEsf}|${oiCil}|${oiEje}|${oiAdd}|${oiDp}|`);
  allLines.push(tableSep);
  allLines.push('');
  allLines.push('Detalles de Vision :');
  const lensWrapWidth = 22;
  const lenteLines = wrapText(tipoLente, lensWrapWidth);
  const firstLente = lenteLines[0] || '';
  allLines.push(`OD: ${padRight(firstLente, lensWrapWidth)} | Alt: ${alturaOD}`);
  allLines.push(`OI: ${padRight(firstLente, lensWrapWidth)} | Alt: ${alturaOI}`);
  for (let i = 1; i < lenteLines.length; i++) {
    allLines.push(`    ${lenteLines[i]}`);
  }
  allLines.push('');
  allLines.push('Medidas de Montura :');
  allLines.push(`H:${horizontal} V:${vertical} P:${puente} Max:${diametro}`);
  allLines.push('');
  allLines.push('            REQUERIMIENTOS');
  allLines.push(sep);
  items.forEach(item => {
    const cantidad = parseFloat(item.cantidad).toFixed(2);
    const descLines = wrapText(item.descripcion, 28);
    const firstLineDesc = descLines[0] || '';
    const firstLineQty = padLeft(cantidad, 5);
    allLines.push(`${padRight(firstLineDesc, 28)} ${firstLineQty}`);
    for (let i = 1; i < descLines.length; i++) {
      allLines.push(padRight(descLines[i], 28));
    }
  });
  return allLines.join('\n');
}

/**
 * Convierte el ticket textual a buffer ESC/POS para impresoras compatibles.
 * @param {Object} order - Orden con datos de impresión.
 * @param {Array<Object>} items - Ítems asociados.
 * @returns {Promise<Buffer>}
 */
async function generateEscPosBuffer(order, items) {
  return new Promise((resolve, reject) => {
    let dataBuffer = Buffer.alloc(0);
    const device = {
      write: (data, cb) => {
        dataBuffer = Buffer.concat([dataBuffer, data]);
        if (cb) cb(null);
      },
      close: (cb) => { if (cb) cb(null); }
    };
    const printer = new escpos.Printer(device);
    try {
      const ticketText = generateTicketText(order, items);
      if (!ticketText || ticketText.trim().length === 0) {
        throw new Error('El ticket generado está vacío');
      }
      printer.size(0, 0);
      printer.font('A');
      const lines = ticketText.split('\n');
      lines.forEach((line, idx) => {
        if (idx === 0) printer.align('CT');
        else printer.align('LT');
        if (line.trim() === '') printer.text('');
        else printer.text(line);
      });
      if (order.codigo_completo) {
        printer.feed(2);
        printer.align('CT');
        printer.barcode(order.codigo_completo, 'CODE39', {
          width: 1, height: 50, position: 'OFF'
        });
        const formattedCode = '* ' + order.codigo_completo.split('').join(' ') + ' *';
        printer.text(formattedCode);
        logger.info(`Código de barras generado en CODE39 para: ${order.codigo_completo}`);
      }
      printer.feed(3);
      printer.text('--------------------------------');
      printer.feed(2);
      printer.cut(true);
      printer.close(() => resolve(Buffer.from(dataBuffer)));
    } catch (err) {
      logger.error(`Error generando buffer ESC/POS: ${err.message}`);
      reject(err);
    }
  });
}

/**
 * Construye la URL del agente usando IP/puerto del laboratorio o el fallback global.
 * @param {Object} order - Orden con metadatos de laboratorio.
 * @returns {string|null}
 */
function buildAgentUrl(order) {
  if (order.ip_ticketera && order.puerto_ticketera) {
    return `http://${order.ip_ticketera}:${order.puerto_ticketera}`;
  }
  if (DEFAULT_AGENT_URL) {
    logger.warn(`Laboratorio sin IP configurada, usando AGENT_URL del .env: ${DEFAULT_AGENT_URL}`);
    return DEFAULT_AGENT_URL;
  }
  return null;
}

/**
 * Envía el ticket al agente HTTP cuando existe una ruta de red disponible.
 * @param {Object} order - Orden a imprimir.
 * @param {Array<Object>} items - Ítems asociados.
 * @param {string} agentUrl - URL del agente.
 * @returns {Promise<Object>}
 */
async function sendTicketToAgent(order, items, agentUrl) {
  if (!agentUrl) throw new Error('URL del agente no definida para este laboratorio');
  if (!AGENT_API_KEY) throw new Error('AGENT_API_KEY no definido en .env');

  logger.info(`Generando ticket para orden ${order.id}...`);
  let ticketBuffer;
  if (TICKET_FORMAT === 'bin') {
    ticketBuffer = await generateEscPosBuffer(order, items);
  } else {
    const text = generateTicketText(order, items);
    ticketBuffer = Buffer.from(text, 'utf8');
  }

  logger.info(`Buffer generado (${ticketBuffer.length} bytes). Enviando al agente ${agentUrl}...`);
  const payload = {
    orderId: order.id,
    ticket: ticketBuffer.toString('base64'),
    format: TICKET_FORMAT
  };

  try {
    const response = await axios.post(`${agentUrl}/api/print`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AGENT_API_KEY
      },
      timeout: 15000
    });
    logger.info(`Ticket enviado al agente (${agentUrl}) para orden ${order.id}. Job ID: ${response.data.jobId}`);
    return { method: 'agent', result: response.data };
  } catch (err) {
    logger.error(`Error enviando ticket al agente ${agentUrl}: ${err.message}`);
    throw new Error(`Error de comunicación con agente: ${err.message}`);
  }
}

/**
 * Persiste el ticket como archivo binario cuando el agente no está disponible.
 * @param {Object} order - Orden a imprimir.
 * @param {Array<Object>} items - Ítems asociados.
 * @param {string|null} folder - Carpeta destino opcional.
 * @returns {Promise<Object>}
 */
async function saveTicketToFolder(order, items, folder) {
  const targetFolder = folder || FALLBACK_FOLDER;
  await fs.mkdir(targetFolder, { recursive: true });
  
  const ext = TICKET_FORMAT === 'bin' ? 'bin' : 'txt';
  const filename = `Pedido_${order.orden_numero}_${order.tienda_id}.${ext}`;
  const filepath = path.join(targetFolder, filename);

  try {
    await fs.access(filepath);
    logger.info(`✨ Archivo de ticket ya existe (idempotencia): ${filepath}`);
    return { method: 'file', filepath, alreadyExisted: true };
  } catch (accessErr) {
    // Si no existe, procedemos a escribirlo
  }

  let buffer;
  if (TICKET_FORMAT === 'bin') {
    buffer = await generateEscPosBuffer(order, items);
  } else {
    const text = generateTicketText(order, items);
    buffer = Buffer.from(text, 'utf8');
  }

  await fs.writeFile(filepath, buffer);
  logger.info(`Ticket guardado en ${filepath} (${buffer.length} bytes)`);
  return { method: 'file', filepath };
}

/**
 * Coordina el envío al agente y el fallback a archivo local cuando falla la red.
 * @param {Object} order - Orden a imprimir.
 * @param {Array<Object>} items - Ítems asociados.
 * @param {string|null} folder - Carpeta destino opcional.
 * @param {string|null} carpeta_lensware - Carpeta Lensware asociada.
 * @returns {Promise<Object>}
 */
async function saveTicketToFile(order, items, folder = null, carpeta_lensware = null) {
  const agentUrl = buildAgentUrl(order);
  let ticketResult;
  
  if (agentUrl && AGENT_API_KEY) {
    // Si la conexión falla, sendTicketToAgent arrojará el error hacia arriba deteniendo el ciclo
    ticketResult = await sendTicketToAgent(order, items, agentUrl);
  } else {
    // Si no hay un agente configurado, forzamos un error de comunicación para detener el proceso
    throw new Error('Error de comunicación con agente: Agente de impresión no configurado para este laboratorio.');
  }

  return { ticket: ticketResult };
}

/**
 * Ejecuta una comprobación de disponibilidad del agente de impresión.
 * @param {string} ip - Dirección IP.
 * @param {string|number} puerto - Puerto de escucha.
 * @returns {Promise<Object>}
 */
async function testAgentConnection(ip, puerto) {
  const url = `http://${ip}:${puerto}`;
  try {
    const response = await axios.get(`${url}/api/status`, {
      headers: { 'X-API-Key': AGENT_API_KEY },
      timeout: 5000
    });
    return {
      success: true,
      url,
      status: response.status,
      data: response.data
    };
  } catch (err) {
    return {
      success: false,
      url,
      error: err.message,
      code: err.code || 'UNKNOWN'
    };
  }
}

module.exports = {
  saveTicketToFile,
  generateTicketText,
  testAgentConnection,
  buildAgentUrl,
  generateTicketText,
  generateEscPosBuffer
};