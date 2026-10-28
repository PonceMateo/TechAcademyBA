# Design

## Context

Ver `proposal.md - Why`. Restricciones que condicionan el diseño:

- El backend no tiene router de alumno: `frontend/src/services/apiDataSource.js` ya declara
  `inscripcionesAlumno: '/alumno/inscripciones'`, `pagosAlumno: '/alumno/pagos'` y
  `perfilAlumno: '/alumno/mi-perfil'`, y esas rutas responden `404` hoy.
- El estado de habilitación ya se deriva en `app/services/habilitacion.py` con la misma regla que ve
  Administración (`derivar_estado`), incluido el override de Secretaría.
- `Comision` guarda `fecha_inicio` (nullable), `dias_horarios` (texto resumido) y las filas
  estructuradas de `ComisionHorario`. No existe `fecha_fin`.
- `Clase` existe con `fecha`, `tema` y `link_virtual`, pero todavía nadie carga clases: eso llega con
  las historias #33 y #34.
- `Usuario.email` es el email de login y está duplicado en `Alumno.email`; toda edición que toque el
  email tiene que sincronizar las dos filas en una transacción (patrón de `editar_alumno`, D52).
- Las cuentas de alumno nacen con `must_change_password` en `true`: mientras no lo cambien, todo
  endpoint de rol responde `403`. El cambio de contraseña (`POST /auth/change-password`) ya existe y
  levanta el indicador.

## Goals / Non-Goals

**Goals:**

- Un contrato de autoservicio que no pueda filtrar datos de otro alumno, ni por defecto ni por
  error de parámetro.
- Que la pantalla del alumno diga lo mismo que Administración sobre el estado de habilitación.
- Un cronograma con fechas reales mientras no exista cronograma cargado, sin inventar datos.
- Que el guardado del perfil sea real y falle de forma visible (email duplicado, formato inválido).

**Non-Goals:**

- Pagos del alumno (HU 40), link de la clase (HU 39) y certificados.
- Cargar clases o cronograma definitivo: eso es #33/#34 y otro contrato.
- Agregar columna `fecha_fin` o una tabla de cronograma nueva.

## Decisions

**Router `/alumno` con recurso propio, no `/alumnos` con filtro.**
Los endpoints de `/alumnos` son de Administración y reciben `alumno_id` por parámetro; reutilizarlos
obligaría a un filtro por cuenta dentro de cada handler y dejaría la puerta abierta a un IDOR si
alguna ruta lo olvida. `/alumno` (singular) no acepta ningún identificador: el alumno sale de
`usuario.alumno` de la cuenta autenticada. Además coincide con las rutas que el frontend ya espera.
*Alternativa descartada:* `/alumnos/me`, que choca con el orden de rutas de `/{alumno_id}`.

**El rol `ALUMNO` se exige con `require_roles`, y el bloqueo por contraseña pendiente queda incluido.**
No se agrega una dependencia nueva: la cuenta pendiente recibe el `403` de cambio de contraseña que
ya define D45, y la pantalla que la fuerza ya existe.

**Un solo lugar deriva el estado de habilitación.**
`GET /alumno/inscripciones` y `GET /alumno/inscripciones/{codigo}` llaman a
`habilitacion.derivar_estado`. No se recalcula en el schema ni en el frontend: así la causa que ve el
alumno no puede diferir de la administrativa (HU 42) y el forzado de Secretaría se ve igual.

**Horarios estructurados + resumen de texto.**
La respuesta trae `horarios: [{dia, inicio, fin}]` y el resumen `horario` ya persistido en
`comision.dias_horarios`. El frontend renderiza los chips con `resumenHorarios` (ya existe en
`domain/horarios.js`) y usa el texto como línea de la tarjeta. Devolver las dos formas evita que la
pantalla tenga que parsear el texto y mantiene compatibilidad con la tarjeta actual.

