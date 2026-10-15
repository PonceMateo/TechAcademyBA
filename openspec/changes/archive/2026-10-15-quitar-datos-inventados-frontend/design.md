# Design

## Context

Estado actual y restricciones que explican el enfoque. El motivo está en `proposal.md` — Why.

- La frontera de datos vive en `frontend/src/services/` (D13). `dataService.js` es el único módulo
  del que las pantallas sacan datos y todas sus funciones son asíncronas. Los rechazos se propagan
  como `DataSourceError` desde el change anterior (`quitar-mocks-del-frontend`): **ya no hay caída al
  ejemplo** (D36 modificado, D42).
- Los endpoints reales son `POST /auth/login`, `GET /auth/me`, `GET /cursos`, `GET /comisiones`,
  `GET /sedes` y `GET /docentes` (M33). **No existe ningún `/alumnos`, ni `/alumno/*`, ni
  `/inscripciones`, ni `/cobranzas`.** Todo lo que dependía de esos caminos hoy rechaza.
- `obtenerResumenCatalogo()` **ya devuelve el conteo real** del catálogo sin endpoint nuevo: en la
  implementación real cuenta `GET /comisiones` (`{ total_comisiones }`, `apiDataSource.js:143`); en
  la de ejemplo devuelve `CATALOGO_TOTAL_COMISIONES`. `listarComisiones()` devuelve el catálogo real
  con el `codigo` derivado (D34). `listarEmailsHabilitados(codigo)` necesita `/alumnos` y por eso
  rechaza hoy.
- El armazón de los tres shells es un solo archivo, `components/shell/ShellFrame.jsx`, y ya tiene un
  helper privado `inicialesDe(nombre)` (líneas 53-61) que alimenta el avatar del perfil de la barra
  superior.
- `utils/formato.js` **evita `Date` a propósito** para las fechas del dominio (`formatFechaCorta`,
  "las fechas del dominio son fechas, no instantes"). El encabezado de los tableros es el caso
  opuesto: la fecha real del día **es** un instante.
- Las cuentas de demostración de la sesión son `Secretaria BA` (ADMIN), `Rita Molina` (DOCENTE) y
  `Agustina Benítez` (ALUMNO) (`test/support.jsx`), distintas de los nombres del prototipo
  `Camila Rodríguez` / `Profe Martín` que muestran los perfiles (M25).
- `admin/shellConsistency.test.jsx` clasifica `DashboardPage.jsx` dentro de `SIN_DATOS_POR_DISENO`
  (líneas 87-92) y lo exceptúa del filtro de componentes compartidos (línea 136): es la declaración
  de que "el tablero de Administración es texto fijo".

**Premisa del change (la del usuario, en su intención textual).** Se terminó el dato fabricado. La
pantalla **conserva su forma** aunque el dato todavía no exista: el objetivo es correr el frontend
sobre datos reales para que el equipo vea exactamente qué falta, sin que la interfaz se desarme ni
desaparezca. El bootstrap inicial fue una maqueta para una presentación de clase. De esa premisa
salen las tres reglas que este diseño hace cumplir y contra las que se contrasta cada decisión:

1. **Nunca dejar un valor fabricado en pantalla, y nunca borrar la forma.** Ninguna pantalla elimina
   un elemento porque su dato no exista todavía: la pantalla conserva su forma y, donde la fuente
   no puede responder, el valor es `—`. Donde la fuente responde, se muestra el valor real,
   incluido un `0` real. El valor `—` significa "todavía no lo sé" y SHALL NOT significar "cero"; un
   valor que ninguna fuente respalde no se muestra nunca. (Prohíbe: literales de negocio, números
   "de relleno", un `0` que afirme un dato que la pantalla no conoce. El `—` es el marcador
   explícito de "no lo sé", no el reemplazo de un valor que sí existe.)
2. **Nunca borrar una regla de negocio porque falte su dato.** Se saca el **valor** inventado y la
   función degrada honestamente: puede no devolver nada o fallar, y eso está bien. (Protege: las
   reglas de habilitación y de copia de correos, que siguen escritas tal cual.)
3. **No agregar andamiaje que nadie pidió.** Sin carteles "Próximamente", sin esqueletos de carga,
   sin visuales de relleno. Los estados vacíos que ya existen se quedan como están. (Prohíbe:
   cualquier componente nuevo de carga/placeholder.)

## Goals / Non-Goals

**Goals:**

- Que ninguna pantalla de las nueve del inventario muestre un valor de negocio que no venga de la
  capa de datos.
- Que las pantallas conserven su forma: ninguna elimina un elemento porque su dato no exista
  todavía, y ninguna pinta un `0` ni un literal mientras una lectura no resuelva; el valor afectado
  es `—`.
