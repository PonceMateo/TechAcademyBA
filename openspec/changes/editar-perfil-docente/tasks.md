# Tasks

## 1. Backend: autoservicio del docente

- [x] 1.1 Mover `TelefonoOpcional` de `app/schemas/alumno.py` a `app/schemas/validators.py` y reimportarlo en el esquema de alumno; verificar con `pytest app/tests/test_alumno_api.py` que el contrato de la HU 43 no cambia
- [x] 1.2 Crear `app/schemas/docente.py` con `PerfilDocenteOut`, `ComisionDocenteOut` y `PerfilDocenteUpdate` (`extra="forbid"`, solo `email` y `telefono`)
- [x] 1.3 Crear `app/services/docente.py` con `docente_de`, `obtener_perfil` y `actualizar_perfil`; sincronizar `docente.email`/`docente.telefono` con `usuario.email` en una transacción, usar `ensure_email_available` con los dos `exclude_*` y traducir `IntegrityError` a `EmailAlreadyRegistered`
- [x] 1.4 Crear `app/api/docente.py` con `GET` y `PUT /docente/mi-perfil` bajo `require_roles(Rol.DOCENTE)` y registrar el router en `app/api/router.py`
- [x] 1.5 Escribir `app/tests/test_docente_perfil.py`: consulta propia, edición de email y teléfono, login con el email nuevo, rechazo del anterior, duplicado en los tres padrones, email propio permitido, `422` por campos de identidad y formato, `401` sin token y `403` con otro rol, sin ruta para otro docente

## 2. Frontend: perfil editable y seguridad

- [x] 2.1 Agregar `actualizarPerfilDocente` a `dataService.js`, `apiDataSource.js` (con `PUT /docente/mi-perfil`) y `mockDataSource.js` con la misma validación de unicidad del mock
- [x] 2.2 Agregar `updateSession` a `auth/SessionContext.jsx` para reflejar el email nuevo en la sesión en memoria
- [x] 2.3 Recomponer `docente/TeacherProfilePage.jsx`: identidad en solo lectura, formulario de email y teléfono, tarjeta `Seguridad` con `changePassword({ redirigir: false })`, avisos de éxito y error y actualización de los valores visibles
- [x] 2.4 Actualizar `TeacherProfilePage.test.jsx`: edición exitosa, error de duplicado sin perder lo ingresado, identidad deshabilitada, cambio de contraseña y confirmación distinta; correr `npm test -- TeacherProfilePage`
- [x] 2.5 Verificar que no se tocan estilos globales, `paleta.js`, dependencias ni `package-lock.json`

## 3. Documentación y verificación

- [x] 3.1 Registrar D63 en `docs/decisions.md` con fecha y autor: router `/docente` sin identificador, contrato de dos campos y sincronización del email con la cuenta
- [x] 3.2 Correr la suite del backend con `pytest` contra PostgreSQL real y confirmar que no hay regresiones
- [x] 3.3 Correr `npm test` en el frontend y confirmar que no hay regresiones en los shells
- [x] 3.4 Correr `ruff check .` y `npm run lint`

## Workflow follow-up

- Abrir el pull request con `Refs #90`.
- No hay migración ni pasos de deploy adicionales.