**Próximos encuentros derivados de `ComisionHorario`, no de `Clase`.**
Con la comisión y sus horarios alcanza para saber qué días hay clase; el tema se toma de `Clase`
cuando exista una fila con esa fecha, y si no el encuentro viaja sin tema: la pantalla **no completa
ningún texto de tema en su lugar** (no existe un "tema a confirmar" en el dominio). Cada encuentro
trae además el `horario` de su día —el rango de la grilla para ese día de la semana— porque la agenda
y el detalle tienen que decir a qué hora se dicta, no solo en qué fecha. Se devuelven los próximos
cuatro encuentros desde el día corriente. La lista completa del ciclo espera a la fecha de fin, que
no existe todavía.
*Techo asumido:* el cálculo no conoce feriados ni suspensiones; cuando #33/#34 carguen las clases
reales, la fuente pasa a ser esa tabla y el cálculo queda como respaldo. Se marca con un comentario
`ponytail:` en el servicio.

**Perfil: dos campos editables y validación compartida.**
`PUT /alumno/mi-perfil` usa un esquema `extra="forbid"` con solo `email` y `telefono`; el documento,
el nombre y el id no están en el contrato, así que un intento de mandarlos es `422` y nunca llega al
servicio. El email se valida con `EmailConForma` y la unicidad con `ensure_email_available`,
excluyendo la propia cuenta; el teléfono con `TelefonoE164` y vacío se guarda como `None`. El
servicio actualiza `Alumno.email`/`Alumno.telefono` y `Usuario.email` en una sola transacción, con el
mismo patrón de `editar_alumno`. Un `409` de email duplicado se traduce al mensaje del conflicto.

**Contraseña en el panel, sin ruta nueva.**
La tarjeta de seguridad del perfil reutiliza `SessionContext.changePassword`, que ya llama a
`POST /auth/change-password`. No se toca `ChangePasswordPage`, que sigue siendo la pantalla del
cambio obligatorio.

**Detalle de cursada: `404` único para "no existe" y "no es tuya".**
Así la respuesta no permite enumerar comisiones. El frontend muestra el mismo estado de "no
encontré esa cursada" que ya usa `CourseDetailPage`.

**Rediseño alineado al Figma ya versionado.**
La recomposición visual usa `docs/design/figma-dashboards-overhaul/Dashboard · Alumno.json` y
`Diseño-Alumno.png` como autoridad de estilo, y los componentes existentes (`Card`, `Badge`, `Input`,
`Campo`, `Button`).

**La raíz `/alumno` es `Dashboard` y `Mis Cursos` es una pantalla propia.**
El tablero conserva lo que ya estaba —los cuatro indicadores y `Tu agenda`— y las tarjetas de las
inscripciones se mudan a `/alumno/cursos`, alcanzables desde un ítem nuevo del panel lateral. Es el
único cambio de menú y de rutas del change, pedido por el usuario: no se agregan pantallas más allá
de esa y no se mueve nada de `Mis Pagos` ni de `Mi Perfil`. El ítem `Dashboard` es `exacta` sobre
`/alumno`; el de `Mis Cursos` no, así el detalle de una cursada sigue destacando y nombrando a la
sección en el breadcrumb.

**El mock se alinea al contrato, no al revés.**
`mockDataSource` pasa a devolver la misma forma que la API (`horarios`, `cronograma.fin` en `null`,
sin `link`) y gana `actualizarPerfilAlumno`, para que los tests de pantalla corran contra la misma
forma que producción.

## Risks / Trade-offs

- **Email desincronizado entre `Alumno` y `Usuario`** → se actualizan en la misma transacción y un
  test de la API comprueba que el login usa el email nuevo.
- **Un alumno recién creado no puede ver su panel hasta cambiar la contraseña** (403 de D45) →
  comportamiento intencional y ya existente; la tarjeta de seguridad del perfil sirve después del
  primer cambio, y la pantalla de cambio obligatorio cubre el primer ingreso.
- **Próximos encuentros derivados no contemplan feriados** → se muestran como agenda estimada y,
  cuando las clases reales existan, el tema y la existencia de la fila salen de `Clase`.
- **Rediseño visual sin captura validada por el cliente** → se limita a la composición ya aprobada en
  Figma y no agrega bloques nuevos; cualquier bloque sin dato se pinta como estado vacío, no con un
  literal de ejemplo.
- **La causa del bloqueo puede ser un texto técnico** (`falta la empresa`, `pago pendiente`) → se
  muestra tal cual porque es la misma que ve Administración (HU 42); cambiarla es un cambio de
  dominio aparte.
