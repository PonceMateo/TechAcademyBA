# Design

## Context

Ver `proposal.md` para la motivación y `specs/padron-alumnos/spec.md`,
`specs/admin-shell/spec.md` y `specs/domain-schema/spec.md` para el contrato.

El modelo ya tiene todo lo que el alta necesita: `alumno` con `documento`,
`documento_norm`, `tipo_documento`, `email`, `telefono` y `activo`; `usuario` con
`alumno_id`, `rol`, `password_hash`, `must_change_password` e `is_active`. **No hay migración
ni cambio de esquema.**

El backend ya tiene las piezas reutilizables: `require_roles(Rol.ADMIN)` en `app/api/deps.py`,
`ensure_email_available` en `app/services/emails.py`, `normalize_document` en
`app/services/normalization.py`, y `CONTRASEÑA_DEMO` + `hashear_password` en
`app/core/security.py`. El alta de docente en `app/services/padron.py` es el antecedente
directo de la transacción y del manejo de duplicados.

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
- Consulta básica del padrón para que el alta se vea en la pantalla.
- Validaciones de DNI, nombre y email, y rechazo de documento o email duplicados.
- Modal de alta que reutiliza la identidad visual y el patrón del modal de Docentes.
- Tests de backend contra PostgreSQL real y de frontend con `vitest`.

**Non-Goals:**

- Envío de credenciales por email y su tratamiento de fallo.
- Pasaporte, alumno del exterior y documento nulo.
- Inscripción, categoría arancelaria, habilitación, búsqueda y edición.
- Migración de base, cambios de autenticación y cambios de estilos globales.

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

### D-D — Alumno y cuenta en una transacción, sin correo

El servicio crea el `Alumno`, hace `flush` para obtener el `id`, crea el `Usuario` con rol
`ALUMNO`, `alumno_id`, el email del alumno, `password_hash = hashear_password(CONTRASEÑA_DEMO)`,
`must_change_password = False` e `is_active = True`, y confirma una sola vez. Si falla
cualquiera de las dos filas, hace `rollback` y no queda ninguna.

**Por qué `must_change_password = False`:** el flujo de cambio de contraseña no existe y el
cartel que lo anuncia dice que todavía no está disponible. Es la misma decisión que el alta de
docente y el seed (D18).

**Por qué no se llama a `EmailService`:** el envío de credenciales está pendiente de una
decisión del equipo. Llamarlo con la implementación de log simularía un envío que no existe.
La cuenta se crea igual y la pantalla lo dice.

**Alternativa descartada:** crear el alumno sin cuenta y agregarla cuando se decida el envío.
Dejaría un alumno que no puede entrar y obligaría a una migración de datos después. La cuenta
con contraseña demo es reversible; el alumno sin cuenta no se nota hasta que alguien intenta
entrar.

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
y muestra el aviso `Alumno {nombre} dado de alta. La cuenta se creó, pero no se enviaron las
credenciales.` No se vuelve a pedir el padrón: la respuesta del alta ya es el dato confirmado.

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

### D-I — Tests contra la base real y contra la frontera

Backend: un `app/tests/test_alumnos.py` con `pytest` y PostgreSQL real, siguiendo
`test_altas_api.py`: alta correcta, DNI inválido, email inválido, documento duplicado con
formato distinto, email duplicado, email tomado en docentes, alta con ambos duplicados,
transacción revertida, login con la contraseña demo, listado, permisos y contrato sin
`tipo_documento`.

Frontend: se actualiza `StudentsPage.test.jsx` para el buscador deshabilitado, los huecos de
comisión/categoría/acceso, el modal, la validación, el alta correcta y el rechazo. Se agrega la
cobertura de `crearAlumno` en la frontera de datos.

## Risks / Trade-offs

- **Desviaciones sin aprobar** (DNI-only y `409` sin el alumno existente) → quedan escritas en
  el proposal, el design y `docs/decisions.md`; la historia se referencia con `Refs #13` y no se
  cierra. El equipo las aprueba o las cambia antes de archivar.
- **Contraseña demo compartida** → se guarda como hash bcrypt, no se envía por correo y se
  documenta como solo para desarrollo. La contraseña aleatoria por alumno queda para la
  decisión de envío de credenciales.
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
