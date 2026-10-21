# Design

## Context

Ver `proposal.md` para la motivación y `specs/padron-alumnos/spec.md`,
`specs/admin-shell/spec.md` y `specs/domain-schema/spec.md` para el contrato.

El modelo ya tiene todo lo que el alta necesita: `alumno` con `documento`,
`documento_norm`, `tipo_documento`, `email`, `telefono` y `activo`; `usuario` con
`alumno_id`, `rol`, `password_hash`, `must_change_password` e `is_active`. **No hay migración
ni cambio de esquema.**

El backend ya tiene las piezas reutilizables: `require_roles(Rol.ADMIN)` y
`get_current_user` en `app/api/deps.py`, `ensure_email_available` en `app/services/emails.py`,
`normalize_document` en `app/services/normalization.py`, y `hashear_password` +
`verificar_password` en `app/core/security.py`. El login ya expone `must_change_password` y el
`get_current_user` resuelve la cuenta contra la base en cada request (M7), que es lo que permite
bloquear a una cuenta pendiente sin esperar a que venza el token. El alta de docente en
`app/services/padron.py` es el antecedente directo de la transacción y del manejo de duplicados.

El frontend tiene la pantalla de Alumnos en modo lectura y el modal de Docentes ya resuelto.
`apiDataSource` declara la ruta `/alumnos` pero solo la usa para `GET`; `mockDataSource` tiene
`listarAlumnos` y `buscarAlumnos`. Los tests de pantalla usan la fuente de ejemplo y el backend
falso de `test/support.jsx`.

El contrato de `domain-schema` y la historia #13 hablan de DNI **o pasaporte**. Esta entrega
decide DNI-only y lo registra como desviación pendiente de aprobación; la HU 47 sigue en
`Won't`.

## Goals / Non-Goals

**Goals:**

- Alta real de alumno con DNI, nombre, email y teléfono opcional, y su cuenta de acceso.
- Contraseña inicial generada con el nombre y el DNI, mostrada al administrador y guardada solo
  como hash.
- Cambio obligatorio de contraseña en el primer ingreso, con bloqueo del backend mientras siga
  pendiente.
- Consulta básica del padrón para que el alta se vea en la pantalla.
- Validaciones de DNI, nombre y email, y rechazo de documento o email duplicados.
- Modal de alta que reutiliza la identidad visual y el patrón del modal de Docentes.
- Tests de backend contra PostgreSQL real y de frontend con `vitest`.

**Non-Goals:**

- Envío de credenciales por correo: la decisión del equipo es no enviarlas (D45).
- Recuperación de contraseña olvidada y edición de datos del alumno (HU 17).
- Pasaporte, alumno del exterior y documento nulo.
- Inscripción, categoría arancelaria, habilitación y búsqueda.
- Migración de base y cambios de estilos globales.

## Decisions

### D-A — Módulos nuevos en vez de agrandar los de docentes

Se agregan `app/api/alumnos.py`, `app/schemas/alumnos.py` y `app/services/alumnos.py`, y el
router se suma en `app/api/router.py`. El router de `app/api/padron.py` tiene prefijo
`/docentes`, así que meter ahí `/alumnos` obligaría a renombrar el módulo y a tocar todas sus
rutas.

**Alternativa descartada:** renombrar `padron.py` a `docentes.py` y agregar alumnos en el mismo
archivo. Es un diff más grande, sin ganancia funcional, y mezcla dos padrones que el modelo
mantiene separados.

### D-B — DNI validado en el contrato, guardado crudo y normalizado

`AlumnoCreate` acepta `documento`, `nombre`, `email` y `telefono`. Es `extra="forbid"`, así que
un `tipo_documento` en el JSON es `422`. El validador de `documento` acepta solo dígitos,
puntos, espacios y guiones; después de quitarlos exige 7 u 8 dígitos. El servicio guarda el
texto informado en `documento`, el resultado de `normalize_document` en `documento_norm` y
`tipo_documento = DNI`.

**Por qué no guardar solo el normalizado:** la pantalla muestra el documento como lo escribió
la secretaría y el modelo tiene dos columnas justamente para eso. El índice único va sobre
`documento_norm`, que es lo que hace colisionar `38.456.789` con `38456789`.

**Alternativa descartada:** validar solo “no vacío” y dejar que la base decida. Un DNI con
letras terminaría en `documento_norm = NULL` y el CHECK `documento_y_tipo_juntos` lo
rechazaría con un error crudo, sin mensaje útil para el formulario.

### D-C — Una sola regla de email para docentes y alumnos

La validación de email del alta de docente se extrae a `app/schemas/validators.py` y la usan
`DocenteCreate` y `AlumnoCreate`. La regla sigue siendo la mínima: algo antes de la arroba, una
arroba y un dominio con punto que no termine en punto.

**Alternativa descartada:** duplicar el validador. Dos copias de una regla que el spec exige
igual tienden a divergir, y el costo de compartirla es un módulo de una función.

