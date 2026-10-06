# Tasks

## 1. Ruta de la vista de comisiones del curso

- [x] 1.1 Agregar en `frontend/src/App.jsx` la ruta hija `cursos/:codigo` de `/admin` apuntando al mismo `CoursesPage`, y verificar que `/admin/cursos` y `/admin/cursos/CUR-101` resuelven sin mostrar el 404
- [x] 1.2 Leer el código del curso con `useParams` en `CoursesPage` y `normalizeCode` de `src/domain/normalize` para compararlo con el de cada curso, y verificar que `CUR-101` y `cur101` abren la misma vista
- [x] 1.3 Confirmar que el ítem `Cursos y Comisiones` del menú sigue marcado en la ruta con parámetro, con el test de `AdminLayout.test.jsx` pasando

## 2. Vista de cursos

- [x] 2.1 Calcular en `CoursesPage` el grupo de comisiones por curso con `normalizeCode` sobre `comision.curso.codigo`, a partir del estado que la pantalla ya carga, y verificar que la tarjeta de cada curso anuncia el mismo número de filas que muestra su tabla, incluso un curso recién creado, que aparece con cero
- [x] 2.2 Dibujar el grid de cursos con `Card` y clases de Tailwind: cada tarjeta es un `<button>` que navega a `/admin/cursos/:codigo` y muestra nombre, código, descripción y cantidad de comisiones. Sin componente nuevo en `components/ui`
- [x] 2.3 Mostrar en la vista de cursos las acciones `+ Nuevo Curso` y `+ Nueva Comisión`, el chip del catálogo y el buscador deshabilitado con leyenda, y verificar que `+ Nuevo Curso` **no** aparece dentro de un curso
- [x] 2.4 Mostrar `—` cuando el curso no tiene descripción, en vez de una línea vacía. El caso con descripción se cubre con un curso que crea el propio test, porque el ejemplo devuelve `descripcion: null` en todos sus cursos y no hace falta `stubDataSource` para verlo
- [x] 2.5 Cubrir en `CoursesPage.test.jsx` la vista de cursos: tarjeta por curso del catálogo con sus cuatro datos, navegabilidad a la ruta del curso, y buscador visible pero sin escribir. Verificar que `npm test` pasa en `frontend`

## 3. Vista de comisiones del curso

- [x] 3.1 Filtrar la tabla por el curso de la ruta conservando `COLUMNAS`, su orden y el chip `LLENO` de las vacantes en cero, y verificar que la tabla no muestra comisiones de otro curso
- [x] 3.2 Mostrar el nombre y el código del curso a la vista y la acción `Volver a cursos` que regresa al grid
- [x] 3.3 Mostrar, cuando el código de la ruta no está en el catálogo, un aviso de que el curso no existe con el regreso al catálogo, y verificar que no se dibuja una tabla de comisiones vacía
- [x] 3.4 Reapuntar `abrir()` y los bloques existentes de `CoursesPage.test.jsx` a `/admin/cursos/CUR-101` —hoy esperan la tabla de las cinco comisiones en `/admin/cursos`— y verificar que las columnas y su orden, el arancel formateado, el `LLENO` de `CUR-104` —que ahora vive en la ruta de su propio curso— y las validaciones de `Sede` siguen pasando
- [x] 3.5 Verificar que `shellConsistency.test.jsx` sigue pasando: `/admin/cursos` dibuja tarjeta, insignia y botón, y `CoursesPage` no deja de leer sus datos por `dataService`

## 4. Alta de comisión con el curso de la ruta

- [x] 4.1 Abrir `+ Nueva Comisión` desde un curso con `Curso / Programa` ya elegido y el `select` bloqueado, y verificar que la comisión creada se agrega a la tabla del curso abierto y que el aviso trae el código derivado
- [x] 4.2 Mantener `+ Nueva Comisión` desde la vista de cursos con `Curso / Programa` vacío y editable, y verificar que sigue ofreciendo cualquier curso del catálogo, incluido uno recién creado
- [x] 4.3 Cubrir con tests el payload del alta desde un curso: `curso_id` es el identificador del curso de la ruta, no su código, y el `select` bloqueado no manda otro
- [x] 4.4 Verificar que un alta rechazada desde la vista de un curso deja el formulario abierto con el motivo y sin confirmar, como en la vista de cursos

## 5. Cierre

- [x] 5.1 Correr `npm run lint`, `npm run format:check` y `npm test` en `frontend`, y dejar los tres limpios. Lint y los 337 tests pasan, y los tres archivos del change pasan `prettier --check`. El `format:check` de todo el repo falla en esta máquina por otra cosa: `core.autocrlf=true` deja el árbol de trabajo en CRLF y prettier exige LF, que es el P8 ya anotado en `docs/decisions.md`. Los 95 archivos que culpa son los del checkout, ninguno de este change
- [x] 5.2 Registrar en `docs/decisions.md`, con fecha y autor, las decisiones no funcionales de este change: pantalla única con dos vistas, código del curso como parámetro de ruta, conteo derivado en el cliente y buscador placeholder