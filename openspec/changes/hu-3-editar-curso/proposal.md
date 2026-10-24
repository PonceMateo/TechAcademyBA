# Proposal

## Why

El catálogo ya permite consultar y dar de alta cursos, pero no corregirlos. Un nombre mal escrito o
una descripción desactualizada obliga hoy a dar de baja el curso y crearlo de nuevo, con lo que se
pierden las comisiones y su historial asociado. La historia #3 pide justamente editar sin romper esas
relaciones.

La historia menciona también el código del curso, pero D32 lo define como una columna generada por la
base a partir del `id` y fuera del contrato de entrada. Esta entrega respeta D32: el código no se
edita y la unicidad que se valida es la del nombre, que es el dato que la persona carga.

## What Changes

- Nuevo `PUT /cursos/{id}`, exclusivo de Administración: actualiza nombre y descripción. El código
  no forma parte del contrato y un `codigo` en el cuerpo responde `422`.
- El nombre se normaliza con `normalize_name` antes de guardar y se compara contra el resto del
  catálogo **excluyendo el propio curso**. Un nombre que ya pertenece a otro curso responde `409` e
  identifica el curso existente; un `id` inexistente responde `404`; un nombre vacío responde `422`.
- La respuesta devuelve el curso actualizado con su código generado, para que la pantalla no tenga
  que adivinarlo.
- La tarjeta de curso del catálogo incorpora un menú de tres puntos verticales (`⋮`) con la acción
  **Editar curso**. El menú no reemplaza el click que abre el curso: se detiene la propagación del
  evento y se cierra con `Escape`, con un click afuera o al elegir la acción.
- El modal **Editar Curso** reutiliza `Modal` e `Input`, abre con el nombre y la descripción
  actuales y no ofrece ningún campo de código. Un rechazo deja el modal abierto con el motivo que
  devuelve la fuente; un guardado exitoso actualiza la tarjeta y muestra una confirmación.
- Se actualiza el issue de la HU 3 en el board: sale la edición de código de la descripción y el
  escenario «Código duplicado» pasa a «Nombre duplicado». La desviación respecto del texto original
  queda registrada en `docs/decisions.md`.
- Sin migración: `curso.nombre`, `curso.nombre_norm`, `curso.descripcion` y el índice único
  `uq_curso_nombre_norm` ya existen.

**Fuera de alcance:** editar el código, la baja de cursos, la edición de comisiones (HU 4), la
búsqueda del catálogo y cualquier cambio en el alta.

## Capabilities

### New Capabilities

- `edicion-catalogo`: edición administrativa de un curso del catálogo, con la unicidad del nombre y
  la conservación de sus comisiones.

### Modified Capabilities

- `admin-shell`: la vista de cursos incorpora el menú `⋮` y el modal de edición de curso.

## Impact

- **Backend:** `PUT /cursos/{id}` en `app/api/catalogo.py`, `CursoUpdate` en
  `app/schemas/catalogo.py`, `editar_curso` en `app/services/catalogo.py` y pruebas `pytest` contra
  PostgreSQL real, incluida la autorización por rol.
- **Frontend:** `CoursesPage`, `src/services/dataService.js`, `apiDataSource`, `mockDataSource` y
  pruebas `vitest` del menú, el modal, el rechazo por nombre duplicado y la actualización visible.
- **Documentación:** `docs/decisions.md` registra que el código no se edita y que la unicidad de la
  edición es la del nombre.
- **Backlog:** el issue de la HU 3 se actualiza antes de implementar; el PR usa `Refs #3` y solo
  pasa a `Closes #3` si se cumplen todos los criterios.
