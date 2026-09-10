// Operadoras de celular para las recargas.
//
// Cada una acepta ciertos montos, como en la vida real: no se puede recargar
// cualquier número arbitrario.

const OPERADORAS = [
  { id: 'movistar', nombre: 'Movistar', montos_disponibles: [500, 1000, 2000, 5000, 10000] },
  { id: 'personal', nombre: 'Personal', montos_disponibles: [500, 1000, 2000, 5000] },
  { id: 'claro',    nombre: 'Claro',    montos_disponibles: [300, 500, 1000, 2000, 5000, 10000] },
  { id: 'tuenti',   nombre: 'Tuenti',   montos_disponibles: [200, 500, 1000] },
];

function listar() {
  return OPERADORAS;
}

function buscar(id) {
  return OPERADORAS.find((o) => o.id === id) || null;
}

/**
 * Si la operadora rechaza esta recarga.
 *
 * **Los números terminados en `0000` se rechazan a propósito.** No es un bug:
 * el banco necesita un caso de rechazo reproducible para probar su manejo de
 * error, y no se puede depender de apagar el servicio para eso.
 */
function rechaza(numero) {
  return String(numero).endsWith('0000');
}

module.exports = { listar, buscar, rechaza, OPERADORAS };
