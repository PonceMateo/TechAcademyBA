# Design

## Contexto

El padrón de alumnos (HU 13, 16) ya tiene `Alumno` y `Usuario` vinculados por `alumno_id`, con
`activo` e `is_active` en el modelo. La autenticación resuelve la cuenta contra la base en cada
request y rechaza `is_active = false`. La pantalla usa `src/services/` como única frontera y los
componentes `Modal`, `Button`, `Input` y `Table`.

## Decisiones

### D-A — Edición con `PUT` y contrato completo

`PUT /alumnos/{id}` recibe documento, nombre, email y teléfono, los mismos campos del alta. Se
elige `PUT` y no `PATCH` porque el modal edita el formulario completo y así el contrato no admite
campos ausentes que dejarían el registro a medio actualizar. El esquema reutiliza el validador de
DNI y el tipo `EmailConForma` del alta (`extra="forbid"`).

El servicio normaliza el documento, busca duplicados **excluyendo el propio alumno** y verifica
el email con `ensure_email_available(..., exclude_alumno_id=..., exclude_usuario_id=...)`. Después
actualiza el `Alumno` y el `Usuario` vinculado (`nombre` y `email`) en la misma transacción. El
`id`, el legajo, las inscripciones, las imputaciones y el historial no se tocan.

### D-B — Restablecimiento administrativo de contraseña

`POST /alumnos/{id}/password` recibe `new_password` y guarda su hash bcrypt. La contraseña
anterior deja de servir porque el hash se reemplaza. La cuenta queda con
`must_change_password = true`, de modo que el alumno deba elegir una propia en el siguiente
ingreso; el login y `POST /auth/change-password` siguen siendo el mecanismo existente. No se
genera ni se devuelve la contraseña en claro y no se envía correo.

Se exige el mínimo de ocho caracteres y el máximo de bcrypt, las mismas reglas que el cambio de
contraseña (`app/services/auth.py`). Si el alumno no tiene cuenta, responde `409` con un mensaje
claro.

### D-C — Baja lógica con las columnas existentes

`DELETE /alumnos/{id}` marca `alumno.activo = false` y `usuario.is_active = false` en una sola
transacción. No hay `DELETE` SQL ni cascada: las claves foráneas y el historial quedan intactos.
`GET /alumnos` filtra `activo = true`; el login ya rechaza la cuenta inactiva. La operación es
idempotente en la respuesta, pero una segunda baja informa que el alumno ya está dado de baja
(`409`) para que la interfaz no confirme dos veces algo que no volvió a pasar.

La baja no modifica el email ni el documento del alumno: sus índices únicos siguen reservando
esos datos, como pide respetar las reglas de unicidad existentes.

### D-D — Interfaz sin componentes nuevos

La tabla agrega una columna **Acciones** con tres botones `Button` de tamaño chico. Los modales de
edición y contraseña reutilizan `Modal` e `Input`; la baja usa un `Modal` de confirmación con el
nombre del alumno y un botón `peligro`. Las operaciones se resuelven por `dataService`, nunca
importando mocks. Después de editar se fusiona la respuesta con la fila para conservar comisión,
categoría y acceso; después de la baja la fila desaparece y se muestra un `role="status"`.

Los tres botones comparten `tamano="chico"` y `whitespace-nowrap`, de modo que «Restablecer
contraseña» no se parte en dos líneas y la columna se mantiene alineada en pantallas angostas.

### D-E — Reactivación del mismo registro

`crear_alumno` sigue rechazando cualquier duplicado. Cuando la pantalla recibe un `409`, consulta
`GET /alumnos/reactivable?documento=&email=`; el endpoint devuelve el alumno inactivo solo si los
identificadores no chocan con un registro activo, otro padrón ni otra cuenta. Con la confirmación
del administrador, `POST /alumnos/{id}/reactivar` reutiliza el registro: valida otra vez los
conflictos dentro de la transacción, actualiza los datos del formulario, reactiva `Alumno` y
`Usuario`, genera una nueva contraseña inicial con la convención de la HU 13 y deja
`must_change_password = true`. Si el administrador cancela, no se ejecuta ninguna escritura.

## Riesgos

- El `PUT` podría cambiar el email y dejar el login viejo sin efecto; por eso la sincronización
  del `Usuario` ocurre en la misma transacción.
- Una baja lógica no libera el DNI ni el email. Es intencional: reactivar o corregir el registro
  es una operación futura, y reutilizar esos datos hoy podría asociar pagos a otra persona.

## Migración

Ninguna. Las columnas `alumno.activo` y `usuario.is_active` ya existen desde el esquema inicial.