- Que la fecha de los encabezados sea la fecha real del día, en el estilo de la casa.
- Que `AccessPage` copie correos de una comisión elegida del catálogo real y no de `CUR-101`, sin
  tocar la regla de negocio de la copia.

**Non-Goals:**

- No se toca la capa de datos, los mocks, los métodos de escritura ni el backend.
- No se implementa ningún endpoint nuevo ni se completa la funcionalidad de las pantallas que queden
  vacías.
- No se agrega ningún componente, hook ni contexto de carga/error (premisa, regla 3).
- No se editan `frontend/package.json` ni `README.md`, que todavía describen el frontend "sobre datos
  de ejemplo" (consecuencia conocida, ver Open Questions).

## Decisions

### 1. La fecha del encabezado sale de un helper nuevo en `utils/formato.js`

**Decisión:** agregar `formatFechaLarga(fecha = new Date())` a `frontend/src/utils/formato.js`, junto
a `formatMoneda` y `formatFechaCorta`. Devuelve la fecha del argumento (u hoy) en el estilo de la
casa, `Viernes 9 de octubre`. Se arma con
`Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })` y se normaliza lo
que `Intl` intercala de más: **se capitaliza el día de la semana y se quita la coma** entre el día de
la semana y el día del mes (`viernes, 9 de octubre` → `Viernes 9 de octubre`). El día y el mes son
los del reloj local, que es lo que el usuario lee.

Los tres `RESUMEN` de los tableros (`DashboardPage.jsx`, `StudentCoursesPage.jsx`,
`TeacherCommissionsPage.jsx`) pasan de literal a `` `${formatFechaLarga()} · {frase de apoyo}` ``,
conservando la frase de apoyo que cada spec fija.

**Por qué acá y no en otro lado:** `utils/formato.js` es el módulo que ya concentra el formato de la
UI (M15) y el único lugar donde se cambia un formato. **Este helper es la excepción deliberada a
"sin `Date`" del archivo:** las fechas del dominio siguen siendo cadenas (no instantes), pero la
fecha del encabezado es genuinamente el instante actual, que es exactamente el caso de uso de
`Date`. La cabecera del módulo se actualiza para decir por qué conviven los dos criterios.

**Alternativas descartadas:**

- Armar los nombres de los días y los meses en arreglos propios: duplica datos de localización que
  `Intl` ya tiene y contradice el uso que `formatMoneda` hace de `Intl`.
- Poner el helper en cada pantalla: tres copias del mismo formato que se desincronizan.
- Dejar que `Intl` devuelva `viernes, 9 de octubre` tal cual: no es el estilo de la casa que el spec
  fija con el ejemplo.

**Cómo se prueba (el encabezado es no determinista):**

- `formato.test.js` (nuevo) prueba `formatFechaLarga` con **fechas fijas y construidas en local**
  (`new Date(2026, 9, 15)`), contra el literal esperado. El formato queda clavado en un solo test,
  sin reloj.
- Los tests de pantalla **afirman a través del helper**: importan `formatFechaLarga` y esperan que el
  encabezado contenga `formatFechaLarga()` sin argumento. Eso verifica el cableado —que la pantalla
  llama al helper y no escribió un literal— sin congelar el reloj.

**Por qué no congelar el reloj en los tests de pantalla:** la suite es asíncrona (los servicios con
`await`, `waitFor` y `userEvent`), y los temporizadores falsos de Vitest chocan con esas esperas
salvo configuración extra; el formato ya queda clavado de forma determinista en el test del helper.
El residuo (renderizar y afirmar a distinto lado de la medianoche) es despreciable. Alternativa
descartada: `vi.setSystemTime` en cada archivo de pantalla — mete una preocupación de tiempo global
en tests que son de otra cosa y obliga a restaurar el reloj real en cada `afterEach`.

### 2. Regla: la forma se conserva y el valor que depende de una lectura pendiente es `—`

**Decisión:** toda pantalla conserva su forma. Ninguna elimina un elemento porque su dato no exista
todavía, y ninguna pinta un `0` ni un literal mientras una lectura no haya resuelto. En cada valor
que depende de la lectura, el pendiente es `—`; cuando la lectura resuelve, el valor real —incluido
un `0` real si la fuente responde cero—; y si la lectura rechaza, `—`, porque la fuente no pudo
responder. Lo que no depende de la lectura —el saludo y la fecha del encabezado, los rótulos de las
tarjetas, la composición inerte— se pinta enseguida.

