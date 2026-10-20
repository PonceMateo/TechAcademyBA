# Tasks

## 1. Backend: contrato, validaciones y alta

- [x] 1.1 Extraer la validación de email del alta de docente a `app/schemas/validators.py` y hacer que `DocenteCreate` la use; verificar con `pytest app/tests/test_altas_api.py` que el alta de docente sigue rechazando emails inválidos
- [x] 1.2 Crear `app/schemas/alumnos.py` con `AlumnoCreate` y `AlumnoOut`: DNI de 7 u 8 dígitos con puntos, espacios o guiones, nombre obligatorio, email obligatorio, teléfono opcional y `extra="forbid"`; verificar que un `tipo_documento` en el cuerpo devuelve `422`
- [x] 1.3 Crear `app/services/alumnos.py` con `crear_alumno`, `listar_alumnos` y `AlumnoDuplicado`: buscar primero el documento normalizado, después `ensure_email_available`, crear `Alumno` + `Usuario` en una transacción y traducir los `IntegrityError` por nombre de restricción; verificar con un caso de alta y un caso de documento repetido
- [x] 1.4 Crear `app/api/alumnos.py` con `POST /alumnos` y `GET /alumnos`, ambos con `require_roles(Rol.ADMIN)`, y registrarlo en `app/api/router.py`; verificar `201` en el alta, `409` en duplicados, `403` con rol ajeno y `401` sin token
- [x] 1.5 Escribir `app/tests/test_alumnos.py`: alta correcta, DNI inválido, nombre y email faltantes, email inválido, documento duplicado con distinto formato, email duplicado, email tomado en docentes, ambos duplicados, rollback de la cuenta, `must_change_password` en `false`, hash bcrypt, login con `Demo2026!`, listado con campos nulos, contrato sin `tipo_documento` y permisos; correr `pytest app/tests/test_alumnos.py` contra PostgreSQL real
- [x] 1.6 Actualizar el comentario de `CONTRASEÑA_DEMO` en `app/core/security.py` para que refleje que el alta de alumno de esta fase también la usa; verificar que el comentario no afirma una decisión futura que el código no toma
- [x] 1.7 Registrar la decisión D44 en `docs/decisions.md` con fecha y autor: alcance DNI-only, contraseña demo, sin envío de correo y `409` que solo nombra el campo; verificar que la entrada existe y que las cuatro desviaciones quedan explícitas

## 2. Frontend: frontera de datos y pantalla de alta

- [x] 2.1 Agregar `crearAlumno` a `frontend/src/services/dataService.js`, a `apiDataSource.js` (`POST /alumnos`) y a `mockDataSource.js` (alta en el store de ejemplo); verificar que las tres implementaciones devuelven la misma forma de alumno
- [x] 2.2 Agregar las pruebas de `crearAlumno` en `apiDataSource.test.js` y en la suite de la frontera: verificar el método, la ruta, el cuerpo enviado y el error propagado; correr `npm test -- apiDataSource`
- [x] 2.3 Cambiar `StudentsPage` para cargar con `listarAlumnos()` en vez de `buscarAlumnos()`, deshabilitar el buscador con `Próximamente` y renderizar `Sin comisión` y `—` cuando la fila no tenga inscripción; verificar que la pantalla no llama a `buscarAlumnos`
- [x] 2.4 Agregar el botón `+ Nuevo Alumno` y el modal con `DNI`, `Nombre`, `Email`, `Teléfono`, `Cancelar` y `Guardar Alumno`, reutilizando `Modal`, `Input` y `Button` de Docentes; verificar que no hay componentes visuales nuevos ni cambios en `index.css` o `paleta.js`
- [x] 2.5 Implementar la validación del formulario y el envío: DNI de 7 u 8 dígitos, nombre no vacío, email con formato; en éxito incorporar el alumno, cerrar el modal y mostrar el aviso de credenciales no enviadas; en rechazo mantener el modal abierto con el motivo; verificar los tres caminos con pruebas de `StudentsPage`
- [x] 2.6 Actualizar `StudentsPage.test.jsx` para el buscador deshabilitado, los huecos de comisión/categoría/acceso, el modal, la validación, el alta correcta y el rechazo; correr `npm test -- StudentsPage`
- [x] 2.7 Verificar que la pantalla conserva la identidad visual: mismos colores, tipografías, navegación y clases que Docentes; revisar el diff de `StudentsPage.jsx` y confirmar que no toca `index.css` ni `paleta.js`

## 3. Integración y verificación

- [x] 3.1 Correr la suite completa del backend con `pytest` contra PostgreSQL real y confirmar que no hay regresiones en altas, padrón, auth ni migraciones
- [x] 3.2 Correr la suite completa del frontend con `npm test` y confirmar que no hay regresiones en las pantallas de Administración
- [x] 3.3 Levantar backend y frontend con Docker, dar de alta un alumno desde la pantalla, verificar que aparece en el padrón, que puede iniciar sesión con `Demo2026!` y que no se envía ningún correo
- [x] 3.4 Correr `openspec validate hu-13-alta-alumno --type change --strict` y `openspec status --change hu-13-alta-alumno`; confirmar que todos los artefactos están completos

## Workflow follow-up

- Obtener la aprobación del equipo para las dos desviaciones: DNI-only frente a DNI/Pasaporte y `409` sin los datos del alumno existente.
- Abrir el pull request con `Refs #13`, nunca `Closes #13`, porque la historia se implementa de forma parcial.
- Archivar el change después de la revisión y de que la suite completa pase en el entorno real.
