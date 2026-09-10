// Idempotencia por header `Idempotency-Key`.
//
// Versión mínima comparada con la del banco: guarda en memoria y no distingue
// por usuario, porque acá no hay usuarios. Alcanza para lo que tiene que
// demostrar — que reintentar un pago no lo cobra dos veces.
//
// Es opt-in: sin el header, el endpoint funciona normalmente.

const respuestas = new Map();
const TTL_MS = 24 * 60 * 60 * 1000;

function idempotencia(req, res, next) {
  const clave = req.get('Idempotency-Key');
  if (!clave) return next();

  const guardada = respuestas.get(clave);
  if (guardada && guardada.expira > Date.now()) {
    res.setHeader('Idempotent-Replay', 'true');
    return res.status(guardada.status).json(guardada.body);
  }

  // Se envuelve `res.json` para capturar la respuesta cuando se emita.
  const jsonOriginal = res.json.bind(res);
  res.json = (body) => {
    // Sólo se cachean los resultados definitivos. Un 5xx se deja libre para que
    // el reintento vuelva a ejecutarse de verdad.
    if (res.statusCode < 500) {
      respuestas.set(clave, { status: res.statusCode, body, expira: Date.now() + TTL_MS });
    }
    return jsonOriginal(body);
  };

  return next();
}

/** Sólo para tests. */
function _limpiar() {
  respuestas.clear();
}

module.exports = { idempotencia, _limpiar };