### D-D — Alumno y cuenta en una transacción, con contraseña inicial generada

El servicio crea el `Alumno`, hace `flush` para obtener el `id`, genera la contraseña inicial,
crea el `Usuario` con rol `ALUMNO`, `alumno_id`, el email del alumno,
`password_hash = hashear_password(password_inicial)`, `must_change_password = True` e
`is_active = True`, y confirma una sola vez. Si falla cualquiera de las dos filas, hace
`rollback` y no queda ninguna. Devuelve un `AltaAlumno` con el alumno y la contraseña en claro;
la ruta arma con eso el `201`.

**Convención de la contraseña inicial (D45):** `<primer nombre><DNI>`, en minúsculas, sin
tildes, sin signos y con el DNI normalizado a dígitos. `Juan Ignacio Pérez` con `38.456.789`
recibe `juan38456789`; `Rocío Álvarez` con `30.111.222`, `rocio30111222`. Se corta el nombre a
32 caracteres para no acercarse nunca al límite de 72 bytes de bcrypt. Es una clave que la
secretaría puede dictar en voz alta y que el alumno cambia en su primer ingreso.

**Por qué `must_change_password = True`:** la contraseña la conoce el administrador y sigue una
convención adivinable. La cuenta no puede quedar con esa clave como definitiva: el backend
rechaza las rutas de rol hasta que el alumno elija una propia.

**Por qué no se llama a `EmailService`:** la decisión del equipo es **no enviar credenciales por
correo**. La contraseña se muestra una sola vez en la respuesta del alta y el administrador se
la entrega. Ninguna implementación de correo interviene, ni siquiera la de log, porque ya no hay
envío que simular.

**Alternativa descartada:** crear el alumno sin cuenta y agregarla después. Dejaría un alumno
que no puede entrar y obligaría a una migración de datos. La cuenta con cambio obligatorio es
reversible y deja el flujo completo desde el primer día.

### D-E — Duplicados: documento primero, mensaje que nombra el campo

Antes de insertar, el servicio busca un alumno por `documento_norm`. Si existe, lanza
`AlumnoDuplicado("documento")`. Si no, llama a `ensure_email_available`, que cubre alumnos,
docentes y cuentas de usuario. La inserción sigue protegida por los índices únicos: una carrera
entre dos altas se traduce por nombre de restricción (`uq_alumno_documento_norm`,
`uq_alumno_email`, `uq_usuario_email`) al mismo `AlumnoDuplicado`.

El orden documento → email es deliberado: cuando los dos están repetidos, el mensaje habla del
documento, que es el identificador que la secretaría tiene a mano. El `409` devuelve solo el
mensaje; **no** incluye los datos del alumno existente. Es la desviación del criterio de la
historia #13 y queda pendiente de aprobación.

**Alternativa descartada:** devolver un `detail` estructurado con el alumno existente. Es más
útil para la pantalla, pero el equipo eligió no exponerlo en esta entrega; el contrato puede
ampliarse sin migración cuando se apruebe.

### D-F — El listado devuelve el padrón, con los huecos en `null`

`GET /alumnos` devuelve `id`, `nombre`, `documento`, `tipo_documento`, `email`, `telefono` y
`activo`, más `comision`, `categoria`, `porcentaje_beca` y `acceso` en `null`. No hace join con
inscripciones ni calcula habilitación: esas columnas pertenecen a historias posteriores y hoy
no tienen datos. El frontend las renderiza como `Sin comisión` y `—`, siguiendo D43.

**Alternativa descartada:** adelantar el join de inscripción y habilitación para llenar la
tabla. Sería implementar parte de HU 14, #15 y #16 sin sus reglas y con datos que todavía no
existen.

### D-G — El modal reutiliza Docentes y valida en el cliente

`StudentsPage` agrega el botón `+ Nuevo Alumno` en las acciones del `Card`, y un `Modal` con
`Input` para DNI, Nombre, Email y Teléfono, y los botones `Cancelar` y `Guardar Alumno`. No se
crean componentes visuales nuevos ni se tocan estilos globales: se usan los mismos `Modal`,
`Input`, `Button` y clases que `TeachersPage`.

La validación del cliente replica la del backend antes de enviar: DNI de 7 u 8 dígitos con
puntos, espacios o guiones; nombre no vacío; email con el mismo formato mínimo. Los errores se
muestran por campo con el `error` del `Input`. Un rechazo de la fuente deja el modal abierto con
lo cargado y muestra el `message` del error; un fallo de red no confirma nada.

Al confirmar, la pantalla incorpora a la lista el alumno que devuelve la fuente, cierra el modal
y muestra las credenciales en un modal superpuesto: usuario (el email) y `password_inicial`. El
modal se puede cerrar y no deja un bloque de credenciales fijo en la página. La contraseña no se
guarda en el estado global ni se incorpora a la fila del padrón; vive solo en ese modal.

