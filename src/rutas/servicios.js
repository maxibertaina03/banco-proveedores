// Empresas de servicios: catálogo, deuda y pagos.
//
// Lo que este mock NO hace, a propósito: mover plata. El débito de la cuenta lo
// hace el banco por su lado; acá sólo se confirma que el proveedor dio la
// factura por cobrada. Es como funciona de verdad, y mezclarlo haría que el
// banco delegue algo que es suyo.

const express = require("express");
const { z } = require("zod");
const HttpError = require("../utils/http-error");
const asyncHandler = require("../utils/async-handler");
const { idempotencia } = require("../middlewares/idempotencia");

const RUBROS = [
  "luz",
  "gas",
  "agua",
  "internet",
  "telefonia",
  "cable",
  "otros",
];

function crearRouterServicios(empresas) {
  const router = express.Router();

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const { rubro } = req.query;
      if (rubro && !RUBROS.includes(rubro)) {
        throw new HttpError(
          400,
          `Rubro no válido. Valores: ${RUBROS.join(", ")}.`,
        );
      }
      res.json(empresas.listarEmpresas(rubro || null));
    }),
  );

  router.get(
    "/:empresaId/deuda",
    asyncHandler(async (req, res) => {
      const empresa = empresas.buscarEmpresa(req.params.empresaId);
      if (!empresa) {
        throw new HttpError(
          404,
          `No existe la empresa "${req.params.empresaId}".`,
        );
      }

      const numeroCliente = req.query.numero_cliente;
      if (!numeroCliente) {
        throw new HttpError(400, "Falta el parámetro numero_cliente.");
      }

      const facturas = empresas.deudaDe(empresa.id, String(numeroCliente));
      const total = facturas.reduce((acc, f) => acc + f.importe, 0);

      // Un cliente al día devuelve 200 con la lista vacía, NO un 404: el cliente
      // existe, simplemente no debe nada. Confundirlos haría que el banco muestre
      // "cliente inexistente" a alguien que está al día.
      res.json({
        numero_cliente: String(numeroCliente),
        total_adeudado: Math.round(total * 100) / 100,
        facturas,
      });
    }),
  );

  const pagoSchema = z.object({
    factura_id: z.string().trim().min(1),
    importe: z.coerce.number().positive(),
  });

  router.post(
    "/:empresaId/pagos",
    idempotencia,
    asyncHandler(async (req, res) => {
      const empresa = empresas.buscarEmpresa(req.params.empresaId);
      if (!empresa) {
        throw new HttpError(
          404,
          `No existe la empresa "${req.params.empresaId}".`,
        );
      }

      const parseo = pagoSchema.safeParse(req.body);
      if (!parseo.success) {
        throw new HttpError(
          400,
          "Hace falta factura_id y un importe mayor a cero.",
        );
      }
      const { factura_id: facturaId, importe } = parseo.data;

      const factura = empresas.buscarFactura(empresa.id, facturaId);
      if (!factura) {
        throw new HttpError(
          404,
          `No existe la factura "${facturaId}" en ${empresa.nombre}.`,
        );
      }
      if (factura.estado === "pagada") {
        throw new HttpError(409, "La factura ya estaba pagada.");
      }
      // Se compara EN CENTAVOS, como enteros. Comparar los floats directo falla:
      // Math.abs(45320.76 - 45320.75) da 0.010000000002, que es mayor que 0.01
      // y rechazaría un pago correcto. Es el mismo problema que en el banco
      // resuelve el value object Dinero; acá, siendo un mock, alcanza con no
      // salir nunca de los enteros.
      const enCentavos = (n) => Math.round(n * 100);
      if (Math.abs(enCentavos(importe) - enCentavos(factura.importe)) > 1) {
        throw new HttpError(
          400,
          `El importe no coincide con el de la factura. Esperado: ${factura.importe}.`,
        );
      }

      const pagada = empresas.marcarPagada(facturaId);

      res.status(201).json({
        factura: pagada,
        fecha_pago: new Date().toISOString(),
        comprobante: `PAG-${Date.now().toString().slice(-9)}`,
      });
    }),
  );

  return router;
}

module.exports = crearRouterServicios;