**Por qué esta regla es mejor que la compuerta que había (Decisión 2 anterior).** La regla vieja
—un booleano local por pantalla que ocultaba una sección hasta que la lectura resolviera— cerraba el
bug reportado (un tablero con literales pintado mientras `cargadas === false`) pero al costo de que
la pantalla **perdiera su forma**: el tablero no se pintaba hasta que la lectura resolvía y un
rechazo hacía caer el elemento. El usuario rechazó ese resultado contra capturas de la app real. La
regla nueva da las dos cosas a la vez: **la forma que el usuario pidió** y la garantía de que
**nunca se pinta un valor que ninguna fuente respalde**. El bug que abrió este change sigue cerrado:
antes de que la lectura resuelva no se pinta ni un literal ni un `0`; lo único que cambia es qué se
muestra en su lugar —el marcador `—` en vez de nada—. `—` no es un valor fabricado: es la
afirmación explícita de "todavía no lo sé", que es exactamente lo que la pantalla sabe en ese
momento.

**Mecanismo: la bandera que ya existe deja de ocultar y pasa a marcar el valor.** Los booleanos
locales que el change anterior puso por pantalla ya no gatean una sección; ahora eligen entre `—` y
el valor real, y la forma se renderiza siempre:

| Pantalla | Señal de "todavía no lo sé" | Qué hacía antes | Qué hace ahora |
| --- | --- | --- | --- |
| `admin/DashboardPage.jsx` | `resumen === null` (dato, no bandera) | ocultaba la grilla de indicadores | la fila de cuatro tarjetas se pinta siempre; `COMISIONES` es `—` mientras el catálogo no resuelve |
| `alumno/StudentCoursesPage.jsx` | `cargadas` (**ya existe**) | ocultaba el tablero, las tarjetas de inscripción y `Tu agenda` | el tablero conserva su forma; `CURSOS EN MARCHA`, `ACCESO A LA CLASE` y `PRÓXIMA CLASE` son `—` mientras `cargadas === false` |
| `docente/TeacherCommissionsPage.jsx` | `cargadas` (**nueva**) | pintaba los indicadores en `0`/`—` antes de resolver | los cuatro indicadores son `—` hasta que resuelve |
| `excepción: alumno/StudentPaymentsPage.jsx` | `cargados` (**ya existe**) | ocultaba el historial | **sigue ocultando**: la pantalla no es un tablero y su delta conserva la compuerta |

La excepción de `StudentPaymentsPage.jsx` es deliberada y está fijada por el delta de
`student-shell`: su `Historial de comprobantes` no es un tablero de indicadores y el spec mantiene
que no se pinta hasta que la consulta resuelve. `admin/AccessPage.jsx` tiene la misma situación
—`comisiones === null` gatea el selector y la acción— y también queda como está.

**Por qué un booleano local por pantalla y no un componente o un hook compartido:** cada pantalla
lee servicios distintos y decide un límite distinto de "qué valor depende de la lectura". Sobre la
forma ya no hay decisión que compartir; lo que queda es un marcador. Un componente `<Cargando>`
compartido sería, además, exactamente el esqueleto de carga que la premisa prohíbe. Un hook
`useLectura(servicio)` ahorraría el booleano pero no la decisión de qué marcar como `—`, así que
agrega una abstracción para tres líneas. Y el patrón ya existe en el repo: el change anterior puso
`cargadas`, `cargados` y `buscado` a mano por la misma razón.

**Alternativas descartadas:**

- Ocultar la sección hasta que la lectura resuelva (la regla anterior): desarma la pantalla y es lo
  que el usuario rechazó. El pendiente pasa a ser `—`.
- Esperar con un esqueleto o un spinner: andamiaje no pedido (premisa, regla 3).
- Una pantalla de error global o un `ErrorBoundary`: sistema nuevo para un caso que el estado vacío
  ya cubre; además el rechazo ya está decidido.
- Un contexto de carga compartido: acoplaría el ciclo de vida de los datos de una pantalla a las
  otras, que es lo que la frontera de funciones de `dataService` existe para evitar (D13).

### 3. El tablero de Secretaría conserva su fila de cuatro tarjetas

**Decisión:** `DashboardPage.jsx` lee `obtenerResumenCatalogo()` y dibuja la fila completa de cuatro
tarjetas: `COMISIONES` con el valor `resumen.total_comisiones` y el apoyo `en el catálogo`, y
`ALUMNOS INSCRIPTOS`, `COBROS PENDIENTES DE COBRO` y `CUPO PROMEDIO OCUPADO` con el valor `—`, sin
ningún número que las respalde. La fila se pinta siempre; mientras `resumen === null` (lectura
pendiente o rechazada) `COMISIONES` es `—`. `Accesos Rápidos del Personal` se conserva como
composición inerte (mismo precedente que la búsqueda y la campana del armazón).

**Por qué las tres tarjetas no se eliminan:** ningún endpoint respalda sus valores, pero eliminarlas
destruye la forma que el usuario pidió conservar y borra la información de que el indicador existe.
El `—` es la respuesta honesta a "no lo sé", que es exactamente el estado de esas tres tarjetas. La
regla vieja (la tarjeta se cae) perdía la forma; el `0` afirmaría un dato inexistente. Ninguna de
las dos sirve.

