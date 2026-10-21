# Tasks

## 1. Requisito y documentación

- [x] 1.1 Ampliar la HU 17 en el CSV oficial con la baja lógica y sus escenarios.
- [x] 1.2 Registrar la decisión en `docs/decisions.md`.
- [ ] 1.3 Revisar la propuesta con el equipo antes de cerrar la historia.

## 2. Backend

- [x] 2.1 Agregar `AlumnoUpdate` y `RestablecerPasswordRequest` con las validaciones existentes.
- [x] 2.2 Implementar `editar_alumno`, `restablecer_password` y `dar_de_baja` en el servicio.
- [x] 2.3 Exponer `PUT /alumnos/{id}`, `POST /alumnos/{id}/password` y `DELETE /alumnos/{id}` solo para Administración.
- [x] 2.4 Filtrar los alumnos dados de baja en `GET /alumnos` y traducir duplicados a `409`.
- [x] 2.5 Implementar la detección del alumno inactivo y la reactivación con nueva contraseña inicial.
- [x] 2.6 Tests contra PostgreSQL real: edición, duplicados, sincronización de la cuenta, contraseña, baja lógica, reactivación y autorización.

## 3. Frontend

- [x] 3.1 Agregar `editarAlumno`, `restablecerPasswordAlumno` y `eliminarAlumno` a la frontera de datos y a las dos fuentes.
- [x] 3.2 Incorporar la columna de acciones y los modales de edición, contraseña y confirmación de baja.
- [x] 3.3 Actualizar el estado visible y mostrar la confirmación de la baja.
- [x] 3.4 Incorporar el aviso de reactivación cuando el alta choca con un alumno dado de baja.
- [x] 3.5 Tests de Vitest para las tres operaciones, los rechazos y la reactivación.

## 4. Verificación

- [x] 4.1 Ejecutar `pytest` contra PostgreSQL real.
- [x] 4.2 Ejecutar `vitest run`.
- [x] 4.3 Comprobar que las HU 13 y 18 siguen funcionando.
- [ ] 4.4 Abrir el pull request con `Refs #17` (no cerrar hasta cumplir todos los criterios).
