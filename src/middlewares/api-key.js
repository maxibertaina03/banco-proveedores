// Autenticación por API key fija.
//
// No es un secreto real: esto es un mock y la key está en el .env.example. Se
// pide igual para que el código del banco maneje credenciales de proveedor
// exactamente como lo haría con un tercero de verdad, en vez de descubrir recién
// en producción que hay que autenticarse.

const HttpError = require('../utils/http-error');

function crearApiKey(claveEsperada) {
  return function apiKey(req, _res, next) {
    const recibida = req.get('x-api-key');

    if (!recibida) {
      return next(new HttpError(401, 'Falta el header x-api-key.'));
    }
    if (recibida !== claveEsperada) {
      return next(new HttpError(401, 'La API key no es válida.'));
    }
    return next();
  };
}

module.exports = crearApiKey;