**Por qué la tarjeta `COMISIONES` sale de `obtenerResumenCatalogo()` y no de
`listarComisiones().length`:** el spec lo fija —"el valor es el que informa el catálogo"— y derivar
el conteo en la pantalla sería "calcular un agregado propio", que el mismo requirement prohíbe.
`obtenerResumenCatalogo` ya cuenta el catálogo real, así que la pantalla no trae lógica nueva.

**Por qué `COMISIONES` es `—` y no `0` en el pendiente y en el rechazo:** un `0` afirmaría algo que
la pantalla no sabe. El `—` dice "todavía no lo sé" y, en el rechazo, "no pude saberlo".

**Alternativas descartadas:**

- Dejar la tarjeta `COMISIONES` con `0` mientras carga o si falla: es un valor sin dato detrás.
- Eliminar las otras tres tarjetas: destruye la forma y era la regla vieja que el usuario rechazó.
- Mostrar un `0` en las otras tres: afirmaría una medición que ninguna fuente respalda.
- Conservar las otras tres tarjetas como composición inerte con números del prototipo: volvería a
  pintar valores fabricados con rótulo de indicador.

### 4. El bloque `Alertas de Gestión Pendiente` vuelve con encabezado y `—` en el cuerpo

**Decisión:** el bloque vuelve a renderizarse con su encabezado `Alertas de Gestión Pendiente` y un
cuerpo que muestra `—`. Las cuatro alertas inventadas del prototipo (`Comprobante ilegible de
Agustina Benítez`, `Cheque de Banco Federal pendiente de acreditación`, `Valeria Rossi debe la mitad
del arancel`) y la línea de lista de espera de `CUR-104` **no vuelven**.

**Por qué vuelve y no se queda afuera:** el bloque es parte de la forma del tablero y la premisa pide
conservar la forma. Sus líneas no tienen fuente ni historia de usuario detrás, así que su valor
honesto es `—` ("no hay alerta que pueda mostrar porque no puedo saberla"), no la ausencia del bloque
ni un invento. Dejarlo afuera era la regla vieja; reponer las alertas fabricaría valores.

**Alternativas descartadas:**

- Dejar el bloque afuera: pierde la forma y era la regla vieja que el usuario rechazó.
- Reponer las cuatro alertas del prototipo: son datos inventados, justo lo que este change saca.
- Dejar el cuerpo vacío sin `—`: no distingue "no lo sé" de "no hay nada", que es el punto del
  marcador.

### 5. `COMPROBANTES ACREDITADOS` vuelve al tablero del alumno con `—`

**Decisión:** el tablero del alumno conserva cuatro tarjetas y **no colapsa a su estado vacío**:

- `CURSOS EN MARCHA` = cantidad real de inscripciones, con un `0` real cuando no hay ninguna y con
  las inscripciones reales (código y nombre) como apoyo.
- `ACCESO A LA CLASE` = estado real de la inscripción (`HABILITADO` en verde / `BLOQUEADO` en rojo
  con su causa), o `—` cuando no hay ninguna inscripción.
- `COMPROBANTES ACREDITADOS` = `—`, porque no existe ningún endpoint de pagos del alumno que lo
  respalde.
- `PRÓXIMA CLASE` = clase real del cronograma de la inscripción, con el curso real como apoyo, o `—`
  cuando no hay ninguna.

Mientras `cargadas === false`, los cuatro valores dependientes de la lectura son `—`. Con el alumno
sin inscripciones, `CURSOS EN MARCHA` muestra un `0` real y `ACCESO A LA CLASE` / `PRÓXIMA CLASE`
muestran `—`. El bloque `Tu agenda` queda siempre visible y cae a su propio mensaje de vacío, y la
sección `Mis Cursos` conserva su mensaje cuando el alumno no tiene inscripciones.

**Por qué `COMPROBANTES ACREDITADOS` vuelve y no se queda afuera:** se había eliminado bajo la regla
vieja "el elemento sin dato se cae". La regla nueva conserva la forma del tablero y la tarjeta no
está respaldada por ninguna fuente, así que su valor honesto es `—`. Eliminarla borraría en silencio
una tarjeta que el usuario pidió conservar y escondería que el indicador existe y está pendiente.

**Por qué `CURSOS EN MARCHA` es `0` real y no `—` cuando la fuente responde cero:** la distinción es
el corazón de la regla. Si la lectura resolvió y no hay inscripciones, la pantalla **sabe** que son
cero y un `0` es el valor real; `—` reservado para cuando la lectura no resolvió o no hay fuente.
Confundirlos vuelve a afirmar algo que no se sabe (premisa, regla 1).