**Alternativa descartada:** recargar `GET /alumnos` después del alta. Agrega una ida y vuelta y
una ventana en la que el alta ya existe pero la tabla todavía no lo muestra; el patrón de
Docentes ya resuelve esto incorporando la respuesta.

### D-H — El buscador se deshabilita, no se implementa

La pantalla deja de llamar a `buscarAlumnos` y carga `listarAlumnos()` una vez. El campo queda
deshabilitado con la leyenda `Próximamente`, como los controles Won't de D20. La búsqueda por
DNI o email es la HU 16 y no se adelanta.

**Alternativa descartada:** filtrar en memoria las filas ya cargadas. La historia #16 pide
buscar por DNI **o email** y contra el padrón completo; un filtro local sobre una lista ya
traída daría una falsa sensación de búsqueda y obligaría a reescribirlo después.

### D-I — El cambio obligatorio es una pantalla y un bloqueo del backend

`POST /auth/change-password` recibe `current_password` y `new_password`, exige la actual,
valida que la nueva tenga al menos ocho caracteres y sea distinta, guarda el hash y deja
`must_change_password = False` en la misma transacción. Responde con `SesionActual`, ya
actualizada, para que el frontend no tenga que releer `/auth/me`.

El bloqueo vive en `require_roles` y no en `get_current_user`: `/auth/me` y
`/auth/change-password` tienen que seguir siendo alcanzables para que la cuenta pueda salir del
estado pendiente. Cualquier ruta que declare un rol responde `403` con
`Tenés que cambiar tu contraseña antes de usar el sistema.` y el encabezado
`X-Cambio-Password-Pendiente: true`.

En el frontend, `SessionContext.signIn` manda a `/cambiar-contrasena` cuando la sesión viene
pendiente, `RequireRole` repite el guard para una recarga o una URL directa, y
`ChangePasswordPage` reutiliza la tarjeta y los campos del login. Al cambiar, el contexto
actualiza la sesión y navega al inicio del rol. La pantalla `ChangePasswordPage` es la misma
para los tres roles: el requisito es de la cuenta, no de la sección.

**Alternativa descartada:** dejar que el frontend solo muestre un aviso y confiar en que el
usuario no navegue. El backend es la frontera de seguridad (D2): una cuenta pendiente que
llamara la API directamente seguiría entrando. El aviso se conserva como respaldo, pero la
regla se aplica en el servidor.

### D-J — Tests contra la base real y contra la frontera

Backend: `app/tests/test_alumnos.py` y `app/tests/test_auth_change_password.py` con `pytest` y
PostgreSQL real: alta correcta, contraseña inicial generada y devuelta una sola vez, DNI
inválido, email inválido, documento duplicado con formato distinto, email duplicado, email
tomado en docentes, alta con ambos duplicados, transacción revertida, hash bcrypt,
`must_change_password = true`, bloqueo de rutas de rol, cambio exitoso, contraseña actual
equivocada, nueva inválida, login con la nueva y rechazo de la vieja, listado, permisos y
contrato sin `tipo_documento`.

Frontend: se actualiza `StudentsPage.test.jsx` para el buscador deshabilitado, los huecos de
comisión/categoría/acceso, el modal, la validación, el alta correcta con credenciales y el
rechazo. Se agrega `ChangePasswordPage.test.jsx`, los casos de cambio en
`SessionContext.test.jsx`, y la cobertura de `crearAlumno` en la frontera de datos.

## Risks / Trade-offs

- **Desviaciones sin aprobar** (DNI-only y `409` sin el alumno existente) → quedan escritas en
  el proposal, el design y `docs/decisions.md`; la historia se referencia con `Refs #13` y no se
  cierra. El equipo las aprueba o las cambia antes de archivar.
- **Contraseña inicial adivinable** → sigue la convención acordada (`<primer nombre><DNI>`), la
  conoce el administrador y por eso la cuenta nace con cambio obligatorio. El backend bloquea
  las rutas de rol hasta que se cambie; la contraseña no se envía por correo.
- **La contraseña en claro viaja una vez** → solo en la respuesta de `POST /alumnos` y solo en
  el modal de credenciales de la pantalla. No se guarda en el padrón, no vuelve en `GET /alumnos` y la base
  guarda exclusivamente el hash.
- **El alta DNI-only no cubre al alumno del exterior** → la HU 47 sigue en `Won't` y el modelo
  conserva las columnas para cuando se defina.
- **La tabla muestra huecos** → se muestran `Sin comisión` y `—`, nunca datos inventados; las
  columnas se llenan cuando existan las inscripciones.
- **Tests existentes de la pantalla** → cambian las expectativas del buscador y de las filas;
  se actualizan en el mismo change para que la suite siga siendo la descripción del contrato.

## Migration Plan

No hay migración de base. El despliegue es aditivo: primero el backend con `POST /alumnos` y
`GET /alumnos`, después el frontend que los consume. El rollback consiste en retirar las rutas
y el modal; los alumnos ya creados siguen siendo válidos y no hay datos que borrar.
