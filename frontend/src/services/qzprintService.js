import qz from 'qz-tray';

/**
 * Servicio para manejar la comunicación con QZ Tray
 */

// Verifica si QZ Tray está activo
export const isQZActive = () => {
  return typeof qz !== 'undefined' && qz.websocket.isActive();
};

// Conecta con QZ Tray
export const connectQZ = async () => {
  if (isQZActive()) return true;
  
  try {
    await qz.websocket.connect();
    console.log('✅ Conectado a QZ Tray');
    return true;
  } catch (err) {
    console.error('❌ Error conectando a QZ Tray:', err);
    throw new Error('No se pudo conectar con QZ Tray. Asegúrate de que esté ejecutándose.');
  }
};

// Imprime datos RAW (ESC/POS)
export const printRawData = async (printerName, base64Data) => {
  if (!isQZActive()) {
    await connectQZ();
  }

  // Configuración de la impresora
  const config = qz.configs.create(printerName, {
    // encoding: 'hex' es necesario si enviamos hex, pero aquí usaremos base64 directo
  });

  // QZ Tray acepta base64 directamente si especificamos el formato
  const data = [
    {
      type: 'raw',
      format: 'base64',
      data: base64Data
    }
  ];

  try {
    await qz.print(config, data);
    console.log(`🖨️ Impresión enviada a ${printerName}`);
    return true;
  } catch (err) {
    console.error('❌ Error al imprimir:', err);
    throw err;
  }
};

// Escribe archivo VCA (opcional, si quieres hacerlo desde el navegador)
export const writeVCAFile = async (filePath, content) => {
  if (!isQZActive()) {
    await connectQZ();
  }
  
  try {
    // sandbox: false permite escribir fuera de la carpeta de QZ Tray (requiere permisos)
    await qz.file.write(filePath, content, { sandbox: false });
    console.log(`📄 Archivo VCA escrito en ${filePath}`);
    return true;
  } catch (err) {
    console.error('❌ Error escribiendo VCA:', err);
    throw err;
  }
};