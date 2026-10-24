# Proposal

## Why

Una comisión se puede crear y consultar, pero no corregir. Si la secretaría se equivoca en el docente,
los días y horarios, el arancel o el cupo máximo, hoy tiene que dar de baja la comisión y crearla de
nuevo, con lo que se pierden las inscripciones y los pagos ya registrados. La historia #4 pide editar
esos datos sin tocar lo que ya pasó.

La reducción de cupo tiene una regla propia: no puede dejar la comisión con más inscriptos que
lugares. El sistema tiene que rechazarla e informar cuántos inscriptos hay, no aceptar un cupo que la
tabla después mostraría como negativo.

## What Changes

- Nuevo `PUT /comisiones/{id}`, exclusivo de Administración: actualiza docente, días y horarios,
  arancel y cupo máximo. El curso, el número, la modalidad y la sede no forman parte del contrato; un
  campo de más responde `422`.
- El `docente_id` SHALL ser obligatorio, igual que en el alta. Un docente o una comisión inexistente
  responden `404`; un cupo o arancel no positivos responden `422`; un `dias_horarios` vacío responde
  `422`.
- La reducción de cupo se valida contra las inscripciones **ACTIVA**, el mismo criterio que usan
  `VACANTES` y el chip `LLENO`. Si el nuevo cupo es menor que la cantidad de inscriptos activos, la
  API responde `422` e informa la cantidad actual. La respuesta exitosa trae la comisión actualizada
  con sus vacantes recalculadas.
- La tabla de comisiones agrega una columna `ACCIONES` con el botón **Editar**. El modal
  **Editar Comisión** abre con los valores actuales de docente, días y horarios, cupo y arancel, sin
  curso, modalidad, sede ni código, y muestra la cantidad de inscriptos actuales para que la
  secretaría vea el límite antes de guardar. Un rechazo deja el modal abierto con el motivo; un
  guardado exitoso actualiza la fila.
- Sin migración: `docente_id`, `dias_horarios`, `cupo_maximo`, `arancel` y las inscripciones ya
  existen.

**Fuera de alcance:** editar modalidad o sede, cambiar el curso o el número de la comisión, dar de
baja una comisión, modificar inscripciones o pagos y cualquier cambio en el alta.

## Capabilities

### New Capabilities

- `edicion-catalogo`: edición administrativa de una comisión, incluida la validación de cupo contra
  las inscripciones activas.

### Modified Capabilities

- `admin-shell`: la tabla de comisiones incorpora la columna `ACCIONES` y el modal de edición de
  comisión. Este change asume aplicada la HU 3, que ya incorporó el menú `⋮` y la edición de curso.

## Impact

- **Backend:** `PUT /comisiones/{id}` en `app/api/catalogo.py`, `ComisionUpdate` en
  `app/schemas/catalogo.py`, `editar_comision` en `app/services/catalogo.py` y pruebas `pytest`
  contra PostgreSQL real, incluidas la autorización y la concurrencia de cupo.
- **Frontend:** `CoursesPage`, `src/services/dataService.js`, `apiDataSource`, `mockDataSource` y
  pruebas `vitest` del modal, la validación de cupo y la actualización visible.
- **Documentación:** `docs/decisions.md` registra el criterio de ocupación del cupo y el `422` con la
  cantidad actual de inscriptos.
- **Backlog:** el PR usa `Refs #4` y solo pasa a `Closes #4` si se cumplen todos los criterios.
