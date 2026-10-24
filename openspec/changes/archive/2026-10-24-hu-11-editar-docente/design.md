# Design

## Contexto

`Docente` y `Usuario` están vinculados por `usuario.docente_id`; el alta crea los dos en una sola
transacción. El email es único dentro de cada padrón y `ensure_email_available` sostiene la unicidad
cruzada entre docentes, alumnos y cuentas. La autenticación ya soporta `must_change_password`: el shell
redirige al cambio de contraseña mientras la cuenta esté pendiente. La pantalla `TeachersPage` ya tiene
búsqueda, alta y la tabla con la columna de comisiones asignadas.

## Decisiones

### D-A — `PUT` con el formulario del alta y la cuenta sincronizada

`PUT /docentes/{id}` recibe nombre, apellido, DNI, email y teléfono, los mismos campos del alta, con
`extra="forbid"`. El CUIL sigue fuera del contrato (D33); un `cuil` en el cuerpo responde `422`.

El servicio normaliza el DNI y busca otro docente con el mismo `dni_norm` **excluyendo el propio
docente**. El email se verifica con `ensure_email_available(..., exclude_docente_id=docente.id,
exclude_usuario_id=usuario.id)`, así que guardar el mismo email no choca contra la propia fila ni
contra la propia cuenta. Después actualiza el `Docente` y el `Usuario` vinculado (`nombre` y `email`)
en la misma transacción. El `id`, las comisiones y el historial no se tocan.

Un docente sin `Usuario` se edita igual: la sincronización se saltea y no se crea una cuenta implícita.
El alta ya garantiza que todo docente nuevo tenga cuenta; este caso solo cubre datos históricos.

### D-B — Restablecimiento con el mecanismo que ya existe

`POST /docentes/{id}/password` recibe `new_password`, guarda su hash bcrypt y deja
`must_change_password = true`. Reutiliza `hashear_password`, `PASSWORD_MIN_LENGTH`, `MAX_PASSWORD_BYTES`
y `PasswordInvalida` de `app/services/auth.py`, las mismas reglas que el cambio de contraseña y que el
restablecimiento de alumnos. La contraseña anterior deja de servir porque el hash se reemplaza. No se
genera ni se devuelve la contraseña en claro y no se envía correo.

Si el docente no tiene cuenta, responde `409`; si la contraseña no cumple la regla, `422` sin tocar la
anterior. El docente entra con la contraseña definida y el shell lo lleva al cambio obligatorio, que ya
existe (`ChangePasswordPage` y `POST /auth/change-password`).

### D-C — La misma forma de la pantalla de alumnos

La tabla agrega una columna `ACCIONES` con dos `Button` chicos y `whitespace-nowrap`, igual que la
tabla de alumnos. Los modales reutilizan `Modal`, `Input` y `Campo`. El de edición abre con los datos
de la fila y no tiene campo de CUIL. El de contraseña pide la nueva y su confirmación, valida en la
pantalla que coincidan y que tengan al menos 8 caracteres, y avisa que el docente deberá cambiarla.

Después de editar se fusiona la respuesta con la fila conservando `comisiones` y
`cantidad_comisiones`, que la respuesta de edición no vuelve a calcular. Después de restablecer se
cierra el modal y se muestra un `role="status"`; no se muestra la contraseña.

### D-D — Frontera de datos y pruebas

`dataService.editarDocente(id, datos)` y `dataService.restablecerPasswordDocente(id, newPassword)`
delegan en la fuente configurada. `apiDataSource` hace `PUT /docentes/{id}` y
`POST /docentes/{id}/password`; `mockDataSource` actualiza su store y valida duplicados y contraseña
para que las pruebas de pantalla puedan ejercitar los rechazos sin red. Los tests de backend cubren
duplicados, sincronización de la cuenta, contraseña, `404`, `422` y autorización.

## Riesgos

- Cambiar el email cambia el usuario de login. La sincronización en la misma transacción evita que la
  cuenta quede apuntando a un correo viejo; si el docente tenía la sesión abierta, el token sigue
  valiendo hasta que venza, igual que en la edición de alumnos.
- El restablecimiento obliga a cambiar la contraseña en el próximo ingreso. Es intencional y usa el
  flujo existente; si el docente no puede entrar, el problema es la contraseña definida, no el flujo.
- El CUIL queda fuera de la edición por ahora. Cuando el equipo lo incorpore, hay que agregarlo al
  alta y a la edición con la misma validación de unicidad y dígito verificador (P7).

## Migración

Ninguna. `docente`, `usuario`, sus índices únicos y `must_change_password` ya existen.
