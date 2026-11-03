# Proposal

## Why

Dos problemas del mismo circuito de cursada quedan sin resolver. Por un lado, el estado de una
comisión no distingue las que ya terminaron: hoy se puede inscribir a un alumno en una comisión
cuya fecha de fin pasó, y Administración no ve qué comisiones siguen vigentes (H/U 70). Por otro,
el prorrateo por alta tardía guarda el importe ya descontado y esa decisión gana sobre la regla de
la beca: cuando la categoría se cambia después del alta, el descuento no se aplica (issue #111).

## What Changes

- Derivar el estado de la comisión (`Vigente`/`Finalizada`) desde `fecha_fin`, en la zona horaria
  `America/Argentina/Buenos_Aires`, sin columna nueva ni job programado.
- Exponer ese estado en la consulta de comisiones y en la vista del docente.
- Rechazar con `422` el alta de inscripción y la carga de nómina corporativa en una comisión
  finalizada, y excluirla del selector de inscripción.
- Mostrar la columna `ESTADO` en la tabla de comisiones de Administración, con chip verde para
  `Vigente` y gris para `Finalizada`, y `—` en `VACANTES` cuando la comisión está finalizada.
- Limitar el selector de comisión del alta de inscripción al curso abierto cuando el modal se abre
  desde `/admin/cursos/:codigo`, sin cambiar el alcance del alta desde la vista de cursos.
- Permitir la reactivación editando `fecha_fin` a una fecha futura, volviendo a correr el chequeo
  de solapamiento del docente con `409` cuando corresponda.
- Corregir el solapamiento del docente para que compare también los períodos: dos comisiones del
  mismo día y horario con rangos de fechas que no se cruzan dejan de ser un conflicto.
- **BREAKING (interno, datos):** `inscripcion.importe_arancel` pasa a guardar el importe
  prorrateado **sin** descuento de beca. El descuento se aplica siempre al derivar el monto
  requerido, así cambiar la categoría no deja un importe viejo. Incluye migración de backfill
  para las inscripciones becadas ya guardadas.
- Mantener sin cambios las inscripciones, pagos, asistencias y estados de habilitación de una
  comisión finalizada; registrar un pago sigue permitido.

## Capabilities

### New Capabilities

### Modified Capabilities

- `domain-schema`: el estado de la comisión se deriva del período (sin columna) y el importe de la
  inscripción se persiste como base prorrateada sin descuento de beca.
- `altas-catalogo`: la consulta informa el estado de cada comisión y el alta valida el
  solapamiento por rango de fechas del docente.
- `edicion-catalogo`: la edición valida el solapamiento por rango de fechas y la reactivación de
  una comisión finalizada vuelve a correr ese chequeo.
- `inscripciones`: el alta se rechaza con `422` en una comisión finalizada y el cambio de
  categoría aplica o quita el descuento de beca sobre el importe base ya guardado.
- `cuentas-corporativas`: la carga de nómina se rechaza con `422` en una comisión finalizada.
- `admin-shell`: la tabla de comisiones agrega `ESTADO`, muestra `—` en `VACANTES` de una
  finalizada y el selector de inscripción no la ofrece.
- `teacher-shell`: la comisión finalizada sigue en la vista del docente con su estado
  `Finalizada`.

## Impact

- Backend: `services/inscripciones.py`, `services/habilitacion.py`, `services/catalogo.py`,
  `services/nomina.py`, `services/docente.py`, `schemas/catalogo.py`, `api/*` y migración Alembic
  con backfill de `importe_arancel`.
- Frontend: `admin/CoursesPage.jsx`, `admin/InscripcionModal.jsx`,
  `admin/CommissionEnrollmentsPage.jsx`, `services/mockDataSource.js` y los mocks de comisiones.
- Pruebas backend de estado por fecha, solapamiento por período, rechazos `422`, backfill y beca
  sobre importe prorrateado; pruebas de pantalla del chip de estado y del selector.
- `docs/decisions.md`: estado derivado por consulta, reactivación por edición de `fecha_fin` y
  semántica de `importe_arancel` como base sin descuento.
- Depende de H/U 49 y H/U 50 (Done). No cambia el alcance del prorrateo ni de la facturación.
