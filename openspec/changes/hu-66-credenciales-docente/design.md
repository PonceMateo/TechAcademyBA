# Design

## Context

Ver `proposal.md` para la motivación y `specs/auth-and-roles/spec.md`,
`specs/altas-catalogo/spec.md` y `specs/admin-shell/spec.md` para el contrato.

El alta de docente ya existe y hace lo que la HU 9 pedía: busca duplicados con
`ensure_email_available`, crea `Docente` y `Usuario` en una transacción y traduce los
`IntegrityError` por nombre de restricción. Cambia solo la credencial: la contraseña compartida
por una inicial generada y el indicador de cambio obligatorio.

La generación `<primer nombre><DNI>` vive hoy en `app/services/alumnos.py` y está probada por la
HU 13. El bloqueo de las cuentas pendientes ya está en `require_roles`, y `POST /auth/login`,
`GET /auth/me` y `POST /auth/change-password` son las rutas que permiten salir del estado
pendiente (D45). No hace falta tocar autenticación.

El contrato de alumno ya tiene el antecedente exacto: `AlumnoCreadoOut` extiende la fila del padrón
con `password_inicial` y `GET /alumnos` sigue devolviendo la forma base.

## Goals / Non-Goals

**Goals:**

- Contraseña inicial individual con la convención de la HU 13, una sola vez, sin correo.
- Solo el hash bcrypt en la base y `must_change_password = true` en el alta.
- `password_inicial` únicamente en la respuesta de `POST /docentes`.
- Modal de credenciales en la pantalla de docentes, con el mismo patrón del de alumnos.
- Tests de backend contra PostgreSQL real y de frontend con `vitest`.
- Cuentas docentes existentes intactas.

**Non-Goals:**

- Migración de datos o backfill de `must_change_password`.
- Envío de correo, SMTP o recuperación de contraseña.
- Endpoints o pantallas de autenticación nuevas.
- Cambios en el restablecimiento administrativo de la HU 11.
- Cambios de estilos, tipografías, navegación o dependencias.

## Decisions

### D-A — Helper compartido en `normalization.py`

`generar_password_inicial` se muda de `app/services/alumnos.py` a
`app/services/normalization.py`, que ya reúne las normalizaciones puras del dominio
(`normalize_document`, `normalize_name`, CUIT). `alumnos.py` la importa y la reexporta, así que
`servicio_alumnos.generar_password_inicial` sigue existiendo y sus pruebas no cambian. El alta de
docente la importa del mismo lugar.

**Alternativa descartada:** importar `app.services.alumnos` desde `padron.py`. Funciona, pero
acopla el padrón de docentes a un módulo de otro padrón sin ganar nada; el helper es una regla
compartida, no una regla de alumnos.

**Fallback:** el nombre vacío usa `usuario` en lugar de `alumno`, porque el helper ya no es
exclusivo del padrón de alumnos. Los dos contratos exigen nombre no vacío, así que el caso no se
alcanza desde la API.

### D-B — `AltaDocente` y `DocenteCreadoOut` calcados del alta de alumno

`crear_docente` devuelve un `AltaDocente` con el docente y la contraseña en claro, y la ruta arma
`DocenteCreadoOut` extendiendo `DocenteOut` con `password_inicial`. `GET /docentes` sigue usando
`DocenteOut`, así que el campo no puede filtrarse a la lista.

**Alternativa descartada:** agregar `password_inicial` a `DocenteOut`. La lista y la edición
expondrían un campo que siempre sería `null` y el contrato dejaría de distinguir "no hay" de "no
se muestra".

### D-C — Solo cambia el alta, no las cuentas existentes

La modificación está en `crear_docente`. No hay migración, ni `UPDATE` masivo, ni regeneración de
contraseñas: una cuenta creada antes de la HU 66 conserva su hash, su `must_change_password` y su
sesión. El restablecimiento de la HU 11 sigue igual y, como ya pone el indicador en `true`, no se
toca.

### D-D — El modal reutiliza el patrón de alumnos

`TeachersPage` guarda la credencial en un estado efímero que se llena solo con la respuesta del
alta y se limpia al cerrar el modal. No se guarda en la fila del padrón ni se pasa a la edición:
`createApiDataSource().crearDocente` conserva `password_inicial` en el resultado del alta y la
fuente de ejemplo genera la misma cadena con la misma convención.

## Risks / Trade-offs

- **Contraseña adivinable:** `<primer nombre><DNI>` es una convención conocida; la mitiga el
  cambio obligatorio y el bloqueo de las rutas de rol mientras siga pendiente. Es el mismo riesgo
  aceptado en D45.
- **Docentes históricos:** siguen con la contraseña de demostración. Es deliberado: cambiarla
  afectaría sesiones y credenciales ya entregadas, y el restablecimiento administrativo de la
  HU 11 cubre ese caso cuando el equipo lo decida.
- **Fuente de ejemplo:** el mock no guarda cuentas; replica la cadena para que la pantalla se vea
  igual en los dos modos. Lo que se prueba de punta a punta es el backend.

## Migration Plan

Ninguna. `usuario.password_hash` y `usuario.must_change_password` ya existen y el modelo no
cambia. No se agregan pasos de deploy ni de datos.

## Open Questions

Ninguna: el alcance y las decisiones están definidos por la HU 66 y el antecedente D45.
