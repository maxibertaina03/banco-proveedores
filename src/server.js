require('dotenv').config();

const crearApp = require('./app');

const puerto = Number(process.env.PORT || 4000);
const apiKey = process.env.PROVEEDORES_API_KEY || 'orbital-proveedores-2026';
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : '*';

crearApp({ apiKey, corsOrigins }).listen(puerto, () => {
  // eslint-disable-next-line no-console
  console.log(`banco-proveedores escuchando en http://localhost:${puerto}`);
});
