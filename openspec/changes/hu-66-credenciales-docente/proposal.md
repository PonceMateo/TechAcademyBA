# Proposal

## Why

La HU 9 implementó el alta de docentes, pero la cuenta se crea con la contraseña de demostración
documentada y con `must_change_password = false`. Esa decisión se tomó cuando el flujo de cambio de
contraseña todavía no existía; hoy sí existe, porque la HU 13 lo construyó para los alumnos (D45), y
una contraseña compartida y pública deja al docente con una credencial que todo el equipo conoce.

La HU 66 alinea el alta de docentes con el comportamiento que ya tiene el alta de alumnos: una
contraseña inicial individual, entrega única al administrador y cambio obligatorio en el primer
ingreso. Las cuentas docentes que ya existen no se tocan.

## What Changes

- `POST /docentes` genera una contraseña inicial con la convención `<primer nombre><DNI>`: primer
  nombre en minúsculas, sin tildes ni signos, y el DNI normalizado a dígitos. `María González` con
  `30.111.222` recibe `maria30111222`.
- La generación se extrae a un helper compartido en `app/services/normalization.py` y el alta de
  alumno pasa a usarlo: una sola convención para los dos padrones.
- El docente y su `Usuario` se siguen creando en una sola transacción, con `rol DOCENTE`, el hash
  bcrypt de la contraseña inicial y `must_change_password = true`. La base no guarda la contraseña
  en claro.
- La respuesta de `POST /docentes` pasa a `DocenteCreadoOut`, que agrega `password_inicial` junto
  con la fila del docente. `GET /docentes`, `PUT /docentes/{id}` y el restablecimiento de la HU 11
  no la exponen.
- No cambian las validaciones de DNI, CUIL opcional, email, teléfono, duplicados ni el permiso
  `ADMIN`. No se envía correo ni se usa SMTP.
- El primer ingreso reutiliza `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password`,
  `require_roles`, `SessionContext`, `RequireRole` y `ChangePasswordPage`: no se crean endpoints ni
  pantallas de autenticación.
- La pantalla `Docentes` cierra el formulario después del alta, actualiza el listado y abre un
  modal con nombre, email, contraseña inicial, el aviso de cambio obligatorio y el botón
  `Entendido`. Al cerrarlo, las credenciales desaparecen: no quedan en el listado, en la edición
  ni al recargar.
- **Docentes existentes:** no se regeneran contraseñas, no se actualiza `must_change_password` de
  forma masiva, no cambian sus sesiones y se conserva el restablecimiento administrativo de la
  HU 11. **No hay migración de datos.**

**Fuera de alcance:** envío de credenciales por correo, recuperación de contraseña olvidada,
cambios de esquema, nuevas dependencias y cualquier modificación a las propuestas históricas de las
HU 9 y 13.

## Capabilities

### Modified Capabilities

- `altas-catalogo`: el alta de docente genera una contraseña inicial y la devuelve únicamente en
  `POST /docentes`; la cuenta nace con cambio obligatorio.
- `auth-and-roles`: las cuentas del alta de docente pasan a nacer con `must_change_password` en
  `true` y contraseña inicial generada, igual que las de alumno; se conservan los escenarios del
  requisito y se agregan los del primer ingreso y la entrega única.
- `admin-shell`: el alta de docente muestra el modal de credenciales iniciales después de
  confirmar y las oculta al cerrarlo.

## Impact

- **Backend:** `app/services/normalization.py`, `app/services/alumnos.py`,
  `app/services/padron.py`, `app/schemas/padron.py`, `app/api/padron.py`, el comentario de
  `CONTRASEÑA_DEMO` en `app/core/security.py` y pruebas `pytest` contra PostgreSQL real. Sin
  migración: `usuario.password_hash` y `usuario.must_change_password` ya existen.
- **Frontend:** `TeachersPage`, `dataService`, `apiDataSource`, `mockDataSource` y sus pruebas
  `vitest`. Sin cambios de identidad visual ni de estilos globales.
- **Documentación:** `docs/decisions.md` registra la entrega única de credenciales del docente y la
  conservación de las cuentas existentes (D62).
- **Backlog:** la HU 66 se referencia con `Refs #66`. No se modifica el estado del issue.
