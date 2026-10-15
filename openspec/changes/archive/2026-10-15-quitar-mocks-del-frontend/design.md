# Design

## Context

Estado actual y restricciones que explican el enfoque. El motivo está en `proposal.md` — Why.

- La frontera de datos vive en `frontend/src/services/`. `dataSourceFactory.js` resuelve la
  implementación con `resolveApiMode()` (lee `VITE_API_MODE`; por omisión `api`), expone
  `getDataSource()` y `configurarFuenteDeDatos()`. `dataService.js` es el único módulo del que
  las pantallas sacan datos.
- `apiDataSource.js` envuelve las lecturas con `conEjemploEnAusencia(api)` (línea 289): ante un
  404 delega en `createMockDataSource()`. El `Set ESCRIBEN` (línea 66) existe **solo** para
  excluir las escrituras de ese envoltorio: se usa únicamente en la línea 304, no hay otro
  consumidor de `ESCRIBEN` ni de `conEjemploEnAusencia` (verificado por grep en todo el frontend).
- `createDataSource()` se ejecuta al importar el módulo (`let fuenteDeDatos = createDataSource()`,
  línea 67). El modo por omisión tiene que construirse **sin entorno**, porque el import no puede
  depender de variables de Vite.
- `src/mocks/**` y `services/mockDataSource.js` son el **default de la suite**: `test/setup.js` y
  `test/support.jsx` llaman a `createDataSource({ modo: API_MODE.MOCK })`.
- Doce pantallas consumen la frontera. Cinco no manejan el rechazo (`admin/StudentsPage.jsx`,
  `admin/PaymentsPage.jsx`, `admin/AccessPage.jsx`, `alumno/StudentCoursesPage.jsx`,
  `docente/TeacherCommissionsPage.jsx`) y siete más tienen guardas de `null` pero tampoco capturan
  la promesa rechazada.
