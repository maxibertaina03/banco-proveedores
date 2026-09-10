// Mismo shape de error que el banco y que el Banco Central: `{ error }`.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
module.exports = HttpError;
