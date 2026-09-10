// Operadoras de celular y recarga de saldo prepago.

const express = require("express");
const { z } = require("zod");
const operadoras = require("../datos/operadoras");
const HttpError = require("../utils/http-error");
const asyncHandler = require("../utils/async-handler");
const { idempotencia } = require("../middlewares/idempotencia");

function crearRouterRecargas() {
  const router = express.Router();

  router.get(
    "/",
    asyncHandler(async (_req, res) => {
      res.json(operadoras.listar());
    }),
  );

  const recargaSchema = z.object({
    numero: z
      .string()
      .trim()
      .regex(/^\d{10}$/, "El número va con 10 dígitos, sin 0 ni 15."),
    monto: z.coerce.number().positive(),
  });

  router.post(
    "/:operadoraId/recargas",
    idempotencia,
    asyncHandler(async (req, res) => {
      const operadora = operadoras.buscar(req.params.operadoraId);
      if (!operadora) {
        throw new HttpError(
          404,
          `No existe la operadora "${req.params.operadoraId}".`,
        );
      }

      const parseo = recargaSchema.safeParse(req.body);
      if (!parseo.success) {
        throw new HttpError(
          400,
          parseo.error.issues[0]?.message || "Datos de recarga inválidos.",
        );
      }
      const { numero, monto } = parseo.data;

      if (!operadora.montos_disponibles.includes(monto)) {
        throw new HttpError(
          400,
          `${operadora.nombre} no acepta ese monto. Disponibles: ${operadora.montos_disponibles.join(", ")}.`,
        );
      }

      // Rechazo reproducible, a propósito: el banco necesita un caso de error que
      // pueda disparar cuando quiera, sin depender de apagar este servicio.
      if (operadoras.rechaza(numero)) {
        throw new HttpError(
          422,
          "La operadora rechazó la recarga para ese número.",
        );
      }

      res.status(201).json({
        id: `rec-${Date.now().toString().slice(-9)}`,
        numero,
        monto,
        operadora: operadora.nombre,
        estado: "acreditada",
        fecha: new Date().toISOString(),
      });
    }),
  );

  return router;
}

module.exports = crearRouterRecargas;