- El spec vigente `dev-infrastructure` documenta la caída al ejemplo como contrato (requirement
  "Estructura del frontend y capa de datos intercambiable", escenarios "Lectura sin endpoint cae
  al ejemplo" y "La fuente real es el modo por defecto"). Este change lo modifica; ver
  `proposal.md`.

## Goals / Non-Goals

**Goals:**

- Que toda lectura de la app resuelva contra la API real: un fallo —incluido el 404— se propaga
  como `DataSourceError` y ninguna pantalla pinta datos de ejemplo en su lugar.
- Sacar `mock` como modo elegible por el entorno de ejecución sin romper la suite.
- Que ninguna pantalla deje un rechazo sin manejar ni quede colgada en su estado de carga.
- Conservar `src/mocks/**`, `mockDataSource.js` y `API_MODE.MOCK` como infraestructura de test.

**Non-Goals:**

- No se implementa ningún endpoint de backend ni se completa la funcionalidad de las pantallas que
  queden vacías.
- No se tocan los métodos de escritura ni sus endpoints.
- No se introduce un sistema de errores de UI nuevo.
- No se editan los specs de los tres shells (`admin-shell`, `student-shell`, `teacher-shell`) en
  este change; describen las pantallas pobladas con datos del cliente y quedan como están (ver
  Risks / Trade-offs).

## Decisions

### 1. Se elimina el envoltorio de caída al ejemplo; no se desactiva

**Decisión:** en `apiDataSource.js` borrar `conEjemploEnAusencia` (líneas 292-324), su import de
`createMockDataSource` (línea 3) y el `Set ESCRIBEN` (líneas 60-73), que queda muerto.
`createApiDataSource()` devuelve `api` directamente (línea 289).

**Por qué:** el envoltorio y el `Set` existen el uno para el otro y no tienen otro consumidor. Un
flag que siempre sea falso, o un `Set` sin usuarios, es código y comentarios que narran un camino
que ya no existe: deuda silenciosa en el archivo que el repo usa para documentar el porqué.

**Alternativas descartadas:**

- Dejar el envoltorio con una bandera apagada: conserva el import y el `Set` vivos sin uso y deja
  otro lugar donde una futura lectura crea que el fallback existe.
- Mover la sustitución por "datos vacíos" adentro del envoltorio: es la capa equivocada. La
  pantalla ya sabe pintar su estado vacío y es ella la que decide qué mostrar cuando no hay datos.

### 2. Se retira `VITE_API_MODE`; `createDataSource()` usa `api` por omisión

**Decisión:** eliminar `resolveApiMode()` (líneas 40-42) y la lectura de entorno. La firma queda
`createDataSource({ modo = API_MODE.API, implementaciones = IMPLEMENTACIONES } = {})`. Se conserva
el parámetro `modo`, el objeto `API_MODE` (con `MOCK` y `API`) y la entrada
`[API_MODE.MOCK]: createMockDataSource` de `IMPLEMENTACIONES`.

**Por qué:** el objetivo es que `mock` deje de ser un modo elegible por la app. Mantener la
variable reintroduce exactamente eso. El default `API_MODE.API` mantiene la construcción al
importar el módulo (línea 67) sin depender del entorno, y `createDataSource({ modo: API_MODE.MOCK
})` sigue funcionando para `test/setup.js` y `test/support.jsx`.

**Alternativas descartadas:**

- (b) Conservar `VITE_API_MODE` con default `api` y `mock` solo explícito: el entorno seguiría
  publicando un modo que la aplicación no debe poder elegir, y el valor de la variable dejaría de
  describir lo que el sistema hace (el mismo problema que `docs/decisions.md` ya marcó para
  `VITE_API_MODE`).

**Impacto en configuración:** `.env.example` (líneas 84-87) pierde `VITE_API_MODE`;
`docker-compose.yml` (línea 96) deja de publicarla y se actualiza el comentario de `depends_on`
(líneas 113-114), que hoy dice que el frontend usa datos de ejemplo.

### 3. Las pantallas degradan con el estado vacío que ya tienen; el `catch` resuelve el loading

**Decisión:** en cada consumidor, capturar el rechazo y dejar el estado en su valor vacío,
resolviendo además la bandera de carga. No se agrega ningún componente, contexto ni hook de
errores.

**Por qué:** todas las pantallas excepto los dos bloques secundarios de tabla ya pintan un estado
vacío propio; reusarlo es una línea por llamada y deja el comportamiento consistente. El estado
vacío es la degradación honesta de "no hay dato", que es lo que pasa cuando el endpoint no existe.

**Detalle por pantalla:**

| Pantalla | Llamada | Comportamiento tras el rechazo | Qué se ve |
| --- | --- | --- | --- |
| `admin/StudentsPage.jsx` | `buscarAlumnos` (106) y `listarEmpresas` (110) | `.catch` deja `alumnos`/`empresas` en `[]` | `vacio` de la tabla de alumnos ("No se encontraron resultados."); la tabla de empresas queda sin filas (sin `vacio` hoy) |
| `admin/PaymentsPage.jsx` | `listarCobranzas` y `listarAlumnos` (103-104) | `.catch` deja ambas listas en `[]` | historial y selector vacíos; la tabla de cobranzas no tiene `vacio` hoy |
| `admin/AccessPage.jsx` | `consultar()` → `buscarHabilitacion` y `listarCobranzas` (83) | `try/catch`: `setResultado(null)` y `setAviso(...)` | reutiliza el `aviso` existente: es una acción del usuario y "Sin consulta" mentiría |
| `alumno/StudentCoursesPage.jsx` | `listarInscripcionesAlumno` (83) | `.catch` → `setCargadas(true)` | mensaje `SIN_INSCRIPCIONES` (el estado vacío que la pantalla ya sabe pintar) |
| `docente/TeacherCommissionsPage.jsx` | `obtenerComisionesAsignadas` (73) | `.catch` → `setComisiones([])` | indicadores en `0`/`—`, `vacio` de la tabla y agenda vacía |
| `alumno/CourseDetailPage.jsx` | `obtenerDetalleInscripcion` (59) | `.catch` → `setBuscado(true)` | "No estás inscripto en este curso." (estado ya cargado) |
| `alumno/StudentPaymentsPage.jsx` | `listarPagosAlumno` (86) y `listarInscripcionesAlumno` (90) | `.catch` → `setCargados(true)` y `setCursos([])` | mensaje `SIN_PAGOS` |
| `alumno/StudentProfilePage.jsx` | `obtenerPerfilAlumno` (43) | `.catch` no asigna: `perfil` sigue `null` | "No hay ningún alumno para mostrar." |
| `docente/AttendancePage.jsx` | `obtenerComisionesAsignadas` (44) | `.catch` no asigna: `asistencia` sigue `null` | "No hay ninguna comisión asignada…" |
| `docente/CommissionDetailPage.jsx` | `obtenerPadronComision` (64) | `.catch` → `setPadron(null)` | "No hay ninguna comisión con ese código." |
| `docente/TeacherProfilePage.jsx` | `obtenerPerfilDocente` (52) | `.catch` no asigna: `perfil` sigue `null` | "No hay ningún docente para mostrar." |
| `docente/TeacherStudentsPage.jsx` | `obtenerComisionesAsignadas` (45) | `.catch` → `setComisiones([])` | `vacio` de la tabla |

**Qué pasa con `loading`:** las pantallas con bandera de carga (`cargadas` en
`StudentCoursesPage` y `StudentPaymentsPage`, `buscado` en `CourseDetailPage`) la resuelven dentro
del `catch`, porque si no quedarían mostrando "Buscando…" para siempre. Las pantallas sin bandera
no tienen estado de carga que resolver: su valor inicial ya es el estado vacío.

**Alternativas descartadas:**

- Un `ErrorBoundary` o un estado de error global por pantalla: introduce un sistema nuevo para un
  caso que el estado vacío ya cubre.
- Mensaje de error visible en las doce pantallas: el spec no lo exige y duplicaría la UI de error
  en cada una. Se usa solo donde la acción es explícita del usuario (`AccessPage`).

### 4. Los mocks quedan como infraestructura de test y se corrigen los comentarios que mienten

**Decisión:** conservar `frontend/src/mocks/**`, `frontend/src/services/mockDataSource.js`,
`API_MODE.MOCK` y la entrada mock de `IMPLEMENTACIONES`. Actualizar los comentarios que narran el
fallback como si siguiera vivo: la cabecera de `apiDataSource.js` (líneas 5-26), el comentario de
`obtenerPerfilDocente` (líneas 242-246), la cabecera de `dataSourceFactory.js` (líneas 4-21) y el
de `mocks/index.js` (líneas 9-13).

**Por qué:** el fallback por 404 deja de ser cierto; un comentario que miente es deuda y este
repo documenta el porqué en comentarios.

**Alternativas descartadas:**

- Borrar `src/mocks/**` y `mockDataSource.js`: rompe la suite entera, que es el default de los
  tests. El change saca los mocks del recorrido de ejecución, no de la suite.

**Nota de compatibilidad:** `mocks/mocksBoundary.test.js` sigue pasando. El único import de
`mocks` en la capa de servicios que matchea el patrón (`'../mocks'`) vive en `mockDataSource.js`
(línea 13); el test que exige "la capa de servicios importa los mocks" sigue teniendo su caso.

### 5. Tests: se reemplaza la caída al ejemplo por la propagación del 404

**Decisión:** en `apiDataSource.test.js` reemplazar el `describe('las lecturas caen al ejemplo
solo con 404')` por un caso que afirme que el 404 se propaga con su `status`
(`rejects.toMatchObject({ status: 404 })`), conservando la propagación de 500 y del error de
conexión. El `describe('los POST nunca caen al ejemplo')` se reduce a los casos que siguen siendo
contrato (500, error de conexión y el `detail` de 422); se elimina el caso "no escribe en el
ejemplo aunque el método de lectura sí sepa hacerlo", porque el método de lectura ya no cae. En
`dataService.test.jsx` se quita el import y los `it` de `resolveApiMode`; se conservan los
`createDataSource({ modo: API_MODE.MOCK })` y los `it` de la implementación de ejemplo.

**Por qué:** el contrato que queda es "todo fallo se propaga". Lo que importa conservar es que un
500 o una caída de red no se disfracen de dato válido, y que el `detail` del backend suba tal cual.

**Alternativas descartadas:**

- Borrar `apiDataSource.test.js` entero: perdería la cobertura de rutas del contrato y de
  propagación de errores, que sigue siendo válida.

### 6. Decisión a registrar en `docs/decisions.md`

Este change **modifica D36** (se retira el atajo) y registra una decisión nueva con el próximo id
libre (**D42**; se confirma al registrar). Texto propuesto, en el formato del documento:

> **Modificación de D36 — El modo por defecto de los datos es la API, y lo que falta se propaga**
>
> - **Decisión:** se retira la caída al ejemplo. `resolveApiMode()` y `VITE_API_MODE` desaparecen:
>   la fuente de ejecución es siempre la API real y un 404 se propaga como cualquier otro error.
>   Este change revierte el "techo" que D36 dejó anotado.
> - **Por qué:** el atajo existía para no dejar media pantalla vacía mientras faltaban los
>   endpoints. El equipo priorizó que ninguna pantalla muestre maqueta como si fuera un dato.
> - **Dónde:** `frontend/src/services/apiDataSource.js`,
>   `frontend/src/services/dataSourceFactory.js`, `.env.example`, `docker-compose.yml`.

> **D42 — Los mocks pasan a ser infraestructura de test, no una fuente elegible**
>
> - **Decisión:** `src/mocks/**` y `src/services/mockDataSource.js` se conservan solo para la
>   suite. `API_MODE.MOCK` sigue existiendo para que los tests pidan el modo explícitamente, pero
>   la aplicación de ejecución no puede seleccionarlo.
> - **Por qué:** los datos de ejemplo siguen siendo el default de los tests de pantalla; lo que se
>   elimina es la posibilidad de que la app corra sobre ellos.
> - **Dónde:** `frontend/src/services/dataSourceFactory.js`, `frontend/src/mocks/index.js`,
>   `frontend/src/test/setup.js`, `frontend/src/test/support.jsx`.

## Risks / Trade-offs

- **Cambio BREAKING del comportamiento observable.** Dejan de funcionar los recursos sin endpoint:
  alumnos, empresas, cobranzas, habilitación, mis-comisiones, padrón de comisión, asistencia, link
  de clase e inscripciones/pagos/perfil del alumno. Es el resultado buscado, pero la app deja de
  verse "completa". → Mitigación: las pantallas degradan a su estado vacío y no cuelgan (Decisión
  3).
- **El estado vacío enmascara fallos.** Un `.catch` que deja el estado en su valor vacío hace
  indistinguible "no hay datos" de "la consulta falló". → Trade-off aceptado por ahora; el estado
  vacío es el piso, no el mensaje. Si el spec nuevo pide un mensaje por pantalla, es agregar el
  `aviso`/`vacio` que la pantalla ya sabe usar. Ver Open Questions.
- **Conflicto con los specs de los tres shells.** `admin-shell`, `student-shell` y `teacher-shell`
  describen pantallas pobladas con datos del cliente (filas de alumnos, cobranzas, asistencias,
  comisiones, etc.). Sin la caída al ejemplo esas pantallas quedan vacías. **Este design no
  modifica esos specs**; la contradicción se resuelve cuando existan los endpoints y el shell se
  reespecifique.
- **Rechazos no manejados** en consumidores sin `.catch` → cubiertos en la Decisión 3; si se omite
  uno, Vitest cuenta un error sin dueño y la pantalla queda en carga.
- **Tests a reescribir** (Decisión 5): los casos que afirman la caída por 404 dejan de ser válidos.
- **Lo que NO se toca:** los métodos de escritura del frontend (`registrarCobranza`,
  `guardarLinkClase`, `forzarBloqueoManual`, `crearCurso`, `crearComision`, `crearDocente`) y sus
  endpoints. Su contrato —un alta falla y lo dice— no cambia.

## Migration Plan

- Despliegue del frontend en un solo paso. No hay migración de datos ni de esquema: los mocks no
  son la fuente de la base.
- Efecto inmediato: las pantallas sin endpoint pasan de mostrar el ejemplo a quedar vacías.
- **Rollback:** revertir el commit. Al no haber cambios de backend ni de datos, el rollback es
  solo el código del frontend. La variable `VITE_API_MODE` deja de leerse, así que no hace falta
  limpiar entorno.

## Open Questions

- **Id final de la decisión nueva.** Se propone D42 (próximo libre tras D41); se confirma al
  registrar en `docs/decisions.md`. No cambia specs, enfoque ni tareas.
- **Prosa del README.** `README.md` (líneas 209-212 y 260-261) narra el estado anterior ("solo el
  login habla con el backend", "el resto usa datos de ejemplo"). Se puede actualizar en este
  change o dejarlo a un follow-up de documentación. No cambia specs ni enfoque.
