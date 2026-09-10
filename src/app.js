const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const crearApiKey = require('./middlewares/api-key');
const crearRouterServicios = require('./rutas/servicios');
const crearRouterRecargas = require('./rutas/recargas');
const { crearRepositorioEmpresas } = require('./datos/empresas');
const HttpError = require('./utils/http-error');

/**
 * Arma la app.
 *
 * Recibe la configuración en vez de leer `process.env` adentro: así los tests
 * levantan una instancia con su propia key sin tocar variables de entorno.
 */
function crearApp({ apiKey, corsOrigins = '*', empresas = crearRepositorioEmpresas() } = {}) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigins }));
  app.use(express.json());

  // Health check sin autenticar: sirve para saber si el proveedor está vivo,
  // que es justo lo que el banco necesita chequear cuando algo falla.
  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'banco-proveedores', ts: new Date().toISOString() });
  });

  app.use(crearApiKey(apiKey));

  app.use('/empresas', crearRouterServicios(empresas));
  app.use('/operadoras', crearRouterRecargas());

  app.use((req, _res, next) => {
    next(new HttpError(404, `No existe la ruta ${req.method} ${req.originalUrl}.`));
  });

  // Mismo shape de error que el banco y el Banco Central: `{ error }`.
  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    res.status(status).json({
      error: status >= 500 ? 'Error interno del proveedor.' : error.message,
    });
  });

  return app;
}

module.exports = crearApp;
