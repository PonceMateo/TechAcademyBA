# Proposal

## Why

La historia #13 es una historia **Must** y hoy el padrón de alumnos no tiene alta ni consulta
real: la pantalla `Alumnos e Inscripciones` muestra su estado vacío contra la API porque no
existe ningún endpoint de alumnos. Sin padrón no se pueden construir las inscripciones, las
cobranzas ni la habilitación de accesos, que son las historias que siguen.

Esta entrega implementa el **alta y sus validaciones**, y resuelve las credenciales sin correo:
el administrador da de alta al alumno, el sistema genera una contraseña inicial y se la muestra
para que se la entregue. El alumno debe cambiarla en su primer ingreso. La historia sigue siendo
**parcial** por las desviaciones de DNI-only y del `409`, así que se referencia con `Refs #13`
y no se cierra con `Closes #13`.

## What Changes

- Nuevo `POST /alumnos`, exclusivo de Administración, con DNI obligatorio, nombre, email y
  teléfono opcional.
- Nuevo `GET /alumnos` básico, exclusivo de Administración, para que el alta se vea en el
  padrón. La búsqueda por DNI o email sigue siendo la historia #16.
- Validaciones: DNI de 7 u 8 dígitos —se aceptan puntos, espacios y guiones, y se normaliza—,
  nombre obligatorio, email con formato y teléfono opcional.
- El alta crea en una sola transacción el `Alumno` y su `Usuario` con rol `ALUMNO`. La cuenta
  nace con una **contraseña inicial generada** —`<primer nombre><DNI>`, en minúsculas y sin
  tildes— almacenada como hash bcrypt y con `must_change_password = true`. **No se envía ningún
  correo.**
- La respuesta de `POST /alumnos` incluye `password_inicial` para que el administrador la
  entregue. `GET /alumnos` no la expone y la base guarda solo el hash.
- Nuevo `POST /auth/change-password`: la cuenta autenticada cambia la contraseña con la actual,
  la nueva se guarda como hash y `must_change_password` pasa a `false`.
- Las rutas de rol rechazan con `403` a una cuenta con `must_change_password` en `true`. Solo
  quedan accesibles el login, `GET /auth/me` y el cambio de contraseña.
- Duplicados de documento o email: `409` con un mensaje que nombra el campo repetido. El
  mensaje **no** incluye los datos del alumno existente; es una desviación consciente del
  criterio «muestra el alumno existente» y queda pendiente de aprobación del equipo.
- La pantalla de Alumnos agrega el modal `+ Nuevo Alumno`, reutilizando el diseño y los
  componentes del modal de Docentes. No se modifican colores, tipografías, navegación ni
  estilos globales.
- Al confirmar el alta se abre un modal superpuesto con el usuario y la contraseña inicial, que
  se puede cerrar fácilmente. Una pantalla de cambio obligatorio intercepta el primer ingreso
  antes de entrar a la sección del rol.
- El listado conserva las columnas actuales. Comisión, categoría y acceso se muestran vacíos
  («Sin comisión», «—») para los alumnos que todavía no tienen inscripción.
- El buscador de la pantalla se deshabilita con `Próximamente`; la búsqueda es la historia #16.

**Fuera de alcance:** envío de credenciales por correo, pasaporte y alumno del exterior (HU 47),
inscripción y categoría arancelaria (HU 14 y #15), búsqueda (HU 16), edición (HU 17), cambios de
esquema o migraciones.

## Capabilities

### New Capabilities

- `padron-alumnos`: alta y consulta básica del padrón de alumnos, sus validaciones, la
  unicidad de documento y email, y la creación transaccional de la cuenta de acceso.

### Modified Capabilities

- `admin-shell`: la pantalla `Alumnos e Inscripciones` agrega el alta real, consume el padrón
  desde la API, deshabilita el buscador, muestra los huecos de comisión, categoría y acceso
  mientras no exista una inscripción, y muestra las credenciales iniciales después del alta.
- `auth-and-roles`: el alta de alumno genera la contraseña inicial y deja la cuenta pendiente de
  cambio; se agrega el cambio obligatorio y el bloqueo de las rutas de rol mientras el cambio
  siga pendiente.
- `domain-schema`: el esquema sigue admitiendo pasaporte y documento nulo, pero el alta de
  esta entrega acepta **solo DNI**. El alta con pasaporte y sin DNI queda diferida a la
  HU 47, que está en `Won't`. También se cierra la nota que dejaba la validación de email del
  alumno para el change del alta.

## Impact

- **Backend:** rutas de padrón y de cambio de contraseña, esquemas de entrada y salida, servicio
  de alta y consulta, bloqueo de cuentas pendientes en `require_roles`, y pruebas `pytest` contra
  PostgreSQL real. No hay migración: `alumno`, `usuario` y `must_change_password` ya existen.
- **Frontend:** `StudentsPage`, `ChangePasswordPage`, el contexto de sesión, el guard de rol, el
  cliente de autenticación, la frontera `dataService`, las implementaciones `api` y `mock`, y
  pruebas `vitest`. Sin cambios de identidad visual.
- **Documentación:** `docs/decisions.md` registra la convención de contraseña inicial, el cambio
  obligatorio y la decisión de no enviar credenciales por correo (D45).
- **Backlog:** implementación parcial por las desviaciones DNI-only y del `409`; el issue #13 se
  referencia, no se cierra.
