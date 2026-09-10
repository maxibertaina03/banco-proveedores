// Catálogo de empresas de servicios y sus facturas.
//
// Es un mock: los datos viven en memoria y se reinician con el proceso. Está
// bien así — el objetivo es que el banco tenga contra qué hablar, no simular
// una empresa de verdad.
//
// Las facturas SÍ cambian de estado durante la sesión, para que el flujo
// completo se pueda probar: consultar deuda → pagar → volver a consultar y ver
// que ya no debe nada.

const EMPRESAS = [
  { id: 'edenor',    nombre: 'Edenor',            rubro: 'luz',       formato_numero_cliente: '9 dígitos' },
  { id: 'metrogas',  nombre: 'Metrogas',          rubro: 'gas',       formato_numero_cliente: '11 dígitos' },
  { id: 'aysa',      nombre: 'AySA',              rubro: 'agua',      formato_numero_cliente: '9 dígitos' },
  { id: 'fibertel',  nombre: 'Fibertel',          rubro: 'internet',  formato_numero_cliente: '10 dígitos' },
  { id: 'personal',  nombre: 'Personal Flow',     rubro: 'telefonia', formato_numero_cliente: '10 dígitos' },
  { id: 'directv',   nombre: 'DirecTV',           rubro: 'cable',     formato_numero_cliente: '9 dígitos' },
];

// Facturas iniciales. Se clonan al arrancar para que los pagos de una sesión no
// contaminen la constante.
const FACTURAS_INICIALES = [
  { id: 'fac-edenor-202608', empresa_id: 'edenor',   numero_cliente: '123456789', periodo: '2026-08', importe: 45320.75, vencimiento: '2026-09-20', estado: 'impaga' },
  { id: 'fac-edenor-202607', empresa_id: 'edenor',   numero_cliente: '123456789', periodo: '2026-07', importe: 38900.10, vencimiento: '2026-08-20', estado: 'vencida' },
  { id: 'fac-metrogas-202608', empresa_id: 'metrogas', numero_cliente: '11122233344', periodo: '2026-08', importe: 12480.00, vencimiento: '2026-09-15', estado: 'impaga' },
  { id: 'fac-aysa-202608',   empresa_id: 'aysa',     numero_cliente: '987654321', periodo: '2026-08', importe: 8750.50,  vencimiento: '2026-09-25', estado: 'impaga' },
  { id: 'fac-fibertel-202608', empresa_id: 'fibertel', numero_cliente: '1122334455', periodo: '2026-08', importe: 32000.00, vencimiento: '2026-09-10', estado: 'impaga' },
  // Un cliente al día, para probar el caso de deuda vacía: la respuesta es 200
  // con la lista vacía, no un 404.
  { id: 'fac-aysa-202607',   empresa_id: 'aysa',     numero_cliente: '111111111', periodo: '2026-07', importe: 7200.00, vencimiento: '2026-08-25', estado: 'pagada' },
];

/**
 * Crea un repositorio con su propio estado.
 *
 * Es una factory y no un singleton a propósito: vitest puede cargar dos veces
 * un módulo CommonJS, y con estado a nivel de módulo el test terminaría
 * reiniciando una instancia distinta de la que usan las rutas. Inyectando, cada
 * test arranca con datos frescos y no hay ambigüedad.
 */
function crearRepositorioEmpresas() {
  let facturas = FACTURAS_INICIALES.map((f) => ({ ...f }));

  function listarEmpresas(rubro = null) {
    return rubro ? EMPRESAS.filter((e) => e.rubro === rubro) : EMPRESAS;
  }

  function buscarEmpresa(id) {
    return EMPRESAS.find((e) => e.id === id) || null;
  }

/** Facturas impagas o vencidas de un cliente. Las pagadas no son deuda. */
  function deudaDe(empresaId, numeroCliente) {
    return facturas.filter(
      (f) => f.empresa_id === empresaId && f.numero_cliente === numeroCliente && f.estado !== 'pagada'
    );
  }

  function buscarFactura(empresaId, facturaId) {
    return facturas.find((f) => f.empresa_id === empresaId && f.id === facturaId) || null;
  }

  function marcarPagada(facturaId) {
    const factura = facturas.find((f) => f.id === facturaId);
    if (factura) factura.estado = 'pagada';
    return factura;
  }

  return { listarEmpresas, buscarEmpresa, deudaDe, buscarFactura, marcarPagada };
}

module.exports = { crearRepositorioEmpresas, EMPRESAS };
