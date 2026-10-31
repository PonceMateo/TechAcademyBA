# Proposal

## Why

El perfil del docente es hoy una maqueta de solo lectura: `apiDataSource` llama a
`GET /docentes/mi-perfil`, esa ruta no existe en el backend y la pantalla no ofrece ningún control.
El docente no puede corregir su email ni su teléfono sin pedírselo a Secretaría, y tampoco puede
cambiar su contraseña desde su panel, aunque el cambio voluntario ya existe para el alumno desde la
HU 43.

La HU 90 habilita el autoservicio del docente con el mismo contrato que la HU 43: editar los datos
de contacto y cambiar la contraseña reutilizando `POST /auth/change-password`. Los datos de
identidad —nombre, apellido, DNI y CUIL— siguen protegidos y solo los edita Administración.

## What Changes

- **API de autoservicio del docente** (`/docente`, sin identificador en la ruta):
  - `GET /docente/mi-perfil`: nombre, apellido, DNI, CUIL, email, teléfono y comisiones asignadas
    del docente autenticado.
  - `PUT /docente/mi-perfil`: actualiza **solo email y teléfono**. Nombre, apellido, DNI y CUIL no
    están en el contrato y un cuerpo que los incluya responde `422`. Un email que ya pertenece a
    otra persona de cualquiera de los tres padrones responde `409` (M1).
- **Email sincronizado con la cuenta**: el padrón docente y `usuario` se actualizan en la misma
  transacción, así que el login pasa a usar el email nuevo y el anterior deja de identificar la
  cuenta mientras no exista otra cuenta legítima con él.
- **Perfil editable en el panel docente**: email y teléfono con guardado real y avisos de éxito o
  error; identidad en modo solo lectura; se conservan la tarjeta de identidad y las comisiones.
- **Cambio de contraseña desde el perfil**: tarjeta de seguridad con contraseña actual, nueva y
  confirmación. Reutiliza `SessionContext.changePassword` y `POST /auth/change-password`; no se
  agregan endpoints ni se altera el cambio obligatorio del primer ingreso (HU 66).

Fuera de alcance: edición de nombre, apellido, DNI o CUIL; recuperación de contraseña olvidada;
envío de correo; cambios de esquema o migraciones; cualquier cambio a la edición administrativa de
la HU 11.

## Capabilities

### New Capabilities

- `docente-api`: contrato de autoservicio del docente autenticado — consulta de su perfil y de sus
  comisiones y edición de email y teléfono, con aislamiento estricto por cuenta y unicidad de email
  entre los tres padrones.

### Modified Capabilities

- `teacher-shell`: el perfil deja de ser de solo lectura; email y teléfono se editan, la identidad
  queda en solo lectura y se suma la tarjeta de seguridad con el cambio de contraseña.
- `auth-and-roles`: el docente puede cambiar su contraseña desde su perfil con el endpoint
  existente; el cambio obligatorio del primer ingreso se conserva.

## Impact

- **Backend**: `app/api/docente.py`, `app/schemas/docente.py` y `app/services/docente.py` nuevos;
  registro del router en `app/api/router.py`; `TelefonoOpcional` se mueve a
  `app/schemas/validators.py` para compartirlo. Tests con PostgreSQL real en
  `app/tests/test_docente_perfil.py`.
- **Frontend**: `docente/TeacherProfilePage.jsx`, `services/dataService.js`,
  `services/apiDataSource.js`, `services/mockDataSource.js`, `auth/SessionContext.jsx` (actualizar
  el email de la sesión en memoria) y sus pruebas.
- **Datos**: sin migración. `docente.email`, `docente.telefono` y `usuario.email` ya existen.
- **Documentación**: D63 en `docs/decisions.md` por el contrato de autoservicio y la sincronización
  del email con la cuenta.
