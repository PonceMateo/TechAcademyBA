# Design

## Contexto

El catálogo de cursos ya tiene consulta y alta reales. `Curso` guarda `nombre`, `nombre_norm` con el
índice único `uq_curso_nombre_norm` y `descripcion`; `codigo` es una columna generada por la base
(D32). La pantalla `CoursesPage` dibuja el catálogo como un grid de tarjetas y comparte el estado con
la vista de comisiones. La frontera de datos es `src/services/` y los componentes visuales ya
existentes son `Modal`, `Input`, `Button` y `Card`.

## Decisiones

### D-A — `PUT` con el formulario completo y el código fuera del contrato

`PUT /cursos/{id}` recibe `nombre` y `descripcion`, los mismos datos que el alta. Se elige `PUT` y no
`PATCH` por la misma razón que en la edición de alumnos: el modal edita el formulario completo y el
contrato no admite campos ausentes que dejarían el curso a medio actualizar.

`codigo` no está en `CursoUpdate` y el esquema usa `extra="forbid"`, así que un cliente que lo envíe
recibe `422`. El código no cambia nunca: es una columna generada y el `id` se conserva. Esto es la
desviación consciente de la historia #3 y se registra en `docs/decisions.md`.

### D-B — Unicidad del nombre sin chocar contra el propio curso

El servicio normaliza el nombre con `normalize_name` y busca otro curso con el mismo `nombre_norm`
**excluyendo el `id` que se está editando**. Si encuentra uno, responde `409` nombrando el curso
existente, igual que el alta. El índice único sigue siendo la red que corta la carrera entre dos
ediciones simultáneas; en ese caso el `IntegrityError` se traduce al mismo `409` degradado.

Un `id` inexistente responde `404` antes de tocar el nombre. Un nombre vacío lo rechaza el esquema con
`422`, no el CHECK de la base, para que la pantalla muestre el campo y no el texto de PostgreSQL.

### D-C — Menú `⋮` local a la pantalla, sin componente compartido nuevo

La tarjeta hoy es un `<button>` que abre el curso. Para que tenga una acción propia sin botones
anidados, la tarjeta pasa a ser un contenedor con dos controles: el cuerpo, que sigue abriendo el
curso, y el botón `⋮`, que detiene la propagación y despliega `Editar curso`.

El menú se implementa dentro de `CoursesPage` y no como componente de `components/ui`: hoy lo usa una
sola pantalla y el patrón de acciones en tablas sigue siendo el de botones en la fila. Si otra pantalla
necesita el mismo menú, se promueve entonces.

El botón anuncia el estado con `aria-expanded` y `aria-haspopup`, el menú se cierra con `Escape`, con
un click afuera y al elegir la acción, y el foco vuelve al botón al cerrar. El modal reutiliza `Modal`
e `Input`; no se agregan estilos ni componentes visuales nuevos.

### D-D — Actualizar las dos vistas con la misma respuesta

La respuesta del `PUT` trae el `CursoOut` actualizado. La pantalla reemplaza el curso en el estado del
catálogo y, en el estado de comisiones, reemplaza el `curso` anidado de cada comisión de ese `id`. No
se vuelve a pedir el catálogo completo: una recarga extra abriría la puerta a que la tarjeta y la tabla
muestren nombres distintos mientras una de las dos respuestas está en vuelo. El código del curso no
cambia, así que la ruta abierta sigue siendo válida.

### D-E — Frontera de datos y pruebas

`dataService.editarCurso(id, datos)` delega en la fuente configurada. `apiDataSource` hace
`PUT /cursos/{id}` y `mockDataSource` actualiza su store y devuelve la fila con la misma forma, para
que las pruebas de pantalla no necesiten conocer la implementación. Los rechazos suben tal como los
devuelve la fuente y el modal no se cierra.

## Riesgos

- La tarjeta deja de ser un único `<button>`: hay que conservar el click en el cuerpo y la navegación
  por teclado, y actualizar las pruebas que la buscaban por rol.
- El nombre visible de un curso aparece también en las comisiones; si se actualiza solo el catálogo,
  la tabla queda con el nombre viejo hasta recargar. Por eso se actualizan las dos estructuras.
- El `409` por carrera concurrente no puede nombrar el curso que chocó; el mensaje se degrada igual
  que en el alta, en vez de inventar un nombre.

## Migración

Ninguna. `nombre`, `nombre_norm`, `descripcion` y el índice único ya existen.
