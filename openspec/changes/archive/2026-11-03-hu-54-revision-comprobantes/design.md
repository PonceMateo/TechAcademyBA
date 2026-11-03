# Design

## Contexto

La HU 52 dejó el comprobante como una entidad independiente (`comprobante_alumno`) con dos
estados y sin vínculo con `cobranza` (D67). La aceptación definitiva quedó explícitamente fuera de
esa historia y se reservó para una migración aditiva. Esta historia la implementa.

Decisiones que se reutilizan sin reabrir:

- **D7 / HU 22:** el pagador es de la operación y no se deduplica; el comprobante puede haberlo
  pagado un tercero.
- **D12 / HU 21 y HU 45:** `EstadoCobranza` no cambia. Aceptar crea una cobranza `ACREDITADO` con
  la causa nula, y la matriz de transiciones del panel de cobranzas sigue intacta.
- **D8 / HU 23:** el saldo y la sobreimputación se validan con la fila bloqueada; la aceptación
  reutiliza `resolver_inscripcion`, así que imputa el importe completo a la inscripción del envío.
- **D9 / HU #27:** la habilitación no se escribe: se deriva de las cobranzas acreditadas, así que
  aceptar el comprobante alcanza y no hay una segunda regla que mantener.
- **D60:** el alumno sale de la sesión, nunca de un parámetro.
- **D67:** el titular nulo sigue siendo «no identificado» en el comprobante; la cobranza necesita
  un texto y usa `TITULAR_SIN_IDENTIFICAR`, igual que el alta manual.

## Modelo de datos

Migración aditiva `0008_revision_comprobantes` sobre `comprobante_alumno`:

| Columna | Para qué |
| --- | --- |
| `cobranza_id` (FK, único) | Trazabilidad y garantía de una sola cobranza por comprobante. |
| `revisado_por` (FK usuario, `SET NULL`) | Quién resolvió. |
| `revisado_at` | Cuándo resolvió. |
| `motivo` | Causa de la observación o del rechazo. |
| `comprobante_origen_id` (FK propia, único) | Reenvío del comprobante observado. |

CHECK nuevos:

- `(revisado_por IS NULL) = (revisado_at IS NULL)`: la resolución siempre queda con autor y fecha.
- `estado NOT IN ('OBSERVADO', 'RECHAZADO') OR motivo ~ '[^[:space:]]'`: misma regla de causa
  obligatoria que la cobranza (D28), y una causa de solo espacios también es vacía.
- `(estado = 'ACEPTADO') = (cobranza_id IS NOT NULL)`: solo la aceptación acredita.
- `estado IN (...)` ampliado con los tres estados nuevos. `PENDIENTE_CARGA` y
  `PENDIENTE_REVISION` se conservan y ningún comprobante existente queda inválido.

La unicidad de `cobranza_id` admite varias filas con `NULL` en PostgreSQL, que es justo lo que
necesitan los comprobantes sin resolver. La de `comprobante_origen_id` impide reenviar dos veces el
mismo observado incluso ante dos peticiones simultáneas.

## Aceptación transaccional

`cobranzas.crear_cobranza` confirmaba por su cuenta, así que se separó en dos:

- `construir_cobranza(session, datos)`: alta de pagador, cobranza e imputaciones en la sesión del
  llamador, sin confirmar. Es la lógica existente, sin copiarla.
- `crear_cobranza(session, datos)`: la envuelve, confirma y traduce los errores de integridad, como
  hasta ahora.

La aceptación (`comprobantes.aceptar`) hace, en una sola transacción:

1. `SELECT ... FOR UPDATE` del comprobante y comprobación de que sigue `PENDIENTE_REVISION`.
2. `construir_cobranza` con el importe, la fecha, el medio, el titular, la Factura A y la
   inscripción del comprobante.
3. Estado `ACEPTADO`, `cobranza_id`, `revisado_por` y `revisado_at`.
4. Una fila de `audit_log` con `comprobante.aceptado` y el id de la cobranza.
5. Un único `commit`.

Cualquier error revierte todo. Si dos administradores aceptan a la vez, el segundo espera el lock,
vuelve a leer el estado ya resuelto y recibe `409`; si llegara a colarse, la restricción única de
`cobranza_id` lo rechaza. No se crea lógica paralela de cobranzas ni se altera ningún pago previo.

## Observación y rechazo

Misma transacción y mismo lock, sin crear cobranza ni imputación:

