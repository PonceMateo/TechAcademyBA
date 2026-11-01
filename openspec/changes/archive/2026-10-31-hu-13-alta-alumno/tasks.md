# Tasks

## 1. Backend: contrato, validaciones y alta

- [x] 1.1 Extraer la validación de email del alta de docente a `app/schemas/validators.py` y hacer que `DocenteCreate` la use; verificar con `pytest app/tests/test_altas_api.py` que el alta de docente sigue rechazando emails inválidos
- [x] 1.2 Crear `app/schemas/alumnos.py` con `AlumnoCreate`, `AlumnoOut` y `AlumnoCreadoOut`: DNI de 7 u 8 dígitos con puntos, espacios o guiones, nombre obligatorio, email obligatorio, teléfono opcional y `extra="forbid"`; verificar que un `tipo_documento` en el cuerpo devuelve `422`
- [x] 1.3 Crear `app/services/alumnos.py` con `crear_alumno`, `listar_alumnos`, `generar_password_inicial` y `AlumnoDuplicado`: buscar primero el documento normalizado, después `ensure_email_available`, crear `Alumno` + `Usuario` en una transacción, generar la contraseña inicial y traducir los `IntegrityError` por nombre de restricción; verificar con un caso de alta y un caso de documento repetido
- [x] 1.4 Crear `app/api/alumnos.py` con `POST /alumnos` y `GET /alumnos`, ambos con `require_roles(Rol.ADMIN)`, y registrarlo en `app/api/router.py`; verificar `201` con `password_inicial` en el alta, `409` en duplicados, `403` con rol ajeno y `401` sin token
- [x] 1.5 Escribir `app/tests/test_alumnos.py`: alta correcta, contraseña inicial generada y devuelta una sola vez, DNI inválido, nombre y email faltantes, email inválido, documento duplicado con distinto formato, email duplicado, email tomado en docentes, ambos duplicados, rollback de la cuenta, `must_change_password` en `true`, hash bcrypt, login con la contraseña inicial, listado sin `password_inicial`, contrato sin `tipo_documento` y permisos; correr `pytest app/tests/test_alumnos.py` contra PostgreSQL real
- [x] 1.6 Actualizar el comentario de `CONTRASEÑA_DEMO` en `app/core/security.py` para que refleje que solo el seed y el alta de docente la usan; verificar que el comentario no afirma una decisión futura que el código no toma
- [x] 1.7 Registrar la decisión D44 en `docs/decisions.md` con fecha y autor: alcance DNI-only, sin envío de correo y `409` que solo nombra el campo; verificar que las desviaciones quedan explícitas
- [x] 1.8 Agregar `CambioPasswordRequest` a `app/schemas/auth.py` y `cambiar_password` a `app/services/auth.py`: verificar la contraseña actual, exigir al menos ocho caracteres y que la nueva sea distinta, guardar el hash y dejar `must_change_password` en `false` en la misma transacción; cubrir contraseña actual incorrecta y nueva inválida
- [x] 1.9 Agregar `POST /auth/change-password` a `app/api/auth.py` con `get_current_user`; verificar que responde `SesionActual` actualizada, `401` con la actual incorrecta y `422` con la nueva inválida
- [x] 1.10 Bloquear las cuentas pendientes en `require_roles` de `app/api/deps.py`: `403` con el aviso de cambio pendiente y el encabezado `X-Cambio-Password-Pendiente: true`, dejando accesibles login, `GET /auth/me` y el cambio de contraseña
- [x] 1.11 Escribir `app/tests/test_auth_change_password.py`: cambio exitoso, contraseña actual incorrecta, nueva corta, nueva igual, login con la nueva y rechazo de la vieja, sesión actualizada y bloqueo de las rutas de rol mientras el cambio sigue pendiente; correr `pytest app/tests/test_auth_change_password.py` contra PostgreSQL real
- [x] 1.12 Registrar la decisión D45 en `docs/decisions.md` con fecha y autor: convención `<primer nombre><DNI>`, contraseña mostrada al administrador, solo hash en la base, cambio obligatorio y bloqueo del backend; corregir D44 y P11 para que no afirmen la contraseña demo ni el envío de credenciales

## 2. Frontend: frontera de datos y pantalla de alta

