# Tasks

## 1. Documentación

- [x] 1.1 Registrar en `docs/decisions.md` la sincronización de `usuario.nombre` y `usuario.email` en la edición, el `must_change_password = true` del restablecimiento y la continuidad de D33 para el CUIL. Verificar que la entrada aparece con fecha y autor.

## 2. Backend

- [x] 2.1 Agregar `DocenteUpdate` con nombre, apellido, DNI, email y teléfono, sin CUIL y con `extra="forbid"`, y `RestablecerPasswordRequest` con `new_password`. Verificar con un test que un `cuil` en el cuerpo responde `422`.
- [x] 2.2 Implementar `editar_docente` en `app/services/padron.py`: normalizar el DNI, buscar duplicados excluyendo al propio docente, verificar el email con `ensure_email_available` excluyendo docente y usuario, y sincronizar la cuenta en la misma transacción. Verificar con tests de servicio contra PostgreSQL real.
- [x] 2.3 Implementar `restablecer_password` para docentes con el hash, las reglas de longitud y `must_change_password = true`, y el rechazo `409` si no hay cuenta. Verificar con tests de servicio.
- [x] 2.4 Exponer `PUT /docentes/{id}` y `POST /docentes/{id}/password` solo para Administración, con `404`, `409` y `422` según corresponda. Verificar con tests de API.
- [x] 2.5 Cubrir edición exitosa, mismos datos, DNI duplicado, email duplicado en docentes y en otro padrón, CUIL en el cuerpo, docente inexistente, restablecimiento exitoso, contraseña corta, docente sin cuenta y autorización `401`/`403`. Verificar con `pytest` contra PostgreSQL real.

## 3. Frontend

- [x] 3.1 Agregar `editarDocente` y `restablecerPasswordDocente` a `dataService`, a `apiDataSource` y a `mockDataSource`. Verificar con los tests de la frontera de datos.
- [x] 3.2 Agregar la columna `ACCIONES` con `Editar` y `Restablecer contraseña` a la tabla de docentes. Verificar que cada fila abre el modal con sus datos.
- [x] 3.3 Agregar el modal `Editar Docente` sin CUIL, con validación local y rechazo que no cierra el modal, y actualizar la fila conservando las comisiones. Verificar con tests de edición exitosa y duplicado.
- [x] 3.4 Agregar el modal de restablecimiento con validación de coincidencia y longitud, aviso de cambio obligatorio y mensaje de confirmación. Verificar con tests de contraseña válida y de contraseñas distintas.

## 4. Verificación

- [x] 4.1 Ejecutar `pytest` contra PostgreSQL real y confirmar que los tests nuevos, los del padrón de docentes y los de autenticación pasan.
- [x] 4.2 Ejecutar `vitest run` y confirmar que los tests nuevos y los de la pantalla pasan.
- [x] 4.3 Probar el flujo completo con `docker compose`: edición de docente, login con el email nuevo, restablecimiento de contraseña y cambio obligatorio en el ingreso.
- [ ] 4.4 Abrir el pull request con `Refs #11`; pasar a `Closes #11` solo si se cumplen todos los criterios.
