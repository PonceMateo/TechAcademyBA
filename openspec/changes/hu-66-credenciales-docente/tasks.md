# Tasks

## 1. Backend: contraseña inicial y contrato del alta

- [x] 1.1 Mover `generar_password_inicial` de `app/services/alumnos.py` a `app/services/normalization.py` con su tope de 32 caracteres y su fallback genérico, e importarla de nuevo en `alumnos.py` para conservar `servicio_alumnos.generar_password_inicial`; verificar con `pytest app/tests/test_alumnos.py` que la convención de la HU 13 no cambia
- [x] 1.2 Agregar `AltaDocente` a `app/services/padron.py` y hacer que `crear_docente` genere la contraseña, guarde solo su hash y cree la cuenta con `must_change_password = true` en la misma transacción; verificar que la base no guarda la contraseña en claro
- [x] 1.3 Agregar `DocenteCreadoOut` a `app/schemas/padron.py` extendiendo `DocenteOut` con `password_inicial` y usarlo solo como `response_model` de `POST /docentes`; verificar que `GET /docentes`, `PUT /docentes/{id}` y `POST /docentes/{id}/password` siguen devolviendo `DocenteOut`
- [x] 1.4 Actualizar los comentarios de `app/services/padron.py`, `app/api/padron.py`, `app/schemas/padron.py` y `CONTRASEÑA_DEMO` en `app/core/security.py` para que no afirmen que el alta de docente usa la contraseña de demostración
- [x] 1.5 Actualizar `test_alta_de_docente_crea_el_docente_y_su_cuenta` en `app/tests/test_altas_api.py` para esperar `password_inicial`, login con ella y `must_change_password` en `true`
- [x] 1.6 Escribir `app/tests/test_docente_credenciales.py`: convención de la contraseña, login inicial, solo hash en la base, cambio obligatorio, `403` en la ruta de rol mientras está pendiente, cambio de contraseña que habilita el acceso e invalida la inicial, docentes existentes intactos, contrato sin `password_inicial` fuera del alta y validaciones de duplicados y permisos vigentes; correr con `pytest` contra PostgreSQL real

## 2. Frontend: modal de credenciales

- [x] 2.1 Adaptar `crearDocente` en `frontend/src/services/apiDataSource.js` para conservar `password_inicial` en el resultado del alta y no en las filas del padrón; verificar con su prueba unitaria
- [x] 2.2 Adaptar `crearDocente` en `frontend/src/services/mockDataSource.js` para devolver `password_inicial` con `passwordInicial(nombre, dni)`, la misma convención del backend
- [x] 2.3 Actualizar el comentario de `crearDocente` en `frontend/src/services/dataService.js` con el nuevo contrato
- [x] 2.4 Agregar el estado efímero de credenciales a `frontend/src/admin/TeachersPage.jsx`: después del alta cerrar el formulario, actualizar el listado y abrir el modal `Credenciales del docente` con nombre, email, contraseña inicial, aviso de cambio obligatorio y botón `Entendido`; limpiar el estado al cerrar
- [x] 2.5 Actualizar `TeachersPage.test.jsx`: alta exitosa con modal de credenciales, email y contraseña correctos, cierre que oculta la contraseña, contraseña ausente del listado y de la edición, y alta rechazada que mantiene el formulario y no muestra credenciales; correr `npm test -- TeachersPage`
- [x] 2.6 Agregar a `apiDataSource.test.js` la verificación de que `password_inicial` se conserva en el alta y no se inventa en el listado; correr `npm test -- apiDataSource`
- [x] 2.7 Verificar que la pantalla conserva la identidad visual y que no se toca `index.css`, `paleta.js` ni `package-lock.json`

## 3. Documentación y verificación

- [x] 3.1 Registrar D62 en `docs/decisions.md` con fecha y autor: helper compartido, entrega única de credenciales del docente y conservación de las cuentas existentes, tomando D45 y D52 como antecedentes
- [x] 3.2 Correr la suite completa del backend con `pytest` contra PostgreSQL real y confirmar que no hay regresiones en altas, padrón, autenticación ni migraciones
- [x] 3.3 Correr la suite completa del frontend con `npm test` y confirmar que no hay regresiones en las pantallas de Administración
- [x] 3.4 Correr `ruff check .` en el backend y `npm run lint` en el frontend
- [x] 3.5 Revisar que no se modificaron las propuestas históricas de las HU 9 y 13 ni se agregaron migraciones

## Workflow follow-up

- Abrir el pull request con `Refs #66`.
- No hay migración de datos ni pasos de deploy adicionales.
