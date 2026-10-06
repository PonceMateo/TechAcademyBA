# Design

## Context

Ver `proposal.md` para el porqué. Lo que condiciona el approach:

- `frontend/src/admin/CoursesPage.jsx` es hoy una pantalla sola: pide `listarComisiones()`,
  `listarCursos()`, `listarDocentes()`, `listarSedes()` y `obtenerResumenCatalogo()` en un
  `useEffect`, y con eso alimenta el chip, la tabla, el selector de curso del modal y los dos
  modales de alta.
- **Desde `altas-catalogo-docentes` la pantalla lee datos reales.** `resolveApiMode()` devuelve `api`
  salvo que el entorno pida `mock` (D36), y `GET /cursos`, `GET /comisiones`, `POST /cursos` y
  `POST /comisiones` existen. Las lecturas caen al ejemplo solo ante un 404, y los `POST` nunca caen.
  Los cinco renglones del cliente que aparecen en los tests son el ejemplo, no lo que ve la
  secretaría.
- `frontend/src/App.jsx` rutea las seis secciones de Administración como hijas de `/admin`. Ya hay
  dos rutas con parámetro de código en otros shells: `/docente/alumnos/:codigo` y
  `/alumno/cursos/:codigo`.
- `frontend/src/admin/shellConsistency.test.jsx` exige que **todo** `.jsx` de `admin/` importe desde
  `../services/dataService` y desde `components/ui`. Un componente presentacional nuevo en ese
  directorio rompería la prueba.
- El conteo de comisiones por curso no viene en `GET /cursos`: la respuesta trae código, nombre y
  descripción. El precedente de derivarlo en el cliente ya existe —
  `obtenerResumenCatalogo()` cuenta la lista que devuelve `GET /comisiones` (D15).

## Goals / Non-Goals

**Goals:**

- Dos vistas encadenadas con la tabla y el modal de comisión intactos.
- Ningún endpoint nuevo, ningún archivo nuevo en `admin/`, ninguna dependencia nueva.
- El conteo de la tarjeta y la tabla del curso no puedan contradecirse: salen del mismo estado.

**Non-Goals:**

