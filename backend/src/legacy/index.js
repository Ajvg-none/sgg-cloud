/**
 * Punto de entrada unificado para el código heredado del middleware.
 * Todas las funciones copiadas del sistema en producción se exportan aquí
 * para facilitar su reutilización en el nuevo SGG.
 * 
 * IMPORTANTE: Estas funciones NO deben ser reescritas. Solo se adaptan
 * para recibir parámetros externos (URLs, credenciales) en lugar de
 * depender de variables de entorno o archivos de configuración locales.
 */

// ============================================================
// 1. API de GesVision (autenticación, reintentos, endpoints)
// ============================================================
const gesvisionApi = require('./gesvisionApi');

// ============================================================
// 2. Sincronización de órdenes (mapeo de datos crudos a objeto plano)
//    Extraemos la función fetchAndMapOrder de orderSync.js
//    (más adelante la aislaremos completamente para que sea pura)
// ============================================================
// Por ahora, exportamos todo el módulo orderSync para tener acceso
// a la función syncOrder (que incluye la lógica de mapeo).
// En fases posteriores, extraeremos la función fetchAndMapOrder pura.
const orderSync = require('./orderSync');

// ============================================================
// 3. Generación de contenido VCA (formato Lensware)
// ============================================================
const lensware = require('./lensware');

// ============================================================
// 4. Generación de tickets ESC/POS (impresión Bixolon)
// ============================================================
const printer = require('./printer');

// ============================================================
// EXPORTACIONES UNIFICADAS
// ============================================================

module.exports = {
  // --- GesVision API ---
  gesvisionApi,

  // --- Sincronización de órdenes ---
  fetchAndMapOrder: require('./fetchAndMapOrder').fetchAndMapOrder, // <-- AGREGAR ESTA LÍNEA
  syncOrder: orderSync.syncOrder,

  // --- Lensware (VCA) ---
  // Función pura para generar contenido VCA (sin escribir en disco)
  generateVCAContent: lensware.generateVCAContent,
  // Funciones auxiliares (por si se necesitan)
  cleanArticleCode: lensware.cleanArticleCode,
  validateCodePrefix: lensware.validateCodePrefix,
  parseVCAContent: lensware.parseVCAContent,

  // --- Printer (tickets ESC/POS) ---
  // Función pura para generar el texto del ticket
  generateTicketText: printer.generateTicketText,
  // Función pura para generar el buffer ESC/POS (lo imprime el frontend con QZ Tray)
  generateEscPosBuffer: printer.generateEscPosBuffer,
};