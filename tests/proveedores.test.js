// Tests de banco-proveedores, contra la app real con supertest.
//
// Acá sí conviene probar por HTTP y no unitariamente: este servicio existe para
// que el banco le hable por la red, así que lo que importa es el contrato —
// códigos de estado, shape de la respuesta, headers — más que la lógica interna,
// que es un puñado de filtros sobre datos en memoria.

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

const crearApp = (await import('../src/app.js')).default;
const { crearRepositorioEmpresas } = await import('../src/datos/empresas.js');
const { _limpiar } = await import('../src/middlewares/idempotencia.js');

const KEY = 'clave-de-prueba';
const conKey = (r) => r.set('x-api-key', KEY);

// App nueva por test, con su propio repositorio: así un pago de un test no
// deja la factura pagada para el siguiente.
let app;
beforeEach(() => {
  app = crearApp({ apiKey: KEY, empresas: crearRepositorioEmpresas() });
  _limpiar();
});

describe('Autenticación', () => {
  it('sin API key devuelve 401', async () => {
    const r = await request(app).get('/empresas');
    expect(r.status).toBe(401);
    expect(r.body.error).toMatch(/x-api-key/);
  });

  it('con una API key equivocada devuelve 401', async () => {
    const r = await request(app).get('/empresas').set('x-api-key', 'otra');
    expect(r.status).toBe(401);
  });

  it('el health check NO pide key: el banco tiene que poder ver si estamos vivos', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });
});

describe('GET /empresas', () => {
  it('devuelve el catálogo completo', async () => {
    const r = await conKey(request(app).get('/empresas'));
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(3);
    expect(r.body[0]).toHaveProperty('formato_numero_cliente');
  });

  it('filtra por rubro', async () => {
    const r = await conKey(request(app).get('/empresas?rubro=luz'));
    expect(r.body.every((e) => e.rubro === 'luz')).toBe(true);
  });

  it('rechaza un rubro inventado', async () => {
    const r = await conKey(request(app).get('/empresas?rubro=criptomonedas'));
    expect(r.status).toBe(400);
  });
});

describe('GET /empresas/:id/deuda', () => {
  it('devuelve las facturas impagas y el total', async () => {
    const r = await conKey(request(app).get('/empresas/edenor/deuda?numero_cliente=123456789'));
    expect(r.status).toBe(200);
    expect(r.body.facturas.length).toBe(2);
    expect(r.body.total_adeudado).toBe(84220.85);
  });

  it('un cliente al día devuelve 200 con lista vacía, NO 404', async () => {
    // Confundirlos haría que el banco muestre "cliente inexistente" a alguien
    // que simplemente no debe nada.
    const r = await conKey(request(app).get('/empresas/aysa/deuda?numero_cliente=111111111'));
    expect(r.status).toBe(200);
    expect(r.body.facturas).toEqual([]);
    expect(r.body.total_adeudado).toBe(0);
  });

  it('404 si la empresa no existe', async () => {
    const r = await conKey(request(app).get('/empresas/inventada/deuda?numero_cliente=1'));
    expect(r.status).toBe(404);
  });

  it('400 si falta el número de cliente', async () => {
    const r = await conKey(request(app).get('/empresas/edenor/deuda'));
    expect(r.status).toBe(400);
  });
});

describe('POST /empresas/:id/pagos', () => {
  const pago = { factura_id: 'fac-edenor-202608', importe: 45320.75 };

  it('marca la factura como pagada y devuelve comprobante', async () => {
    const r = await conKey(request(app).post('/empresas/edenor/pagos')).send(pago);
    expect(r.status).toBe(201);
    expect(r.body.factura.estado).toBe('pagada');
    expect(r.body.comprobante).toMatch(/^PAG-/);
  });

  it('después de pagar, la deuda baja', async () => {
    await conKey(request(app).post('/empresas/edenor/pagos')).send(pago);
    const r = await conKey(request(app).get('/empresas/edenor/deuda?numero_cliente=123456789'));
    expect(r.body.facturas.length).toBe(1);
  });

  it('409 si la factura ya estaba pagada', async () => {
    await conKey(request(app).post('/empresas/edenor/pagos')).send(pago);
    const r = await conKey(request(app).post('/empresas/edenor/pagos')).send(pago);
    expect(r.status).toBe(409);
  });

  it('400 si el importe no coincide', async () => {
    const r = await conKey(request(app).post('/empresas/edenor/pagos'))
      .send({ ...pago, importe: 100 });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/45320.75/);
  });

  it('tolera un centavo de diferencia por redondeo del banco', async () => {
    const r = await conKey(request(app).post('/empresas/edenor/pagos'))
      .send({ ...pago, importe: 45320.76 });
    expect(r.status).toBe(201);
  });

  it('con Idempotency-Key, reintentar devuelve la respuesta original', async () => {
    const clave = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const primera = await conKey(request(app).post('/empresas/edenor/pagos'))
      .set('Idempotency-Key', clave).send(pago);
    const segunda = await conKey(request(app).post('/empresas/edenor/pagos'))
      .set('Idempotency-Key', clave).send(pago);

    // Sin idempotencia la segunda daría 409; con ella, replay del 201.
    expect(primera.status).toBe(201);
    expect(segunda.status).toBe(201);
    expect(segunda.headers['idempotent-replay']).toBe('true');
    expect(segunda.body.comprobante).toBe(primera.body.comprobante);
  });
});

describe('GET /operadoras', () => {
  it('devuelve las operadoras con sus montos', async () => {
    const r = await conKey(request(app).get('/operadoras'));
    expect(r.status).toBe(200);
    expect(r.body[0].montos_disponibles.length).toBeGreaterThan(0);
  });
});

describe('POST /operadoras/:id/recargas', () => {
  it('acredita una recarga válida', async () => {
    const r = await conKey(request(app).post('/operadoras/movistar/recargas'))
      .send({ numero: '3514123456', monto: 2000 });
    expect(r.status).toBe(201);
    expect(r.body.estado).toBe('acreditada');
  });

  it('RECHAZA los números terminados en 0000, a propósito', async () => {
    // Es el caso de error reproducible que el banco necesita para probar su
    // manejo de fallos sin tener que apagar este servicio.
    const r = await conKey(request(app).post('/operadoras/movistar/recargas'))
      .send({ numero: '3514120000', monto: 2000 });
    expect(r.status).toBe(422);
    expect(r.body.error).toMatch(/rechazó/);
  });

  it('400 si el monto no está entre los que acepta la operadora', async () => {
    const r = await conKey(request(app).post('/operadoras/tuenti/recargas'))
      .send({ numero: '3514123456', monto: 10000 });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/200, 500, 1000/);
  });

  it('400 si el número no tiene 10 dígitos', async () => {
    const r = await conKey(request(app).post('/operadoras/movistar/recargas'))
      .send({ numero: '15-3514-123456', monto: 500 });
    expect(r.status).toBe(400);
  });

  it('404 si la operadora no existe', async () => {
    const r = await conKey(request(app).post('/operadoras/nextel/recargas'))
      .send({ numero: '3514123456', monto: 500 });
    expect(r.status).toBe(404);
  });
});

describe('Errores', () => {
  it('una ruta inexistente devuelve 404 con el shape acordado', async () => {
    const r = await conKey(request(app).get('/no-existe'));
    expect(r.status).toBe(404);
    expect(Object.keys(r.body)).toEqual(['error']);
  });
});
