# Proposal

## Why

El change `quitar-mocks-del-frontend` sacó los datos de ejemplo del camino de datos en ejecución, pero
las **pantallas mismas** todavía tienen datos de negocio inventados escritos como literales y los
pintan como si fueran datos del usuario. Lo encontró un alumno: al recargar `Mis Cursos`, el tablero
aparecía un instante con números falsos (`1` curso, `1` comprobante por `$31.000`, `Lun y Miér · 18:30
a 21:30`) antes de que la consulta fallara (`StudentCoursesPage.jsx:114` pinta el tablero mientras
`cargadas === false`). Cada uno de esos literales está **mandado por los specs de los tres shells y por
D40** («Las fechas y la `Última actualización` quedan literales placeholders»), así que no es un bug:
es un contrato que hay que cambiar. Este change es la continuación directa del anterior y resuelve la
contradicción que aquel design dejó anotada (los tres shells describen pantallas pobladas con datos que
ya no existen): en vez de vaciar las pantallas, **conserva su forma y marca con `—` lo que ninguna
fuente respalda**.

## What Changes

- El tablero de Secretaría **conserva su fila de cuatro tarjetas**: `COMISIONES` derivada del catálogo
  real (`obtenerResumenCatalogo()`) y las tarjetas `ALUMNOS INSCRIPTOS`, `COBROS PENDIENTES DE COBRO` y
  `CUPO PROMEDIO OCUPADO` con el valor `—`, porque ningún endpoint respalda sus valores. El bloque
  `Alertas de Gestión Pendiente` vuelve con su encabezado y su cuerpo en `—`; las cuatro alertas
  inventadas no vuelven. `Accesos Rápidos del Personal` sigue como composición inerte, igual que la
  búsqueda y la campana del armazón.
- El tablero del alumno **conserva su forma y no colapsa a su estado vacío**: mantiene cuatro tarjetas
  —`CURSOS EN MARCHA` (conteo real de inscripciones, con un `0` real cuando no hay ninguna), `ACCESO A
  LA CLASE` (estado real de la inscripción, o `—` cuando no hay ninguna), `COMPROBANTES ACREDITADOS`
  (vuelve; `—`, porque no existe ningún endpoint de pagos del alumno que lo respalde) y `PRÓXIMA CLASE`
  (clase real, o `—` cuando no hay ninguna)—. El bloque `Tu agenda` queda siempre visible y cae a su
  propio mensaje de vacío, y la sección de cursos conserva su mensaje cuando el alumno no tiene
  inscripciones.
- **BREAKING** — Regla general: **ninguna pantalla elimina un elemento porque su dato no exista
  todavía**. La pantalla conserva su forma y, donde la fuente no puede responder, el valor es `—`.
  Donde la fuente responde, se muestra el valor real, incluido un `0` real. El valor `—` significa
  "todavía no lo sé" y SHALL NOT significar "cero"; un valor que ninguna fuente respalde no se muestra
  nunca. Mientras una lectura no haya resuelto, el valor afectado es `—`, nunca un `0` ni un literal.
- El tablero del docente se **conserva tal como está**: cuatro tarjetas con `0` / `—`, los estados
  vacíos de `Comisiones asignadas` y `Tu agenda`, y la fecha real del encabezado.
- Las tres líneas de fecha de los encabezados dejan de ser literales y pasan a ser la **fecha real del
  día**, con un helper nuevo en `frontend/src/utils/formato.js` en el estilo de la casa (es-AR, p. ej.
  `Viernes 9 de octubre`).
- El pie pierde `Última actualización: 09:41` en los tres shells (`ShellFrame.jsx:51`). `TAGLINE` y
  `Período Lectivo 2026` se conservan: son rótulos, no datos del usuario.
- Las dos pantallas de perfil muestran los datos de la sesión / del perfil real
  (`obtenerPerfilAlumno()`, `obtenerPerfilDocente()`) en vez de `CR` / `Camila Rodríguez` y `PM` /
  `Profe Martín` escritos a mano.
- Se reemplaza en los tres tableros la compuerta que ocultaba el contenido mientras la lectura estaba
  pendiente por el marcador `—` en los valores que dependen de la lectura. `StudentPaymentsPage`
  conserva su compuerta: no es un tablero, su `Historial de comprobantes` no se pinta hasta que la
  consulta resuelve.
- **BREAKING** — `AccessPage` deja de usar el código `CUR-101` escrito a mano en la acción
  `Copiar emails habilitados`. Cómo se resuelve es un punto abierto (ver Open Questions).
- Se **modifica D40**: las fechas y la `Última actualización` dejan de ser placeholders literales.
- No se toca la capa de datos, los mocks, los métodos de escritura ni el backend.

### Non-goals

- No se tocan `frontend/src/mocks/**`, `mockDataSource.js` ni `frontend/src/test/setup.js`: siguen
  siendo la fuente por defecto de la suite (D22/D42). No son el problema de este change.
- No se implementan endpoints nuevos de backend.
- No se tocan los `placeholder=` de formularios, los rótulos de columna, los mapas de etiquetas de
  enum, los chips/notas de permisos, los mensajes de estado vacío ni la ayuda.
- No se editan `frontend/package.json` (su `description`) ni `README.md`, que todavía describen el
  frontend como «sobre datos de ejemplo». Es una consecuencia conocida, no un objetivo.

