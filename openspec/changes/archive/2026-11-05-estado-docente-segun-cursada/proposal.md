# Proposal

## Why

La columna `ESTADO` del padrón de docentes muestra hoy `Activo` mientras el docente no tenga la
baja lógica aplicada, sin decir nada sobre si está dando clases. El cliente necesita que el estado
responda a la cursada real: el profesor está activo cuando tiene una comisión en curso, e inactivo
cuando no.

## What Changes

- **BREAKING** `GET /docentes` deja de filtrar `activo = true` y pasa a devolver **todos** los
  docentes, incluidos los dados de baja.
- **BREAKING** La fila de `GET /docentes` suma el campo `cursando: boolean`, derivado en backend de
  que el docente tenga al menos una comisión **Vigente** asignada (`fecha_fin >= hoy` en
  `America/Argentina/Buenos_Aires`, o sin `fecha_fin`).
- La columna `ESTADO` del padrón muestra `Activo` (verde) cuando `cursando` es verdadero e
  `Inactivo` (gris) cuando no. La baja lógica coexiste como concepto reservado para cuando se
  implemente; hoy no hay baja lógica forzada para docentes.
- El listado de `Docentes` muestra a todos los docentes; ya no oculta a los no activos.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `padron-docentes`: el requirement `Solo docentes activos` cambia a listar todos los docentes y el
  requirement `Comisiones asignadas en la respuesta` suma `cursando`.
- `admin-shell`: el requirement `Padrón de docentes` cambia la regla de la columna `ESTADO` y el
  filtro del listado.

## Impact

- Backend: `app/services/padron.py` (`listar_docentes`, `_asignar_comisiones`),
  `app/schemas/padron.py` (`DocenteOut.cursando`), tests del listado.
- Frontend: `apiDataSource.js` y `mockDataSource.js` (fila con `cursando`),
  `TeachersPage.jsx` (badge), `TeachersPage.test.jsx` y `mocks/`.
- Specs: `openspec/specs/padron-docentes/spec.md`, `openspec/specs/admin-shell/spec.md`.
- Sin migraciones: no hay cambios de esquema; `cursando` es derivado de `comision.fecha_fin`.
