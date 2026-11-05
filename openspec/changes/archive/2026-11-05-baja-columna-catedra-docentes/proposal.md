# Proposal

## Why

La columna `CÁTEDRA O ESPECIALIDAD` del padrón de docentes no la puede llenar nadie: el modelo de
docente no registra ese dato, la fuente devuelve `null` y la pantalla muestra un guion. Se elimina
para no mostrar una columna vacía en una pantalla que Secretaría usa a diario.

## What Changes

- **BREAKING** El listado de `Docentes` pierde la columna `CÁTEDRA O ESPECIALIDAD`; las columnas
  quedan, en orden literal, `DOCENTE`, `DNI`, `CUIL`, `EMAIL`, `TELÉFONO`, `COMISIONES ASIGNADAS`,
  `ESTADO` y `ACCIONES`.
- Las filas del maquetado pierden sus especialidades (`Programación`, `Desarrollo Web`,
  `Marketing`, `Datos`); ya no existe dato de cátedra en el ejemplo.
- Se quitan las referencias residuales a `catedra` en mocks, fuentes de datos, tests y comentarios.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `admin-shell`: el requirement `Padrón de docentes` cambia el listado de columnas y las filas del
  maquetado.

## Impact

- `frontend/src/admin/TeachersPage.jsx` (columnas y doc de cabecera)
- `frontend/src/mocks/docentes.js`, `frontend/src/services/mockDataSource.js`,
  `frontend/src/services/apiDataSource.js` (shape de la fila sin `catedra`)
- `frontend/src/admin/TeachersPage.test.jsx` (columnas esperadas, índices de celdas)
- `openspec/specs/admin-shell/spec.md` (delta de este change)
- Sin cambios en backend, API ni base de datos: el campo nunca existió en el modelo.