## Capabilities

### New Capabilities
- Ninguna.

### Modified Capabilities
- `admin-shell`: el requirement «Dashboard operativo con indicadores y alertas estáticas» se renombra
  y cambia —pasa a conservar la fila de cuatro tarjetas (una con el conteo real del catálogo y tres con
  `—`) y el bloque de alertas con `—`—; el requirement «Habilitación de accesos y acciones
  excepcionales» cambia en la acción de copia; el pie pierde `Última actualización`.
- `student-shell`: cambia el encabezado y las tarjetas del requirement «Tablero del Alumno en la ruta
  raíz» (vuelve `COMPROBANTES ACREDITADOS` con `—` y las demás se conservan con `—`), el requirement
  «Historial y carga de comprobantes» (compuerta del pendiente), el requirement «Perfil del alumno»
  (tarjeta de identidad) y el pie.
- `teacher-shell`: cambia la línea de fecha y se fija la regla del `—` del requirement «Listado de
  comisiones asignadas», el requirement «Perfil del docente» y el pie.
- No se crea ninguna capability nueva.

## Impact

- **Specs**: `openspec/specs/admin-shell/spec.md`, `openspec/specs/student-shell/spec.md` y
  `openspec/specs/teacher-shell/spec.md`.
- **Código (frontend)**: `frontend/src/admin/DashboardPage.jsx`,
  `frontend/src/alumno/StudentCoursesPage.jsx`, `frontend/src/docente/TeacherCommissionsPage.jsx`,
  `frontend/src/components/shell/ShellFrame.jsx`, `frontend/src/alumno/StudentPaymentsPage.jsx`,
  `frontend/src/alumno/StudentProfilePage.jsx`, `frontend/src/docente/TeacherProfilePage.jsx`,
  `frontend/src/admin/AccessPage.jsx` y `frontend/src/utils/formato.js` (helper nuevo).
- **Decisiones**: `docs/decisions.md` — D40 se modifica (las fechas y la `Última actualización` dejan
  de ser literales). Se registra con fecha y autor.
- **Tests (frontend)**: los casos que afirman los valores literales de los tres tableros, el pie, los
  perfiles y la fecha dejan de ser válidos y hay que actualizarlos a la nueva regla (forma conservada,
  `—` donde no hay fuente, `0` real donde la hay).
- **Docs**: `frontend/package.json` (`description`) y `README.md` quedan desactualizados por decisión
  explícita (ver Non-goals).

## Risks

- **El `—` puede leerse como un dato**: un tablero que conserva su forma con valores `—` puede dar la
  impresión de estar completo. Mitigación: el significado de `—` ("todavía no lo sé", no "cero") queda
  fijado en los tres specs.
- **Los casos conocidos del cliente no vuelven**: el bloque `Alertas de Gestión Pendiente` vuelve solo
  con su encabezado y `—`; los casos del cliente (comprobante ilegible de Agustina Benítez, cheque de
  Banco Federal, deuda de Valeria Rossi, cupo de `CUR-104`) siguen sin verse en el producto.
- **Distinguir `0` real de `—`**: la regla depende de que una lectura resuelta informe `0` y de que una
  lectura pendiente o sin fuente muestre `—`; si se confunden, el tablero vuelve a afirmar algo que no
  sabe.
- **Fix del parpadeo**: el reemplazo de la compuerta por el marcador `—` cambia el primer render de las
  pantallas que leen al montar; hay que verificar que no quede en carga ni muestre un salto visible.
- **Tests a reescribir**: varios casos afirman los literales que se eliminan.

## Assumptions

- `obtenerResumenCatalogo()` devuelve el conteo real de comisiones del catálogo y alcanza para el único
  indicador del tablero de Secretaría que una fuente respalda.
- El cronograma real del alumno sale de `obtenerDetalleInscripcion()` (el mismo que ya alimenta la
  agenda del tablero), así que `PRÓXIMA CLASE` puede derivarse sin endpoint nuevo.
- La acción `Copiar emails habilitados` de `AccessPage` no puede funcionar hoy porque
  `listarEmailsHabilitados` necesita `/alumnos`, que no existe.

## Open Questions

- **`AccessPage` — acción `Copiar emails habilitados de CUR-101`.** Dos opciones, sin elegir en este
  change: **(a)** reemplazar el código fijo por una comisión elegida del catálogo real
  (`listarComisiones()` ya existe); **(b)** quitar la acción entera, porque su llamada
  (`listarEmailsHabilitados`) depende de `/alumnos`, que no existe, así que hoy nunca puede funcionar.
  Se define en la fase de design.

## Work Units

Continúa en la **misma rama** `chore/quitar-mocks-del-frontend` (sin rama nueva). Dos work units y el
archive:

1. **Tableros y armazón**: `DashboardPage.jsx`, `StudentCoursesPage.jsx`, `TeacherCommissionsPage.jsx`,
   `ShellFrame.jsx` (pie) y el helper de fecha en `formato.js`; más los deltas de los tres specs y la
   modificación de D40.
2. **Perfiles y acciones**: `StudentProfilePage.jsx`, `TeacherProfilePage.jsx`, `AccessPage.jsx` y la
   compuerta de carga de `StudentCoursesPage.jsx` / `StudentPaymentsPage.jsx`, con sus tests.
3. **Archive** del change una vez que la suite quede verde y `openspec validate` pase.