**Alternativas descartadas:**

- Dejar `COMPROBANTES ACREDITADOS` afuera: era la regla vieja.
- Un `0` en `COMPROBANTES ACREDITADOS`: no hay endpoint de pagos del alumno que lo respalde.
- Mostrar `—` en `CURSOS EN MARCHA` con cero inscripciones: convertiría un cero real en un "no lo
  sé", que es el error inverso.

### 6. `AccessPage` elige la comisión del catálogo real; la regla de negocio no se toca

**Decisión (opción (a) de las Open Questions del proposal):** se elimina `COMISION_DE_LA_COPIA`
(`AccessPage.jsx:34`). La pantalla lee `listarComisiones()` y muestra un selector con el código real
de cada comisión; la acción de copia se rotula `` `Copiar emails habilitados de ${elegida}` `` y llama
a `listarEmailsHabilitados(elegida)`. **La regla de negocio queda idéntica:** copia solo los correos
de los alumnos habilitados de la comisión elegida y, cuando la lista viene vacía, informa que no hay
correos para copiar en lugar de copiar una lista vacía. Se conserva el `aviso` de la pantalla.

El selector y la acción de copia no se pintan mientras el catálogo está pendiente; con datos, la
acción aparece recién cuando hay una comisión elegida (su rótulo necesita nombrarla). Si el catálogo
rechaza, el selector queda sin opciones y la acción nunca aparece. Como `/alumnos` no existe,
`listarEmailsHabilitados` va a rechazar: la llamada se envuelve en `try/catch` y el rechazo se informa
por el `aviso` existente (distinto del mensaje de "no hay correos", que reserva para la lista vacía).
Que la acción no pueda completarse hoy es lo esperado y está anotado en el proposal. `AccessPage` no
es un tablero: conserva la compuerta de su selector y de su acción (ver Decisión 2).

**Por qué (a) y no (b) —quitar la acción entera—:** el spec mantiene el requirement de la acción de
copia y su escenario "el usuario elige una comisión del catálogo real", así que quitarla eliminaría un
elemento del contrato, no un dato inventado. La premisa (regla 2) protege la regla: se cambia el
**valor** que se copia (el código fijo), no la función.

**Alternativas descartadas:**

- Conservar `CUR-101` detrás del selector: el rótulo reflejaría una comisión escrita a mano.
- Elegir siempre la primera comisión del catálogo sin interacción: "elegida por el usuario" es lo que
  el escenario del spec describe; una preselección silenciosa volvería a copiar de una comisión que el
  usuario no eligió.
- Quitar la acción: borra un requirement con regla de negocio válida.

### 7. Las iniciales del avatar las calcula un único helper compartido

**Decisión (decisión c):** `inicialesDe(nombre)` se muda de `ShellFrame.jsx` a
`frontend/src/utils/formato.js` y se exporta. Lo importan los tres lugares que lo necesitan:
`ShellFrame.jsx` (avatar de la barra superior), `StudentProfilePage.jsx` y `TeacherProfilePage.jsx`
(tarjeta de identidad). En los dos perfiles las iniciales —y el nombre de la tarjeta— salen de
`session.nombre`, que es lo que el spec del shell fija ("las iniciales de la cuenta de la sesión").

**Por qué `utils/formato.js`:** es una función pura de presentación, sin React, y el archivo ya es el
lugar del formato de la UI. Reusar, no duplicar: la alternativa evidente era copiar el helper en cada
perfil, que es la duplicación que este change viene a evitar.

**Por qué los perfiles usan `session.nombre` y no `perfil.nombre`:** el spec lo dice literal —el
avatar y el nombre de la tarjeta son "de la cuenta de la sesión"— y es coherente con la barra
superior, que ya muestra `session.nombre` (M25). Consecuencia asumida: la tarjeta de identidad muestra
la cuenta de demostración (`Agustina Benítez` / `AB`, `Rita Molina` / `RM`) mientras el bloque de
datos personales sigue mostrando el nombre del perfil de ejemplo (`Camila Rodríguez`); la dualidad ya
existía en M25, mudada del pie a la tarjeta. Los dos perfiles ganan `useSession()`.

**Alternativas descartadas:**

- Exportar `inicialesDe` desde `ShellFrame.jsx`: haría que los perfiles importen un helper de texto
  desde el armazón (dirección equivocada entre capas).
- Poner el helper en `Avatar.jsx` y que el componente calcule las iniciales desde un `nombre`:
  cambiaría la API de `Avatar` (hoy recibe `iniciales`), todos sus llamadores y su test para ahorrar
  un import; mezcla además una función pura dentro de un componente.
- Un archivo `utils/iniciales.js` nuevo para una sola función: ceremonia sin ganancia.