- La búsqueda: el campo aparece deshabilitado y no filtra. Ningún estado, ningún servicio.
- La edición de curso y de comisión (historias #3 y #4), que sigue sin control.
- Cambios en `Docentes`, `Alumnos`, `Cobranzas`, `Accesos` o en el tablero.

## Decisions

**1. Una sola pantalla que lee el parámetro de la ruta, no dos archivos.**

`CoursesPage` recibe `cursos` de `useParams()`: sin parámetro dibuja el grid, con parámetro dibuja la
tabla. El modal de comisión se queda en el archivo y las dos vistas lo abren.

Alternativa considerada: `CoursesPage.jsx` + `CourseCommissionsPage.jsx` con el modal en un tercero.
Se descartó porque un archivo presentacional en `admin/` tiene que importar `dataService` para
sobrevivir `shellConsistency.test.jsx`, y el modal no lee datos: o importa al revés de lo que hace el
resto del código, o se duplica. Además las dos vistas comparten los mismos cinco listados y el mismo
modal, así que partir el archivo no reparte estado: lo reparte y lo duplica. Si la pantalla crece con
la edición (#3 y #4), ahí sí conviene partirla.

**2. La ruta lleva el código del curso, no el identificador.**

`/admin/cursos/:codigo`, con `normalizeCode` de `src/domain/normalize` para comparar, que es el
mismo criterio de D6 que usa el resto del código y el que evita que `CUR-101` y `cur101` sean dos
cursos. El código es lo que la secretaría lee en pantalla y lo que ya usan las otras dos rutas con
parámetro. El identificador también serviría, pero no se ve en ningún lado.

**3. El conteo sale de contar `comisiones` por código de curso, en el cliente.**

Un `reduce` sobre el estado que la pantalla ya tiene, agrupando por `normalizeCode(comision.curso.codigo)`.
La tarjeta y la tabla salen de ese mismo grupo, así que no pueden diferir.

Alternativa considerada: agregar `comisiones_asignadas` a `GET /cursos`. Se descartó porque obliga a
tocar backend, contrato y la prueba del endpoint para calcular una resta que el frontend ya puede
hacer con las dos listas que descarga, y porque `obtenerResumenCatalogo` ya estableció el
precedente de derivar un total en el cliente (D15). Cuando el catálogo crezca a un punto en que
filtrar en el cliente duela, la respuesta de `GET /cursos` es el lugar correcto y el cambio queda
encapsulado en la fuente de datos.

**4. El grid se dibuja con `Card` de `components/ui` y clases de Tailwind, sin componente nuevo.**

Una rejilla de `sm:grid-cols-2 lg:grid-cols-3` de tarjetas, y cada tarjeta **es** un `<button>` con
el texto `Abrir comisiones` adentro. El click en cualquier punto de la tarjeta y el click en el
botón son la misma acción, que es lo que pide el pedido, y hacerla un solo elemento evita un botón
dentro de otro botón —HTML inválido que además rompe la navegación por teclado.

**5. El buscador es `Input` con `disabled` y `leyenda`, sin estado.**

El `Input` compartido ya tiene las dos props. Se usa el patrón `Próximamente` que el proyecto ya
tiene para los controles que no abren nada. Sin `value` ni `onChange`: un campo deshabilitado no
tiene estado que guardar.

**6. Un curso que no existe en la ruta se informa en la vista, no con la pantalla 404 ni con una
tabla vacía.**

`NotFoundPage` saca a la secretaría del shell, y una tabla vacía se lee como "este curso no tiene
comisiones", que es una afirmación falsa. Se dibuja un `Card` con el mensaje y un `Volver a cursos`.

**7. Se conserva la columna `CURSO / PROGRAMA` dentro de la tabla del curso.**

Es redundante cuando todas las filas son del mismo curso, y el pedido fue "el mismo formato que está
ahora". Sacarla rompería los rótulos literales que el spec fija y el test que los compara contra la
lista completa. Si molesta en la revisión, se saca en un change propio y es un solo lugar.

## Risks / Trade-offs

- **Los tests de `CoursesPage.test.jsx` abren `/admin/cursos` y esperan la tabla de comisiones.** →
  Reapuntar `abrir()` a `/admin/cursos/CUR-101` y agregar el bloque del grid. Es trabajo esperado, no
  un cambio de comportamiento escondid.
- **La prueba de render de `shellConsistency.test.jsx` recorre las seis secciones y exige tarjeta,
  insignia y botón.** → La vista de cursos sigue dibujando `Card`, `Badge` y `Button`; no le falta
  ninguno de los tres.
- **Al navegar entre las dos vistas la pantalla se monta de nuevo y pierde el estado en memoria.**
  → Es lo correcto: el `useEffect` vuelve a pedir los cinco listados, y por eso el conteo de la
  tarjeta nunca queda viejo. No hay store global que sincronizar.
- **`shellConsistency.test.jsx` trata a cada `.jsx` de `admin/` como pantalla.** → Por eso la
  decisión 1: no se agregan archivos a ese directorio.
- **En modo `mock` el ejemplo arma el catálogo a partir de las comisiones.** →
  `mockDataSource.listarCursos()` deriva los cursos de las comisiones del ejemplo, así que ninguna
  tarjeta tendría descripción y ningún curso aparecería con cero comisiones. **No se cambia el
  ejemplo:** `/cursos` existe, el modo por omisión es `api` (D36) y el ejemplo solo entra por un 404,
  que es un caso que no se va a dar con el catálogo andando. Los tests que necesiten una descripción
  o un curso sin comisiones usan `stubDataSource`, que es como ya se prueban los rechazos. Si algún
  día se corre el frontend en `mock` para una demo, el arreglo es sembrar una colección de cursos en
  `src/mocks/`, no cambiar la vista.
- **La ruta con un código de curso desactualizado** —un enlace viejo o un curso borrado— → La
  pantalla avisa que el curso no existe y ofrece volver, en vez de mostrar una tabla vacía que se
  leería como "este curso no tiene comisiones".

## Migration Plan

Solo frontend: un commit, sin migración de datos, sin contrato de API y sin estado persistido. El
rollback es revertir el commit.

Al terminar hay que registrar en `docs/decisions.md`, con fecha y autor, las decisiones técnicas no
funcionales de este change: pantalla única con dos vistas, código como parámetro de ruta, conteo
derivado en el cliente y buscadorplaceholder.

## Open Questions

Ninguna que afecte specs, approach o tareas.