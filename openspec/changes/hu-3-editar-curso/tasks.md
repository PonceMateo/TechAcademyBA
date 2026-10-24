# Tasks

## 1. Requisito y documentación

- [x] 1.1 Actualizar el issue #3 del board: quitar la edición de código de la descripción y cambiar el escenario «Código duplicado» por «Nombre duplicado». Verificar con `gh issue view 3`.
- [x] 1.2 Registrar en `docs/decisions.md` que el código no se edita (D32) y que la unicidad de la edición es la del nombre. Verificar que la entrada nueva aparece con fecha y autor.

## 2. Backend

- [x] 2.1 Agregar `CursoUpdate` con nombre y descripción opcional, sin `codigo` y con `extra="forbid"`. Verificar con un test que un `codigo` en el cuerpo responde `422`.
- [x] 2.2 Implementar `editar_curso` en `app/services/catalogo.py`: normalizar el nombre, buscar duplicados excluyendo el propio curso y traducir la carrera concurrente a `409`. Verificar con tests de servicio contra PostgreSQL real.
- [x] 2.3 Exponer `PUT /cursos/{id}` solo para Administración, con `404` para un curso inexistente y `409` para el nombre repetido. Verificar con tests de API.
- [x] 2.4 Cubrir edición exitosa, mismo nombre, nombre duplicado, código en el cuerpo, nombre vacío, curso inexistente y autorización `401`/`403`. Verificar con `pytest` contra PostgreSQL real.

## 3. Frontend

- [x] 3.1 Agregar `editarCurso` a `dataService`, a `apiDataSource` y a `mockDataSource`. Verificar con los tests de la frontera de datos.
- [x] 3.2 Reestructurar la tarjeta para que el cuerpo siga abriendo el curso y agregar el botón `⋮` con `Editar curso`, cierre por `Escape`, click afuera y foco de vuelta. Verificar con tests de teclado y click.
- [x] 3.3 Agregar el modal `Editar Curso` precargado, sin campo de código, con rechazo que no cierra el modal. Verificar con tests de edición exitosa y nombre duplicado.
- [x] 3.4 Actualizar la tarjeta y el `curso` anidado de las comisiones con la respuesta, y mostrar la confirmación. Verificar que la tabla no conserva el nombre viejo después de editar.

## 4. Verificación

- [x] 4.1 Ejecutar `pytest` contra PostgreSQL real y confirmar que los tests nuevos y los del catálogo pasan.
- [x] 4.2 Ejecutar `vitest run` y confirmar que los tests nuevos y los de la pantalla pasan.
- [x] 4.3 Probar el flujo completo con `docker compose`: alta de curso, edición y rechazo por nombre duplicado. Verificado por API (`201` → `200` conservando `CURnnn` → `409` nombrando el curso existente, más `422` con `codigo` y `404` con un id inexistente) y por la interfaz real contra la API: menú `⋮`, modal precargado sin campo de código, `Curso CURnnn actualizado.` en la tarjeta y el modal que queda abierto con el `409`.
- [ ] 4.4 Abrir el pull request con `Refs #3`; pasar a `Closes #3` solo si se cumplen todos los criterios actualizados.