- [x] 2.1 Agregar `crearAlumno` a `frontend/src/services/dataService.js`, a `apiDataSource.js` (`POST /alumnos`) y a `mockDataSource.js` (alta en el store de ejemplo); verificar que las tres implementaciones devuelven la misma forma de alumno, incluida `password_inicial` en el alta
- [x] 2.2 Agregar las pruebas de `crearAlumno` en `apiDataSource.test.js` y en la suite de la frontera: verificar el método, la ruta, el cuerpo enviado, `password_inicial` en la respuesta y el error propagado; correr `npm test -- apiDataSource`
- [x] 2.3 Cambiar `StudentsPage` para cargar con `listarAlumnos()` en vez de `buscarAlumnos()`, deshabilitar el buscador con `Próximamente` y renderizar `Sin comisión` y `—` cuando la fila no tenga inscripción; verificar que la pantalla no llama a `buscarAlumnos`
- [x] 2.4 Agregar el botón `+ Nuevo Alumno` y el modal con `DNI`, `Nombre`, `Email`, `Teléfono`, `Cancelar` y `Guardar Alumno`, reutilizando `Modal`, `Input` y `Button` de Docentes; verificar que no hay componentes visuales nuevos ni cambios en `index.css` o `paleta.js`
- [x] 2.5 Implementar la validación del formulario y el envío: DNI de 7 u 8 dígitos, nombre no vacío, email con formato; en éxito incorporar el alumno, cerrar el modal de alta y abrir el modal de credenciales con usuario y `password_inicial`; en rechazo mantener el modal de alta abierto con el motivo; verificar los tres caminos con pruebas de `StudentsPage`
- [x] 2.6 Actualizar `StudentsPage.test.jsx` para el buscador deshabilitado, los huecos de comisión/categoría/acceso, el modal, la validación, el alta correcta con credenciales y el rechazo; correr `npm test -- StudentsPage`
- [x] 2.7 Verificar que la pantalla conserva la identidad visual: mismos colores, tipografías, navegación y clases que Docentes; revisar el diff de `StudentsPage.jsx` y confirmar que no toca `index.css` ni `paleta.js`
- [x] 2.8 Agregar `changePassword` a `frontend/src/auth/authClient.js` y al `SessionContext`: guardar la sesión actualizada y navegar al inicio del rol cuando el cambio termina
- [x] 2.9 Crear `frontend/src/pages/ChangePasswordPage.jsx` reutilizando la tarjeta y los campos del login, con contraseña actual, nueva y confirmación; mostrar los errores de la fuente sin inventar mensajes
- [x] 2.10 Redirigir a `/cambiar-contrasena` desde el login, `RootRedirect` y `RequireRole` cuando la sesión viene con `must_change_password`; verificar que una URL directa a una sección del rol también queda interceptada
- [x] 2.11 Escribir `ChangePasswordPage.test.jsx` y actualizar `SessionContext.test.jsx` con los casos de cambio exitoso, contraseña actual incorrecta, nueva inválida y redirección del primer ingreso; correr `npm test -- ChangePasswordPage SessionContext`
- [x] 2.12 Extender el backend falso de `frontend/src/test/support.jsx` con `/auth/change-password` y actualizar `dataService.test.jsx` para la nueva forma del alta

## 3. Integración y verificación

- [x] 3.1 Correr la suite completa del backend con `pytest` contra PostgreSQL real y confirmar que no hay regresiones en altas, padrón, auth ni migraciones
- [x] 3.2 Correr la suite completa del frontend con `npm test` y confirmar que no hay regresiones en las pantallas de Administración
- [x] 3.3 Levantar backend y frontend con Docker, dar de alta un alumno desde la pantalla, verificar que aparece en el padrón, que el modal muestra la contraseña inicial y se puede cerrar, que el alumno inicia sesión con ella, que el sistema lo obliga a cambiarla y que no se envía ningún correo
- [x] 3.4 Correr `openspec validate hu-13-alta-alumno --type change --strict` y `openspec status --change hu-13-alta-alumno`; confirmar que todos los artefactos están completos

## Workflow follow-up

- Obtener la aprobación del equipo para las dos desviaciones: DNI-only frente a DNI/Pasaporte y `409` sin los datos del alumno existente.
- Abrir el pull request con `Refs #13`, nunca `Closes #13`, porque la historia se implementa de forma parcial.
- Archivar el change después de la revisión y de que la suite completa pase en el entorno real.
