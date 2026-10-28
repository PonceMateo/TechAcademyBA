# Proposal

## Why

La HU 21 imputa el importe completo a un alumno y deja el pago sin imputar cuando no se elige
ninguno, pero no hay forma de repartir un comprobante entre varios alumnos ni de imputar después
el saldo que quedó pendiente. El titular de la transferencia tampoco siempre es el alumno, así que
el saldo sin imputar hoy queda muerto: el historial lo muestra y no permite corregirlo. El modelo
ya tiene `Imputacion` con destino único y la relación con `Cobranza`, así que falta el camino
entre la pantalla y esa tabla.

## What Changes

- `POST /cobranzas` acepta `imputaciones[]` como alternativa a `alumno_id`/`inscripcion_id`: una
  lista de `{inscripcion_id | empresa_id, monto}`. Sin imputaciones ni alumno, la cobranza queda
  sin imputar. La imputación individual de la HU 21 no cambia.
- La suma de las imputaciones no puede superar el importe, cada monto debe ser positivo y un
  destino no puede repetirse en el mismo pedido. Se valida en el contrato y en el servicio.
- Nuevo `POST /cobranzas/{id}/imputaciones`, exclusivo de Administración, que reparte solo el
  saldo sin imputar. Bloquea la cobranza con `FOR UPDATE` para que dos operaciones simultáneas no
  sobreimputen; conserva las imputaciones anteriores, no crea otra cobranza y deja el cambio en
  `audit_log`.
- `GET /cobranzas` agrega `imputaciones`, `monto_imputado` y `saldo_sin_imputar` y conserva
  `imputacion` (la primera) para no romper la tabla de la HU 21.
- Nuevo `GET /alumno/pagos`, solo rol `ALUMNO`, limitado al legajo del usuario autenticado. Cada
  fila devuelve lo imputado a ese alumno, no el total de un pago repartido.
- Frontend: la sección de imputaciones del formulario ofrece `Un alumno`, `Varios alumnos` y
  `Sin imputar`. En el reparto se agregan y quitan filas, cada una elige alumno, inscripción
  activa e importe, y se muestran en vivo el total recibido, lo distribuido y el saldo. El
  historial agrega `Agregar imputación`, con las imputaciones existentes y el saldo disponible.
- **Sin migración:** se reutilizan `Imputacion` y sus CHECKs.

**Fuera de alcance:** imputar a empresa desde la pantalla. La API valida el contrato activo y está
probada, pero la HU 19 no tiene endpoint ni pantalla de contratos corporativos; no se inventan
contratos. Tampoco se editan ni eliminan imputaciones, ni se toca la emisión de facturas.

## Capabilities

### Modified Capabilities

- `cobranzas`: alta con distribución entre varios destinos, imputación posterior del saldo e
  historial del alumno.
- `admin-shell`: la sección de imputaciones del formulario de cobranzas y la acción de imputar
  saldo desde el historial.

## Impact

Backend: `app/schemas/cobranzas.py`, `app/services/cobranzas.py`, `app/api/cobranzas.py`, nuevo
`app/api/alumno.py`, `app/api/router.py` y `app/tests/test_imputaciones_api.py`. Frontend:
`dataService`, `apiDataSource`, `mockDataSource`, `PaymentsPage` y sus tests. Sin dependencias
nuevas.
