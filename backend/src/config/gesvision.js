require('dotenv').config();

module.exports = {
  apiUrl: process.env.GESVISION_URL || 'https://api.gesvision.com',
  user: process.env.GESVISION_USER || 'tu_usuario',
  password: process.env.GESVISION_PASS || 'tu_contraseña'
};