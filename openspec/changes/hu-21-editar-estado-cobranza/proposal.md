# Proposal

## Why

La HU 21 registra cobranzas con estado `ACREDITADO`, `OBSERVADO` o `RECHAZADO`, pero no permite
corregirlas. Un comprobante que llegó observado —un cheque sin acreditar, un importe ilegible— o
rechazado queda con ese estado para siempre, aunque después el banco lo acredite: la acreditación
real no tiene dónde quedar registrada. El modelo ya tiene las columnas
`cobranza.estado_cambiado_por` y `cobranza.estado_cambiado_at`, y la tabla `audit_log` con su
trigger de solo agregado, pero ninguna de las dos se usa todavía.

## What Changes

- Nuevo `PATCH /cobranzas/{id}/estado`, exclusivo de Administración, con `estado` y `justificacion`
  obligatoria. Las transiciones válidas son `ACREDITADO → OBSERVADO`, `ACREDITADO → RECHAZADO`,
  `OBSERVADO → ACREDITADO`, `OBSERVADO → RECHAZADO` y `RECHAZADO → ACREDITADO`; cualquier otra,
  incluido el cambio al mismo estado, se rechaza con 422.
- La actualización modifica la cobranza original y nada más: `estado`, `estado_cambiado_por` y
  `estado_cambiado_at`, más `causa` cuando el estado nuevo no está acreditado. No crea cobranza,
  pagador ni imputación, y no toca importe, titular, fecha, medio ni inscripción.
- Se rechaza con 422 la transición no permitida, el cambio al mismo estado y la justificación
  vacía; con 404 la cobranza inexistente; con 401/403 la falta de sesión o de rol.
- Historial de modificaciones: se reutiliza `audit_log`, que ya es inmutable por trigger, con
  `accion = "cobranza.estado_cambiado"`, `entidad = "cobranza"`, `entidad_id` y un `detalle` JSON
  con estado anterior, estado nuevo, justificación y fecha de la modificación. **No hace falta
  migración Alembic.**
- Frontend: acción `Editar estado` en todas las filas del historial. Abre un modal con titular,
  alumno imputado, importe, fecha y estado actual, un selector que solo ofrece los destinos
  válidos para el estado actual, la justificación obligatoria y un paso de confirmación antes de
  guardar. Con la respuesta exitosa se actualiza la fila; si falla, el error se muestra en el
  modal y no se cambia nada.
- Los indicadores que dependen de pagos acreditados —el último pago imputado de la ficha de
  habilitación— siguen leyendo `GET /cobranzas` y filtrando por `ACREDITADO`, así que una cobranza
  observada o rechazada deja de contarse sin cambios de código y queda cubierto por prueba.

**Fuera de alcance:** editar importe, titular, fecha, medio o inscripción; eliminar pagos; crear
cobranzas nuevas al cambiar el estado; acreditar automáticamente (HU 24); consultar el historial
de cambios por API o por pantalla.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `cobranzas`: edición del estado de una cobranza registrada, con transiciones acotadas y
  auditoría inmutable.
- `admin-shell`: la acción `Editar estado` y su modal en el `Historial de Ingresos Registrados`.

## Impact

Backend: `app/schemas/cobranzas.py`, `app/services/cobranzas.py`, `app/api/cobranzas.py` y tests
de API nuevos. Frontend: `dataService`, `apiDataSource`, `mockDataSource`, `PaymentsPage` y sus
tests. Sin migración, sin cambios de navegación ni de identidad visual.
