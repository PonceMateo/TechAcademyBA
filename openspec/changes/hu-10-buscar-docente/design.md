# Design

## Contexto

El padrón de docentes ya tiene `GET /docentes` y `POST /docentes`, ambos restringidos a
Administración. `Docente` guarda `nombre`, `apellido`, `dni`, `dni_norm`, `email`, `activo` y
`Comision` guarda `docente_id`, `numero`, `curso_id` y la propiedad `codigo`. La pantalla
`TeachersPage` consume `buscarDocentes` por la frontera `src/services/` y muestra el conteo
`comisiones_asignadas`.

La búsqueda de alumnos de la HU 16 ya usa `GET /alumnos?q=` y es la referencia de contrato. No se
reutiliza su criterio de coincidencia porque la HU 10 exige coincidencia por prefijo de palabra,
orden de las palabras y tolerancia a tildes, que la HU 16 no necesita.

## Decisiones

### D-A — La búsqueda se resuelve en el servidor con `?q=`

`GET /docentes?q=` recibe un texto opcional de hasta 100 caracteres. El servicio filtra solo
docentes con `activo = true`; una consulta vacía o con espacios devuelve el listado habitual y una
consulta sin coincidencias devuelve una lista vacía. El frontend deja de filtrar el arreglo ya
cargado: así el mismo criterio vale para cualquier volumen y la respuesta vieja no se mezcla con
el listado local.

La consulta no pagina. El padrón de docentes es un catálogo acotado y la historia no pide
paginación; agregarla cambiaría el contrato sin necesidad.

### D-B — Normalización en Python y coincidencia por prefijo de palabra

El texto se parte en palabras y cada palabra se normaliza con `normalize_name`
(`app/services/normalization.py`): mayúsculas, sin tildes y sin signos. La consulta se compara
contra el **comienzo** de las palabras del nombre y del apellido, en orden. No se usa `includes`
sobre el nombre completo: si se busca `a`, solo entran los docentes con un nombre o apellido que
empieza con `a`, no los que tienen una `a` en el medio.

La comparación es una subsecuencia ordenada de prefijos: `ana gom` encuentra `Ana María Gómez`
—`ana` coincide con el inicio de la primera palabra y `gom` con el inicio de una palabra
posterior—, mientras que `gom ana` no encuentra nada porque invierte el orden. Un título como
`Lic.` es una palabra más y no impide encontrar el nombre o el apellido que le sigue.

El DNI se compara aparte con `normalize_document` y solo cuando la consulta está formada por
dígitos y separadores (`30.111.222`, `30 111 222`, `30111`). La comparación es por prefijo del DNI
normalizado, no por un fragmento en cualquier posición. El email se compara también por prefijo
del valor normalizado cuando la consulta es un único término de más de una letra. Una sola letra
se limita al nombre y al apellido, como pide el spec: no arrastra filas por el comienzo de un
email.

Se descarta `unaccent` de PostgreSQL y las columnas normalizadas: instalar una extensión o sumar
columnas derivadas exige migración y permisos, y el padrón es chico. La decisión queda registrada
como D48 en `docs/decisions.md`.

### D-C — Orden de resultados por coincidencia

El servicio no devuelve los resultados en orden de `id`. Arma una clave de orden por docente:
primero el campo de la coincidencia —nombre, después DNI, después email—, luego la posición de la
primera palabra que coincide dentro del nombre y por último el `id` como desempate estable.

El orden de prioridad es: coincidencia en la primera palabra del nombre, coincidencia en una
palabra posterior del nombre o del apellido, coincidencia por DNI y coincidencia por email. Así,
si el administrador escribe `al`, `Alfonso Pérez` queda antes que `Rita Alonso`, aunque `Rita`
tenga el `id` menor. Una consulta de una sola letra entra en la misma regla y se ejecuta sin
mínimo de caracteres.

#### Scenario: Prioridad de la primera palabra

- **WHEN** el administrador busca `al` y existen `Alfonso Pérez` y `Rita Alonso`
- **THEN** `Alfonso Pérez` aparece primero, porque la coincidencia está en la primera palabra de su nombre

### D-D — Las comisiones salen de una consulta agrupada

Después de filtrar los docentes, el servicio trae en una sola consulta las comisiones de esos
`docente_id` con `selectinload(Comision.curso)`. Agrupa por docente y arma para cada fila una
lista de `{id, codigo, nombre}`; el nombre es el del curso y el código es la propiedad derivada
`Comision.codigo` (D34). No hay consulta por docente.

`DocenteOut` agrega `comisiones` y conserva `cantidad_comisiones`, que ahora se deriva de esa
misma lista. Un docente sin filas en `comision` recibe `[]`, y la pantalla muestra `Sin comisión`.
El alta sigue respondiendo `cantidad_comisiones = 0` y `comisiones = []`.

Se incluyen las comisiones asignadas aunque estén inactivas: la relación sigue existiendo y la
historia no pide ocultarlas. El filtro de estado es del docente, no de la comisión.

### D-E — Debounce y descarte de respuestas antiguas en la pantalla

`TeachersPage` conserva el input y el estado actuales. Un `useEffect` sobre `consulta` programa la
llamada con `setTimeout` de 300 ms; la limpieza cancela el temporizador anterior. Un contador en
`useRef` identifica cada consulta y solo aplica el resultado si sigue siendo la última. Cuando la
consulta queda vacía la llamada se hace sin demora para volver al listado habitual. No hay mínimo
de caracteres: una sola letra programa la misma consulta que cualquier otra entrada.

No se agrega `AbortController` porque la frontera `request` no expone la señal y el descarte por
contador resuelve el requisito sin cambiar el contrato de la frontera.

### D-F — La columna muestra las comisiones, no el conteo

`apiDataSource` mapea `comisiones` tal como llega y `filaDeDocente` conserva
`comisiones_asignadas` por compatibilidad. `mockDataSource` deriva `comisiones` de su catálogo de
comisiones y calcula el conteo desde esa lista: la planilla del cliente registra un conteo que no
es una relación y la HU 10 pide mostrar las comisiones reales de la fuente.

La columna `COMISIONES ASIGNADAS` conserva su rótulo y su posición. Cada comisión se muestra como
`codigo nombre`; sin filas, `Sin comisión`. Sin coincidencias, el estado vacío dice
`No se encontraron docentes`. No se agregan columnas ni se cambian colores, tipografías o
componentes.

## Riesgos

- **Listado sin docentes inactivos:** es un cambio visible respecto de la pantalla anterior. Se
  decidió con el equipo para que la búsqueda y el listado coincidan con el alcance de #10.
- **Normalización en memoria:** el filtro recorre el padrón activo. Es aceptable para un catálogo
  de docentes y evita una migración; si el padrón crece mucho, la búsqueda se puede mover a
  columnas normalizadas o a `unaccent` sin cambiar el contrato.
- **Respuestas fuera de orden:** el contador las descarta antes de escribir el estado. La prueba
  de Vitest resuelve una consulta vieja después de una nueva y verifica que no pise el resultado.

## Migración

Ninguna. El esquema ya tiene `docente.activo`, `comision.docente_id`, `Comision.curso` y
`dni_norm`. El cambio es de consulta y de contrato de salida.