- `OBSERVADO`: guarda el motivo y habilita al alumno a reenviar.
- `RECHAZADO`: guarda el motivo y es definitivo; no se reabre ni se resuelve otra vez.

El motivo se valida en el contrato (`422` si viene vacío o solo con espacios) y otra vez con un
CHECK en la base. Ni la habilitación ni el estado de la inscripción cambian.

## Reenvío

`POST /alumno/comprobantes/{id}/reenviar` copia los datos del pago del comprobante observado —el
cliente solo elige el archivo— y crea una fila nueva con `comprobante_origen_id`, que sigue el
mismo circuito de la HU 52: iniciar, subir, confirmar, quedar `PENDIENTE_REVISION`. El original no
se toca y conserva su motivo y su historial. No se reenvía un comprobante pendiente ni rechazado.

## API

| Ruta | Rol | Respuesta |
| --- | --- | --- |
| `GET /comprobantes?estado=` | `ADMIN` | Pendientes primero y por recepción ascendente; resueltos después. |
| `GET /comprobantes/{id}` | `ADMIN` | Detalle con estado, motivo, revisor y cobranza. |
| `POST /comprobantes/{id}/aceptar` | `ADMIN` | `200`, `404`, `409` si ya se resolvió, `422` si no se puede acreditar. |
| `POST /comprobantes/{id}/observar` | `ADMIN` | `200`, `422` sin motivo, `409` si ya se resolvió. |
| `POST /comprobantes/{id}/rechazar` | `ADMIN` | Igual que observar. |
| `GET /comprobantes/{id}/archivo` | `ADMIN` | Adjunto en cualquier estado, con la sesión. |
| `POST /alumno/comprobantes/{id}/reenviar` | `ALUMNO` | `201` con el destino de subida. |

Sin sesión `401`; `DOCENTE` y `ALUMNO` reciben `403` en las rutas administrativas. El alumno sigue
viendo y descargando solo lo suyo. El detalle del comprobante y su adjunto se sirven con la sesión
o con una URL firmada de vida corta: nunca con una URL pública permanente.

## Frontend

- **Panel de revisión** (`ComprobantesAlumnoCard`, dentro de Cobranzas e Ingresos): tabla con
  alumno, comisión, titular o «Sin identificar», importe, fecha del pago, medio y estado; filtro
  por estado resuelto en el backend; modal de detalle con el PDF en un `iframe` y las imágenes en
  un `img`, ambas desde un `Blob` autenticado. Las acciones aparecen solo para pendientes y piden
  confirmación; observar y rechazar exigen el motivo.
- **Mis Pagos**: los cuatro estados con sus colores, el motivo visible y el botón «Reenviar» solo
  para observados que todavía no tienen un reenvío. El reenvío pide un archivo nuevo con las mismas
  validaciones de la HU 52 y agrega la fila sin borrar la anterior; una vez reenviado, el original
  se muestra como «Ya reenviado» y no se ofrece otra vez.
- Un `409` se muestra como aviso y refresca la lista y el detalle: el estado lo decide el backend.

## Pruebas

- Backend: listado y orden por recepción, filtro, detalle, aceptación con cobranza, pagador,
  imputación, trazabilidad, habilitación y auditoría; observación y rechazo con causa; causa vacía;
  reenvío; rechazo definitivo; `409` de doble resolución; rollback; `401` y `403`; adjunto resuelto.
- Frontend: listado, filtro, detalle con adjunto integrado, las tres acciones con confirmación y
  motivo, mensajes de éxito y error, `409`, estados y reenvío en el panel del alumno.

## Alternativas descartadas

- **Reutilizar el `PATCH /cobranzas/{id}/estado` para resolver el comprobante:** obligaría a crear
  una cobranza desde el panel de cobranzas y a buscar el comprobante por otro lado; rompe la
  trazabilidad y deja dos caminos para acreditar el mismo pago.
- **Guardar la resolución como una tabla de historial:** agrega una entidad para un dato que el
  propio comprobante y `audit_log` ya guardan. Si el cliente pide reintentos múltiples, se migra.
- **Reenviar editando el comprobante observado:** perdería el motivo y el archivo originales. La
  fila nueva conserva el historial y el índice único evita duplicados.
- **Resolver sin `FOR UPDATE`:** el frontend deshabilitando botones no es un control; dos
  administradores podrían generar dos cobranzas.
