# Proposal

## Why

La pantalla `Cobranzas e Ingresos` ya tiene el formulario y el historial, pero la HU 21 no
persiste nada: `POST /cobranzas` y `GET /cobranzas` no existen, el botón falla contra la API y
el historial queda vacío. La tabla `cobranza` y sus restricciones ya están modeladas, así que
falta el camino real entre la pantalla y PostgreSQL.

## What Changes

- Nuevos `GET /cobranzas` y `POST /cobranzas`, exclusivos de Administración, con validación de
  fecha no futura, importe mayor a cero, medio de pago y estado permitidos, y causa obligatoria
  cuando el comprobante no está acreditado.
- Nuevo `GET /alumnos/{id}/inscripciones` para que la pantalla pueda elegir la inscripción a la
  que se imputa el pago cuando el alumno tiene más de una activa.
- El alta crea `Pagador`, `Cobranza` e `Imputacion` en una sola transacción. El pagador se crea
  por operación, sin padrón ni deduplicación; el nombre del titular se conserva tal como se
  ingresó.
- Si el administrador elige un alumno, la imputación va a una inscripción ACTIVA del alumno. Con
  una sola inscripción se selecciona sola; con varias, la pantalla obliga a elegir; sin ninguna,
  el backend rechaza el pago imputado.
- La solicitud de Factura A se guarda en `cobranza.factura_a_solicitada` y exige un CUIT válido
  del titular, que se guarda en el `Pagador`. **No se emite ninguna factura**: la emisión es la
  HU 25. El historial muestra `A` cuando se solicitó y `—` cuando no, sin asumir Factura B.
- El frontend maneja el error de la API, confirma solo con un `201`, recarga el historial desde
  `GET /cobranzas` y valida fechas futuras antes de enviar.
- Migración Alembic aditiva para `cobranza.factura_a_solicitada`.

**Fuera de alcance:** emisión de facturas (HU 25), padrón de pagadores (HU 22), pagos divididos
(HU 23), acreditamiento automático y cambios de estado auditados (HU 24).

## Capabilities

### New Capabilities

- `cobranzas`: registro manual y consulta de cobranzas contra PostgreSQL, imputación a una
  inscripción activa y solicitud de Factura A sin emitirla.

### Modified Capabilities

- `admin-shell`: el formulario de Cobranzas agrega el selector de inscripción y el CUIT cuando
  se solicita Factura A; el historial consume datos reales y refresca después del alta.

## Impact

Backend: `app/models/cobranza.py`, nueva migración `0004`, `app/schemas/cobranzas.py`,
`app/services/cobranzas.py`, `app/api/cobranzas.py`, `app/api/alumnos.py`, `app/api/router.py`,
`app/services/inscripciones.py` y tests de API. Frontend: `dataService`, `apiDataSource`,
`mockDataSource`, `PaymentsPage` y sus tests. Sin cambios de navegación ni de identidad visual.
