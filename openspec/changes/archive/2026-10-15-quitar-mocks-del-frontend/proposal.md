# Proposal

## Why

Hoy la app no corre sobre datos reales: el modo por defecto es `api`, pero toda lectura que
devuelve 404 cae al ejemplo (D36), y el entorno todavía puede seleccionar el modo `mock` (lo
contrario de D14). El equipo quiere que la página use datos reales de PostgreSQL al 100% antes de
avanzar, sin que una pantalla sin endpoint muestre maqueta como si fuera un dato.

## What Changes

- **BREAKING** — Las lecturas dejan de caer al ejemplo ante un 404: el fallo se propaga como
  cualquier otro error y la pantalla no muestra datos de ejemplo en su lugar.
- **BREAKING** — Los mocks dejan de ser una fuente de datos elegible por la app: la fuente de
  datos de ejecución pasa a ser siempre la API real y el entorno deja de publicar un modo `mock`
  para la aplicación.
- Las pantallas que hoy dependían de la caída al ejemplo pasan a degradar con estado vacío o
  mensaje de error, sin dejar rechazos sin manejar (varios consumidores no manejan el error hoy).
- Se conservan `frontend/src/mocks/**` y `frontend/src/services/mockDataSource.js` **solo como
  infraestructura de test**; no se borran porque son el default de la suite del frontend.
- El comportamiento de los métodos de escritura del frontend y de sus endpoints no cambia.

### Non-goals

- No se implementan endpoints nuevos de backend.
- No se tocan los métodos de escritura (`registrarCobranza`, `guardarLinkClase`,
  `forzarBloqueoManual`) ni sus endpoints.
- No se borran los mocks ni se migran sus datos al seed; la base PostgreSQL es la fuente.
- No se eliminan las rutas provisionales de endpoints que todavía no existen.

## Capabilities

### New Capabilities
- Ninguna.

### Modified Capabilities
- `dev-infrastructure`: el requirement "Estructura del frontend y capa de datos intercambiable"
  cambia — la fuente real pasa a ser la única fuente de la app y las lecturas sin endpoint ya no
  caen al ejemplo.

## Impact

- **Spec**: `openspec/specs/dev-infrastructure/spec.md` — cambian el requirement y los escenarios
  "Lectura sin endpoint cae al ejemplo", "La fuente real es el modo por defecto" y "Solo el login
  es real".
- **Código (frontend)**: `frontend/src/services/apiDataSource.js` (caída al ejemplo),
  `frontend/src/services/dataSourceFactory.js` (selección de modo) y las pantallas que consumen
  la frontera sin manejo de error: `frontend/src/admin/{StudentsPage,PaymentsPage,AccessPage}.jsx`,
  `frontend/src/alumno/{StudentCoursesPage,CourseDetailPage,StudentPaymentsPage,StudentProfilePage}.jsx`
  y `frontend/src/docente/{TeacherCommissionsPage,AttendancePage,CommissionDetailPage,TeacherProfilePage,TeacherStudentsPage}.jsx`.
- **Tests (frontend)**: `frontend/src/services/apiDataSource.test.js` (el caso de la caída al
  ejemplo por 404 deja de ser válido), la suite de la fábrica y `dataService.test.jsx`.
  `frontend/src/test/setup.js` y `frontend/src/test/support.jsx` conservan el modo mock para la
  suite.
- **Decisiones**: `docs/decisions.md` — D36 se modifica (se retira el atajo de caída al ejemplo) y
  se registra una decisión nueva.
- **Config**: el modo por defecto de datos del frontend y su variable de entorno.

## Risks

- **Pantallas sin datos**: los recursos sin endpoint (alumnos, empresas, cobranzas, habilitación,
  mis-comisiones, padrón de comisión, asistencia, link de clase, inscripciones/pagos/perfil del
  alumno) van a verse vacíos o con error. Es el resultado buscado, pero la app deja de verse
  "completa".
- **Rechazos no manejados**: sin el fallback, los consumidores que no manejan el error producen
  errores no manejados y pantallas colgadas; hay que cubrirlos.
- **Tests a reescribir**: los tests que afirman la caída al ejemplo por 404 y el default mock de la
  app dejan de ser válidos y hay que actualizarlos.

## Assumptions

- Los mocks no se borran: quedan como infraestructura de test (`src/mocks/**` +
  `mockDataSource.js`), que es lo que hoy usa `frontend/src/test/setup.js`. El change los saca del
  recorrido de ejecución de la app, no de la suite.
- Las pantallas sin endpoint pueden quedar sin funcionar: el objetivo es quitar el ejemplo del
  camino de datos, no completar la funcionalidad.