### 8. `shellConsistency.test.jsx` deja de exceptuar a `DashboardPage.jsx`

**Decisión (decisión f):** se quita `'DashboardPage.jsx'` de `SIN_DATOS_POR_DISENO`
(`shellConsistency.test.jsx:87-92`) y se limpia la excepción del filtro de componentes compartidos
(línea 136) y los comentarios que afirman que el tablero es "texto fijo" (líneas 82-85 y 131-133).

**Por qué:** la lista es la declaración de "estas pantallas leen por diseño sin usar la frontera de
datos". Una vez que el tablero llama a `obtenerResumenCatalogo()`, la entrada describe lo contrario de
lo que el código hace: el test "todas las pantallas leen sus datos por `src/services/`" pasaría a
tener una excepción falsa que taparía una pantalla que dejara de leer.

### 9. Las tres `## Purpose` se editan directo sobre las specs principales

**Decisión (decisión 9):** los tres `## Purpose` de `openspec/specs/admin-shell/spec.md`,
`openspec/specs/student-shell/spec.md` y `openspec/specs/teacher-shell/spec.md` dicen hoy que las
pantallas están "apoyadas en datos de ejemplo". Se editan **directamente sobre las specs
principales**, en una línea cada uno, para que digan que las pantallas corren sobre la capa de datos
real y que la forma se conserva marcando con `—` lo que ninguna fuente respalda. No van como delta.

**Por qué directo y no como delta:** el CLI de OpenSpec **ignora el `## Purpose` de un delta para una
capability existente** (solo mergea requirements). Un delta con `## Purpose` no cambiaría nada.
**Consecuencia, y por eso queda escrito:** el `sync`/archive copia los requirements del delta sobre
la spec principal y **no toca el `## Purpose`**, así que la edición directa sobrevive al archive y no
la revierte.

### 10. Decisión a registrar en `docs/decisions.md` (D43)

Se registra **D43** (el próximo libre después de D42) y **se modifica D40**. Texto propuesto:

> **D43 — El frontend conserva la forma de las pantallas y marca con `—` lo que ninguna fuente
> respalda**
>
> - **Decisión:** se eliminan los literales de negocio escritos a mano de los tres tableros, los dos
>   perfiles, el pie del armazón y la acción de copia de `AccessPage`. Ninguna pantalla elimina un
>   elemento porque su dato no exista todavía: la pantalla conserva su forma y, donde la fuente no
>   puede responder, el valor es `—`. Donde la fuente responde se muestra el valor real, incluido un
>   `0` real. El valor `—` significa "todavía no lo sé" y SHALL NOT significar "cero"; un valor que
>   ninguna fuente respalde no se muestra nunca. Mientras una lectura no haya resuelto, el valor
>   afectado es `—`, nunca un `0` ni un literal. La fecha de los encabezados pasa a ser la fecha real
>   del día y el pie pierde `Última actualización`.
> - **Por qué:** el bootstrap fue una maqueta para una presentación; un alumno vio un tablero con
>   números falsos antes de que la consulta fallara. El equipo priorizó que ninguna pantalla muestre
>   un dato que no venga de la fuente, conservando la forma de la interfaz: la pantalla se desarma
>   menos y se ve exactamente qué falta, sin que un `0` o un literal afirmen algo que no se sabe.
> - **Corrige a D40:** su frase de cierre, "Las fechas y la `Última actualización` quedan literales
>   placeholders", deja de ser cierta. Las fechas son la fecha real del día y la `Última
>   actualización` se quita, porque un placeholder que parece un dato es justo lo que se confundió
>   con un dato real.
> - **Dónde:** `frontend/src/admin/DashboardPage.jsx`,
>   `frontend/src/admin/AccessPage.jsx`, `frontend/src/alumno/StudentCoursesPage.jsx`,
>   `frontend/src/alumno/StudentPaymentsPage.jsx`, `frontend/src/alumno/StudentProfilePage.jsx`,
>   `frontend/src/docente/TeacherCommissionsPage.jsx`,
>   `frontend/src/docente/TeacherProfilePage.jsx`, `frontend/src/components/shell/ShellFrame.jsx`,
>   `frontend/src/utils/formato.js`.

El registro se hace **antes** de aplicar (convención de `docs/decisions.md`), con fecha y autor.

## Cobertura por pantalla (pendiente · con datos · rechazo)

Es el equivalente de la tabla de la Decisión 3 del change anterior, con la regla nueva: **la columna
de pendiente ya no dice "no se pinta", dice `—`**. Los tres tableros (`DashboardPage`,
`StudentCoursesPage`, `TeacherCommissionsPage`) conservan su forma y marcan con `—` lo que depende de
la lectura pendiente. Las pantallas que no son tableros (`StudentPaymentsPage`, los dos perfiles y
`AccessPage`) conservan la compuerta que sus deltas fijan. VERIFY contrasta esta tabla contra el
comportamiento real.

| Pantalla | Qué lee | PENDIENTE (el valor es `—`) | CON DATOS | RECHAZO (`DataSourceError`) |
| --- | --- | --- | --- | --- |
| `components/shell/ShellFrame.jsx` (pie) | nada | — | tagline + `Período Lectivo 2026`; sin `Última actualización` | — |
| Encabezados de los tres tableros | reloj (`formatFechaLarga()`) | la fecha real del día, siempre (no hay lectura que esperar) | ídem | ídem |
| `admin/DashboardPage.jsx` | `obtenerResumenCatalogo()` | la fila de cuatro tarjetas y el bloque `Alertas de Gestión Pendiente` ya se pintan; `COMISIONES` = `—`, las otras tres = `—` y alertas = `—`; sí el saludo, la fecha y `Accesos Rápidos` | `COMISIONES` = `total_comisiones`; `ALUMNOS INSCRIPTOS`, `COBROS PENDIENTES DE COBRO` y `CUPO PROMEDIO OCUPADO` = `—`; alertas = `—` | la forma se conserva con `COMISIONES` = `—` (la fuente no respondió), las otras tres = `—` y alertas = `—`; quedan saludo, fecha y `Accesos Rápidos` |
| `admin/AccessPage.jsx` | `listarComisiones()` (selector) y `listarEmailsHabilitados(codigo)` (acción) | no pinta el selector ni la acción de copia; sí `Motivo` y `Forzar Bloqueo Manual` | selector con el catálogo real y, tras elegir, `Copiar emails habilitados de {codigo}` | selector sin opciones: la acción de copia no aparece |
| `alumno/StudentCoursesPage.jsx` | `listarInscripcionesAlumno()` + `obtenerDetalleInscripcion()` | el tablero ya se pinta con su forma; `CURSOS EN MARCHA`, `ACCESO A LA CLASE`, `COMPROBANTES ACREDITADOS` y `PRÓXIMA CLASE` = `—`; `Tu agenda` cae a su propio mensaje de vacío; `Mis Cursos` conserva su mensaje | cuatro tarjetas (`CURSOS EN MARCHA` = conteo real, `ACCESO A LA CLASE` = estado real, `COMPROBANTES ACREDITADOS` = `—`, `PRÓXIMA CLASE` = clase real o `—`) + tarjetas de las inscripciones + `Tu agenda` | la forma se conserva con los cuatro valores dependientes en `—` y `Mis Cursos` con su mensaje de vacío |
| `alumno/StudentPaymentsPage.jsx` | `listarPagosAlumno()` + `listarInscripcionesAlumno()` | el historial no se pinta (ni filas ni mensaje); sí `Cargar comprobante` (su selector de curso sale sin opciones) | historial con las filas del alumno | estado `SIN_PAGOS` |
| `alumno/StudentProfilePage.jsx` | `obtenerPerfilAlumno()` | solo el título `Mi Perfil` | tarjeta de identidad (avatar y nombre de la sesión) + `Datos personales` | `No hay ningún alumno para mostrar.` |
| `docente/TeacherCommissionsPage.jsx` | `obtenerComisionesAsignadas()` | el tablero ya se pinta con su forma; las cuatro tarjetas (`COMISIONES ACTIVAS`, `ALUMNOS HABILITADOS`, `BLOQUEADOS`, `PRÓXIMA CLASE`) = `—`; `Comisiones asignadas` y `Tu agenda` caen a sus mensajes de vacío; el encabezado sí | cuatro indicadores reales + `Comisiones asignadas` + `Tu agenda` | la forma se conserva con las cuatro tarjetas = `—`, el `vacio` de la tabla y la agenda vacía |
| `docente/TeacherProfilePage.jsx` | `obtenerPerfilDocente()` | solo el título `Mi Perfil` | tarjeta de identidad (sesión) + datos de contacto + `Comisiones asignadas` | `No hay ningún docente para mostrar.` |

Nota: `StudentPaymentsPage`, los dos perfiles y `AccessPage` **no son tableros** y conservan la
compuerta del pendiente que sus deltas fijan (Decisión 2). En los dos perfiles el **rechazo**
conserva el estado vacío que fijó el change anterior.

## Risks / Trade-offs

- **Un `0` donde significa "no lo sé".** El riesgo ya no es una pantalla vacía, es lo contrario: una
  pantalla que muestra un `0` (o un literal) donde el valor todavía no se conoce. Un `0` tras un
  fallo afirmaría algo que la pantalla no sabe. Mitigación: la regla del pendiente (Decisión 2), esta
  tabla y D43 fijan que el pendiente es `—` y que un `0` solo aparece cuando la fuente respondió
  cero.
- **Volver a borrar un elemento en silencio.** La regla vieja borraba lo que no tenía dato, así que
  es fácil que una pantalla nueva repita el borrado sin que se note. Mitigación: los deltas fijan la
  forma (cuatro tarjetas, bloque de alertas, `Tu agenda`) y VERIFY la contrasta; el riesgo residual
  es que la próxima pantalla que lea al montar no mire esta tabla.
- **El spec de `admin-shell` es el más castigado.** Es el que más cambia en este change y el que más
  deltas acumula de los últimos dos: su tablero, su acción de copia y su pie se reescriben. Un delta
  mal mergeado al archivar puede dejar el spec principal describiendo la pantalla vieja.
- **La fecha no es determinista.** El encabezado depende del reloj. Un test que afirme un literal
  fijo se romperá cualquier día que no sea ese; por eso la cobertura pincha el formato en el test del
  helper y los tests de pantalla afirman a través de él (Decisión 1).
- **Los casos conocidos del cliente no vuelven.** El bloque de alertas vuelve solo con `—`; los casos
  del cliente (comprobante ilegible de Agustina Benítez, cheque de Banco Federal, deuda de Valeria
  Rossi, cupo de `CUR-104`) siguen sin verse en el producto.
- **El `—` puede leerse como un dato.** Un tablero que conserva su forma con valores `—` puede dar la
  impresión de estar completo. Mitigación: el significado de `—` ("todavía no lo sé", no "cero")
  queda fijado en los tres specs y en D43.
- **Dos nombres por persona en la tarjeta de identidad.** La tarjeta muestra la cuenta de la sesión
  (`Agustina Benítez`, `Rita Molina`) y el bloque de datos personales el nombre del perfil de ejemplo
  (`Camila Rodríguez`). No es un error de este change: es la dualidad que M25 ya documentó, ahora
  movida del pie a la tarjeta, y desaparece cuando el endpoint resuelva la cuenta contra el padrón.
- **Tests a reescribir.** Los casos que afirman los literales viejos y los que afirman la ausencia de
  las tarjetas dejan de ser válidos: `DashboardPage.test.jsx` (una sola tarjeta, alertas eliminadas),
  `StudentCoursesPage.test.jsx` (la ausencia de `COMPROBANTES ACREDITADOS` y el tablero oculto),
  `StudentProfilePage.test.jsx` y `TeacherProfilePage.test.jsx` (avatar y nombre de la tarjeta), los
  tres `*Layout.test.jsx` (`ULTIMA_ACTUALIZACION` del pie) y `AccessPage.test.jsx` (el rótulo `… de
  CUR-101`).

## Migration Plan

- Despliegue del frontend en un solo paso. No hay migración de datos ni de esquema: la capa de datos y
  el backend no se tocan.
- Efecto inmediato: los tableros conservan su forma —la fila completa de tarjetas, el bloque de
  alertas, `Tu agenda`— marcando con `—` lo que ninguna fuente respalda; el tablero del alumno
  recupera `COMPROBANTES ACREDITADOS` con `—`; los perfiles muestran la cuenta de la sesión en su
  tarjeta de identidad; `AccessPage` pide elegir una comisión.
- Las tres ediciones de `## Purpose` sobre las specs principales se aplican junto con el código y
  **no las revierte el archive** (Decisión 9).
