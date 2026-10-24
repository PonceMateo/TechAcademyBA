# Tasks

## 1. Documentación

- [x] 1.1 Registrar en `docs/decisions.md` que el cupo se valida contra las inscripciones `ACTIVA`, que el rechazo es `422` con la cantidad actual y que la concurrencia queda con el mismo techo que el alta de inscripción. Verificar que la entrada aparece con fecha y autor. → D51.

## 2. Backend

- [x] 2.1 Agregar `ComisionUpdate` con docente, días y horarios, arancel y cupo, sin curso, número, modalidad, sede ni código, y con `extra="forbid"`. Verificar con un test que un campo de más responde `422`.
- [x] 2.2 Implementar `editar_comision` en `app/services/catalogo.py`: validar comisión y docente, contar inscripciones `ACTIVA` y lanzar `CupoInsuficiente` con la cantidad cuando el cupo no alcanza. Verificar con tests de servicio contra PostgreSQL real.
- [x] 2.3 Exponer `PUT /comisiones/{id}` solo para Administración, con `404` para comisión o docente inexistente, `422` para datos inválidos y `422` con la cantidad de inscriptos para el cupo insuficiente. Verificar con tests de API.
- [x] 2.4 Cubrir edición exitosa, cupo igual a los inscriptos, cupo menor, inscripciones `EN_ESPERA` que no ocupan cupo, campos fuera del contrato, docente y comisión inexistentes, y autorización `401`/`403`. Verificar con `pytest` contra PostgreSQL real.

## 3. Frontend

- [x] 3.1 Agregar `editarComision` a `dataService`, a `apiDataSource` y a `mockDataSource`, con la misma validación de cupo en la fuente de ejemplo. Verificar con los tests de la frontera de datos.
- [x] 3.2 Agregar la columna `ACCIONES` con el botón `Editar` a la tabla de comisiones. Verificar que cada fila abre el modal con sus valores.
- [x] 3.3 Agregar el modal `Editar Comisión` con docente, días y horarios, cupo y arancel, sin curso, modalidad, sede ni código, y con la cantidad de inscriptos a la vista. Verificar con tests de edición exitosa.
- [x] 3.4 Validar el cupo antes de enviar, mostrar el rechazo de la fuente sin cerrar el modal y actualizar la fila y las vacantes con la respuesta. Verificar con tests de cupo insuficiente y de fila actualizada.

## 4. Verificación

- [x] 4.1 Ejecutar `pytest` contra PostgreSQL real y confirmar que los tests nuevos, los de inscripciones y los del catálogo pasan. → 462 pruebas verdes.
- [x] 4.2 Ejecutar `vitest run` y confirmar que los tests nuevos y los de la pantalla pasan. → 449 pruebas verdes en 31 archivos.
- [x] 4.3 Probar el flujo completo con `docker compose`: edición de comisión, reducción de cupo válida y rechazo por cupo menor a los inscriptos. Verificado por la interfaz real contra la API: modal precargado con los cuatro datos y `2 inscriptos activos`, rechazo local con la cantidad, guardado con `Comisión CUR001-1 actualizada.`, fila con cupo y vacantes nuevos y persistencia confirmada por `GET /comisiones`.
- [ ] 4.4 Abrir el pull request con `Refs #4`; pasar a `Closes #4` solo si se cumplen todos los criterios.
