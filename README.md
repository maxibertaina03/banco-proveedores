# banco-proveedores

Mocks de los proveedores externos con los que opera **Banco Orbital**: empresas
de servicios y operadoras de celular.

**No es parte del banco.** Es una API aparte, con su propio deploy, que el banco
consume por HTTP como si fuera un tercero real.

## Por qué está separado

En la vida real un banco no tiene adentro el catálogo de facturas de la empresa
de luz: se lo pregunta por API. Separarlo tiene tres ventajas concretas:

- El código del banco queda igual que si el proveedor fuera real: cliente HTTP,
  timeout, manejo de caída.
- **Se puede apagar el proveedor** para probar qué hace el banco cuando el
  tercero no responde. Eso no se puede ensayar si el mock vive adentro.
- Es un pedazo de trabajo que se toma entero sin tocar el backend.

## Arrancar

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:4000
```

```bash
curl http://localhost:4000/health
curl -H "x-api-key: orbital-proveedores-2026" http://localhost:4000/empresas
```

## Endpoints

El contrato completo está en
[`banco-backend/docs/openapi-banco-proveedores.yaml`](https://github.com/maxibertaina03/banco-backend/blob/main/docs/openapi-banco-proveedores.yaml).

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/health` | Si el proveedor está vivo. **No pide API key** |
| `GET` | `/empresas` | Catálogo. Filtra con `?rubro=luz` |
| `GET` | `/empresas/{id}/deuda?numero_cliente=` | Facturas impagas y total |
| `POST` | `/empresas/{id}/pagos` | Marca una factura como pagada |
| `GET` | `/operadoras` | Operadoras con sus montos de recarga |
| `POST` | `/operadoras/{id}/recargas` | Acredita saldo prepago |

## Cosas que conviene saber antes de integrar

**El proveedor no mueve plata.** El débito de la cuenta lo hace el banco por su
lado; acá sólo se confirma que la factura quedó cobrada. Mezclarlo haría que el
banco delegue algo que es suyo.

**Un cliente al día devuelve `200` con la lista vacía, no `404`.** El cliente
existe, simplemente no debe nada. Confundirlos haría que el banco muestre
"cliente inexistente" a alguien que está al día.

**Los números terminados en `0000` se rechazan a propósito**, con `422`. Es un
caso de error reproducible para que el banco pueda probar su manejo de fallos
sin depender de apagar este servicio.

**Acepta `Idempotency-Key`**, igual que el banco: reintentar un pago con la misma
clave devuelve la respuesta original con el header `Idempotent-Replay: true`, en
vez de cobrarlo dos veces.

## Autenticación

API key fija por header `x-api-key`, configurable en el `.env`. No es un secreto
real —esto es un mock— pero se pide igual para que el código del banco maneje
credenciales de proveedor como lo haría en producción.

## Datos

Están en memoria y se reinician con el proceso. Las facturas **sí** cambian de
estado durante la sesión, para que el flujo completo se pueda probar: consultar
deuda → pagar → volver a consultar y ver que ya no debe nada.

Los datos de prueba están en [`src/datos/`](src/datos/). Hay un cliente al día a
propósito, el `111111111` de AySA, para probar el caso de deuda vacía.

## Tests

```bash
npm test     # 23 tests
```

Van contra la app real con supertest, no unitariamente: este servicio existe
para que el banco le hable por la red, así que lo que importa es el contrato —
códigos de estado, shape de la respuesta, headers — más que la lógica interna,
que es un puñado de filtros sobre datos en memoria.
