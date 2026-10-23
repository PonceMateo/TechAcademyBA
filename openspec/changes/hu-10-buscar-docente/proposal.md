# Proposal

## Why

La historia #10 es **Should** y la pantalla `Docentes` ya tiene un buscador, pero hoy no busca en
el servidor: `GET /docentes` no acepta un criterio y el frontend filtra el listado ya cargado. El
endpoint tampoco devuelve las comisiones asignadas, solo su cantidad, así que la pantalla no puede
mostrar a qué comisiones está asignado cada docente.

Esta entrega implementa la búsqueda real y completa la respuesta con las comisiones de PostgreSQL.
La búsqueda SHALL incluir solo docentes activos: los dados de baja conservan su fila y su estado,
pero dejan de aparecer en el padrón visible y en los resultados.

## What Changes

- `GET /docentes` acepta `?q=` y sigue siendo exclusivo de Administración. Busca por nombre,
  apellido, DNI o email, sin exigir el dato completo, pero **desde el comienzo de la palabra o del
  valor**: una `a` muestra a los docentes cuyo nombre o apellido empieza con `a`, no a todos los
  que contienen esa letra.
- Las palabras de la consulta respetan su orden. `ana gom` encuentra a `Ana Gómez`; `gom ana` no
  lo encuentra. La comparación ignora mayúsculas, minúsculas y tildes. El DNI se busca con o sin
  puntos, espacios o guiones, y también por un fragmento desde el inicio de sus dígitos.
- Una sola letra ya dispara la búsqueda: no hay mínimo de caracteres. Los resultados se ordenan
  por la palabra que coincide: primero los docentes cuya primera palabra del nombre empieza con la
  consulta, después los que coinciden en palabras posteriores del nombre o en el apellido, y al
  final las coincidencias por DNI o email. Con `al`, `Alfonso Pérez` aparece antes que
  `Rita Alonso`.
- El listado habitual devuelve solo docentes con `activo = true`. Una consulta vacía devuelve ese
  mismo listado y una consulta sin coincidencias devuelve `[]`.
- `DocenteOut` incorpora `comisiones`: cada comisión asignada con su `id`, su `codigo` derivado y
  el nombre del curso. La lista se arma desde las relaciones reales de `comision` y queda vacía
  cuando el docente no tiene ninguna. `cantidad_comisiones` se conserva.
- La pantalla de Docentes espera aproximadamente 300 ms antes de consultar, descarta respuestas de
  búsquedas anteriores y vuelve al listado habitual cuando se vacía el campo.
- La columna `COMISIONES ASIGNADAS` muestra el código y el nombre de cada comisión; sin
  comisiones muestra `Sin comisión`. Sin coincidencias muestra `No se encontraron docentes`.
- `src/services/` actualiza la implementación de API y la de ejemplo para devolver la misma forma.
  La fuente de ejemplo deriva las comisiones de su catálogo de comisiones, no del conteo de la
  planilla del cliente, porque el conteo no es una relación.
- No se modifica el alta de docentes, la identidad visual ni otras pantallas.

**Fuera de alcance:** alta, edición o baja de docentes; búsqueda por CUIL; filtros por comisión o
estado; paginación; cambios en la asignación de comisiones; cualquier historia distinta de #10.

## Capabilities

### New Capabilities

- `padron-docentes`: consulta y búsqueda administrativa del padrón, con sus criterios de
  coincidencia, el filtro de docentes activos y las comisiones asignadas en la respuesta.

### Modified Capabilities

- `admin-shell`: la pantalla de Docentes incorpora la búsqueda dinámica, el debounce, la
  protección contra respuestas antiguas y la visualización de las comisiones asignadas.

## Impact

- **Backend:** `GET /docentes`, servicio y esquema del padrón, y pruebas `pytest` contra
  PostgreSQL real. Sin migración: `docente.activo`, `comision.docente_id` y las relaciones ya
  existen.
- **Frontend:** `TeachersPage`, la frontera `dataService`, las fuentes `api` y `mock`, y pruebas
  `vitest`. Sin componentes visuales nuevos ni cambios de estilos.
- **Documentación:** `docs/decisions.md` registra la búsqueda en el servidor, la normalización sin
  extensión de PostgreSQL y la forma de la respuesta de comisiones.
- **Backlog:** al cumplir todos los criterios de #10, el pull request puede usar `Closes #10`.
