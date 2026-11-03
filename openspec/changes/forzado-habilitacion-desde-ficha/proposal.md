# Proposal

## Why

La pantalla `Habilitación de Accesos` fuerza el estado **del alumno** con un endpoint que nunca
existió en el backend (`/habilitaciones/override/{alumnoId}`), mientras que el modelo real
(`OverrideHabilitacion`) relaciona el forzado con **una inscripción**. El equipo acordó retirar la
pantalla independiente y administrar el forzado desde la ficha del alumno, donde la categoría, el
estado y los importes ya se leen por inscripción.

## What Changes

- **BREAKING** (solo interfaz): se elimina la sección `Habilitación de Accesos`, su ítem del menú
  lateral y la ruta `/admin/habilitacion`. La URL anterior responde la pantalla 404 existente. El
  panel de Administración queda con cinco secciones.
- Se agrega un lápiz junto a `Estado de habilitación` en `Ver ficha`, con el mismo patrón visual del
  lápiz de `Categoría arancelaria`. Solo aparece en inscripciones `ACTIVA`.
- El lápiz abre un modal que muestra alumno, comisión, estado automático, estado efectivo, el
  indicador de forzado y el motivo vigente. Permite forzar el estado contrario al automático con
  motivo obligatorio y confirmación, y volver a la regla automática.
- Se agregan dos endpoints reales sobre la inscripción: forzar y quitar el forzado. El
  administrador sale de la sesión autenticada y la operación se serializa con bloqueo transaccional.
- Se retira la función provisional `forzarBloqueoManual` del frontend y se reemplaza por las
  operaciones por inscripción en `dataService`, `apiDataSource` y `mockDataSource`.
- El cálculo automático, los pagos, los saldos, las cobranzas y las demás pantallas no cambian.
  `OverrideHabilitacion` y `AuditLog` se reutilizan; el esquema actual alcanza.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `admin-shell`: el menú pasa de seis a cinco secciones y desaparece el requisito de la pantalla
  `Habilitación de Accesos`; la ficha del alumno suma la edición del estado de habilitación.
- `inscripciones`: se agregan los requisitos de forzado manual por inscripción y de retorno a la
  regla automática, con permisos, validaciones y auditoría.
- `padron-alumnos`: el detalle del alumno informa, además del estado efectivo, el estado calculado
  automáticamente y el motivo del forzado vigente.

## Impact

- Backend: `app/services/habilitacion.py`, `app/schemas/alumnos.py`,
  `app/schemas/inscripciones.py`, `app/api/inscripciones.py`, `app/services/alumnos.py` y
  `app/services/inscripciones.py`. Sin migración: `override_habilitacion` ya tiene las columnas.
- Frontend: `App.jsx`, `admin/navegacion.js`, `admin/AccessPage.jsx` (baja),
  `admin/FichaAlumnoModal.jsx`, `admin/StudentsPage.jsx`, nuevo modal de habilitación,
  `services/dataService.js`, `services/apiDataSource.js`, `services/mockDataSource.js` y tests.
- Contratos: `POST /inscripciones/{id}/habilitacion` y `DELETE /inscripciones/{id}/habilitacion`.
- Datos: no se alteran filas existentes; quitar el forzado desactiva la fila histórica y deja
  auditoría.
