import qz from 'qz-tray';
import api from './api';

/**
 * Servicio para manejar la comunicación con QZ Tray
 */

// ============================================================
// FIRMA DIGITAL (impresión silenciosa)
// El backend firma cada petición con su clave privada
// (backend/keys/qz-private-key.pem). El certificado público
// debe estar confiado en QZ Tray de cada PC (Site Manager u
// override.crt). Sin credenciales configuradas, QZ Tray vuelve
// a mostrar sus diálogos de confirmación.
// ============================================================
qz.security.setCertificatePromise((resolve, reject) => {
  api
    .get('/qz/certificate')
    .then((res) => resolve(res.data.certificate))
    .catch((err) => {
      console.error('❌ No se pudo obtener el certificado QZ del servidor:', err);
      reject(err);
    });
});

qz.security.setSignatureAlgorithm('SHA512'); // QZ Tray >= 2.1

qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
  api
    .get('/qz/sign', { params: { request: toSign } })
    .then((res) => resolve(res.data.signature))
    .catch((err) => {
      console.error('❌ El servidor no pudo firmar la petición QZ:', err);
      reject(err);
    });
});

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