- **Rollback:** revertir el commit (solo código de frontend y las tres líneas de `## Purpose`). No
  hay entorno que limpiar ni dato que restaurar.

## Open Questions

- **Alcance de la regla forma / `—` en las pantallas que no son tableros.** Este change la aplica a
  los tres tableros (`DashboardPage`, `StudentCoursesPage`, `TeacherCommissionsPage`) y **deja a
  propósito** como están los estados vacíos de los dos perfiles y la compuerta de `Mis Pagos`
  (`StudentPaymentsPage`), que no son tableros. Queda abierto si una próxima iteración quiere que la
  misma regla cubra esas pantallas; no cambia este diseño ni sus tareas.
- **El nombre de la cuenta de demostración frente al nombre del perfil del prototipo.** La tarjeta de
  identidad muestra `Agustina Benítez` (la cuenta de la sesión) y el bloque de datos personales sigue
  mostrando `Camila Rodríguez` (el perfil del prototipo). La dualidad viene de M25; queda abierto si
  el equipo quiere tomar una decisión explícita sobre cuál nombre debe leerse, o dejarlo hasta que el
  endpoint resuelva la cuenta contra el padrón. No cambia este diseño.
- **Prosa de `README.md` y `frontend/package.json`.** Siguen describiendo el frontend "sobre datos de
  ejemplo" (el proposal lo deja fuera de alcance a propósito). Se puede actualizar en este change o
  dejar a un follow-up de documentación; no cambia specs ni enfoque.
