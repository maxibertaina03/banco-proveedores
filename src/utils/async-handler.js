// Envuelve un handler async para que un rechazo llegue al error handler de
// Express en vez de quedar como promesa sin capturar.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
