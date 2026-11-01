# Design

## Context

Ver `proposal.md - Why`. Restricciones que condicionan el diseño:

- `Docente` ya tiene `email` y `telefono`; `Usuario` tiene el email de login y el vínculo
  `docente_id`. No hace falta ninguna columna nueva.
- `ensure_email_available` ya acepta `exclude_docente_id` y `exclude_usuario_id` (M1, D5), así que
  el docente puede conservar su propio email sin chocar contra su propia fila.
- La edición administrativa (`editar_docente`, D52) ya sincroniza padrón y cuenta en una sola
  transacción: el autoservicio usa el mismo patrón.
- El cambio de contraseña ya existe: `POST /auth/change-password`, `SessionContext.changePassword`
  y la tarjeta de seguridad de la HU 43. Las cuentas docentes nuevas nacen con
  `must_change_password = true` (HU 66), y el cambio obligatorio sigue en `ChangePasswordPage`.
- El perfil docente actual muestra `Especialidad` y `Sede de referencia`, datos del maquetado que
  el padrón no tiene: no hay columna de especialidad ni de sede del docente.

## Goals / Non-Goals

**Goals:**

- Un contrato de autoservicio que no pueda alcanzar el perfil de otro docente.
- Email y teléfono editables con las mismas validaciones y errores que la HU 43.
- Que el email nuevo sirva para entrar y el anterior deje de servir.
- Cambio de contraseña desde el perfil sin duplicar autenticación.

**Non-Goals:**

- Editar nombre, apellido, DNI o CUIL.
- Recuperación de contraseña, envío de correo o cambios de esquema.
- Mostrar especialidad o sede inventadas.

## Decisions

**Router `/docente` en singular, sin identificador.**
Se repite la decisión de la HU 43 (D60): el docente sale de `usuario.docente` de la cuenta
autenticada y ninguna ruta acepta un `docente_id`, así que no hay parámetro que cambiar para pedir
el perfil de otro. El frontend pasa a llamar `/docente/mi-perfil`.
*Alternativa descartada:* declarar `/docentes/mi-perfil` en el router de Administración antes de
`/{docente_id}`; funciona, pero mezcla roles en un módulo y deja la ruta dependiendo del orden.

**Rol `DOCENTE` con `require_roles`, sin dependencia nueva.**
Una cuenta con cambio de contraseña pendiente recibe el `403` de D45 que ya existe y la pantalla que
lo fuerza sigue siendo `ChangePasswordPage`.

**El contrato de edición tiene dos campos y nada más.**
`PerfilDocenteUpdate` es `extra="forbid"` con `email` y `telefono`. Nombre, apellido, DNI y CUIL no
están declarados: un intento de mandarlos es `422` y nunca llega al servicio. El teléfono vacío se
guarda como no informado, con el mismo `TelefonoOpcional` de la HU 43, que se mueve a
`schemas/validators.py` para no importar un esquema de alumno desde el de docente.

**Padrón y cuenta en una sola transacción.**
`actualizar_perfil` valida la unicidad con `ensure_email_available` excluyendo al propio docente y a
su propia cuenta, escribe `docente.email`, `docente.telefono` y `usuario.email`, y confirma una sola
vez. Un `IntegrityError` por `uq_docente_email` o `uq_usuario_email` se traduce al mismo `409` del
chequeo previo. Así el login con el email nuevo funciona en el acto y el viejo deja de resolver la
cuenta, salvo que otra cuenta legítima lo tenga.

**El perfil devuelve datos reales y comisiones, no especialidad ni sede.**
`GET /docente/mi-perfil` devuelve nombre, apellido, DNI, CUIL, email, teléfono y las comisiones
asignadas (`codigo`, `nombre_curso`, `horario`, `estado`). `Especialidad` y `Sede de referencia`
desaparecen de la pantalla porque el padrón no las registra: se prefiere el estado real al literal
del maquetado. El estado de la comisión sale de `activo`, la única columna que existe (M2).

**La contraseña reutiliza el camino existente.**
La tarjeta de seguridad llama a `SessionContext.changePassword({ redirigir: false })`, que ya usa
`POST /auth/change-password`. El backend sigue exigiendo la contraseña actual y guardando solo el
hash; la confirmación se valida en el formulario, igual que en la HU 43. No se agrega endpoint,
pantalla ni lógica de autenticación, y el cambio obligatorio del primer ingreso no se toca.

**El email de la sesión se actualiza en memoria.**
`SessionContext` gana `updateSession`, que mezcla los campos cambiados en el estado. Después de
guardar, el perfil llama con el email devuelto por la API: la barra y el panel muestran el correo
nuevo sin una segunda llamada a `GET /auth/me`. Al recargar, la sesión se relee de la base.

## Risks / Trade-offs

- **Carrera entre dos cuentas que piden el mismo email** → el `IntegrityError` se traduce al mismo
  `409` y la transacción no deja una fila actualizada y la otra no.
- **La pantalla pierde especialidad y sede** → son datos del maquetado que el padrón no registra;
  se documenta el cambio en `teacher-shell` en lugar de inventarlos o conservarlos de la fuente
  falsa.
- **El email de la sesión vive en memoria** → se actualiza al guardar y se relee de la base al
  recargar; no se reemite el token porque el token no lleva el email.
- **Un docente sin cuenta vinculada** → el modelo lo impide con el CHECK; el servicio lo nombra y
  la ruta responde `403` en vez de crear una cuenta implícita.
