# Proposal

## Why

La categoría arancelaria se define por inscripción desde la HU 15, pero el padrón, la consulta de
habilitación y el alta de inscripción la tratan como si fuera única por alumno: `GET /alumnos`
devuelve una sola comisión y una sola categoría, el alta de inscripción guarda siempre
`PARTICULAR` y la ficha de Accesos muestra una única cursada. Un alumno cubierto al 100% por un
paquete empresarial que además cursa otro curso por su cuenta no se puede leer ni administrar
correctamente. Además, el padrón muestra una categoría que ya no pertenece a la fila del alumno y
que la ficha de detalle (HU 61) va a mostrar por inscripción.

## What Changes

- **BREAKING** `GET /alumnos` deja de devolver `comision`, `categoria`, `porcentaje_beca` y
  `acceso`: devuelve solo los datos del alumno. El listado reusa por dentro el mismo servicio del
  detalle, pero no expone datos de inscripción.
- Nuevo `GET /alumnos/{id}` con el alumno y sus inscripciones: comisión, categoría, porcentaje de
  beca, empresa y estado de habilitación derivado con su causa.
- `POST /inscripciones` acepta `porcentaje_beca` y `empresa_id` y aplica las mismas reglas que el
  `PATCH`: beca parcial exige un porcentaje entre 1 y 99 y corporativo exige empresa; el alta
  rechaza una inscripción que no las cumpla.
- El modal de inscripción de Comisiones pide la categoría arancelaria y, según la categoría, el
  porcentaje de beca o la empresa, con la posibilidad de dar de alta una empresa sin perder el
  formulario.
- El padrón de alumnos pierde las columnas `COMISIÓN ASIGNADA`, `CATEGORÍA ARANCELARIA` y `ACCESO
  PLATAFORMA`; queda con DNI, nombre, email y teléfono.
- La acción **Categoría** del padrón elige la inscripción cuando el alumno tiene más de una y
  aplica el cambio solo a la elegida.
- La consulta de habilitación muestra una sección por inscripción `ACTIVA`, cada una con curso,
  categoría, estado y causa, y su búsqueda deja de depender de una ruta de habilitación inexistente:
  resuelve contra el padrón y las cuentas corporativas.
- El selector de inscripción de Cobranzas muestra la categoría y el estado de cada inscripción,
  además de la comisión.

**Desviación consciente del criterio de aceptación:** la historia pide que el padrón muestre cada
inscripción con su comisión, categoría y acceso por separado. Se resolvió que el padrón quede con
una fila por alumno y sin datos de inscripción, y que el detalle por inscripción se vea en
`GET /alumnos/{id}`, en la consulta de habilitación y, desde la HU 61, en la ficha del alumno. Se
evita duplicar al alumno en la tabla y una categoría que no corresponde a la fila.

## Capabilities

### New Capabilities

- `inscripciones`: alta, categorización y consulta de las inscripciones de un alumno, con las reglas
  de beca parcial y empresa corporativa y la lista de inscripciones disponibles para imputar pagos.

### Modified Capabilities

- `padron-alumnos`: cambia el contrato de `GET /alumnos` y se agrega el detalle del alumno con sus
  inscripciones.
- `admin-shell`: cambian la tabla del padrón de alumnos, la acción de categoría, el alta de
  inscripción, la ficha de habilitación por inscripción y el selector de inscripción de Cobranzas.

## Impact

- Backend: `app/api/alumnos.py`, `app/services/alumnos.py`, `app/schemas/alumnos.py`,
  `app/api/inscripciones.py`, `app/services/inscripciones.py`, `app/schemas/inscripciones.py`, y los
  tests de padrón, inscripciones, habilitación y cobranzas.
- Frontend: `src/admin/StudentsPage.jsx`, `src/admin/AccessPage.jsx`,
  `src/admin/CoursesPage.jsx`, `src/admin/PaymentsPage.jsx`, `src/services/dataService.js`,
  `src/services/apiDataSource.js`, `src/services/mockDataSource.js`, `src/mocks/alumnos.js`,
  `src/mocks/inscripciones.js` y los tests de esas pantallas.
- Contrato: los consumidores de `GET /alumnos` —el padrón y la consulta de habilitación— migran al
  detalle por alumno.
- Datos: sin migración. El esquema de `inscripcion` ya soporta categoría, porcentaje y empresa. La
  decisión de contrato se registra en `docs/decisions.md`.
- Fuera de alcance: el forzado manual de habilitación por inscripción. La acción sigue como está y
  su endpoint y su regla por sección son la H/U 30.
