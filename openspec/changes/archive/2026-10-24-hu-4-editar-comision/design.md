# Design

## Contexto

`Comision` guarda `curso_id`, `docente_id`, `numero`, `dias_horarios`, `cupo_maximo`, `arancel`,
`modalidad` y `sede_id`. Las vacantes no son una columna: se derivan de `cupo_maximo` menos las
inscripciones con estado `ACTIVA` (D10). El alta de inscripción ya usa ese mismo criterio para
rechazar una comisión llena. La tabla de la vista de comisiones no tiene hoy columna de acciones.

## Decisiones

### D-A — `PUT` con los cuatro datos editables

`PUT /comisiones/{id}` recibe `docente_id`, `dias_horarios`, `arancel` y `cupo_maximo`. El curso, el
número, la modalidad y la sede quedan fuera del contrato, y el esquema usa `extra="forbid"`: un
cliente que los envíe recibe `422` en vez de que el campo se ignore. Se elige `PUT` y no `PATCH` por
la misma razón que en las otras ediciones: el modal edita el formulario completo de los campos que
esta historia habilita.

El docente se valida con `session.get` antes de escribir, para que un identificador inexistente
responda `404` y no un `500` de clave foránea. La comisión se busca por `id`; si no existe, `404`.

### D-B — El cupo se valida contra las inscripciones `ACTIVA`

El servicio cuenta las inscripciones `ACTIVA` de la comisión, el mismo criterio que `listar_comisiones`
usa para `vacantes` y que el alta de inscripción usa para rechazar una comisión llena. Si el nuevo cupo
es menor que esa cantidad, lanza `CupoInsuficiente` con el número actual y la ruta responde `422` con
un mensaje en es-AR que dice cuántos inscriptos hay.

No se valida en la base con un CHECK porque la cantidad de inscriptos vive en otra tabla y un CHECK no
puede consultarla. El `422` es la validación de negocio; la comisión queda con el cupo anterior.

**Techo asumido:** la cuenta y el `UPDATE` no están serializados contra una inscripción simultánea,
igual que hoy el alta de inscripción cuenta y después inserta. A la escala declarada del proyecto no
se agrega un lock; si el volumen lo justificara, el arreglo es `SELECT ... FOR UPDATE` sobre la
comisión en los dos caminos, sin cambiar el contrato.

### D-C — Modal de edición y columna de acciones

La tabla agrega una columna `ACCIONES` con un `Button` chico por fila, igual que la tabla de alumnos.
El modal reutiliza `Modal`, `Input` y `Campo`: muestra el docente como selección del padrón, los días y
horarios como texto, y el cupo y el arancel como números. No muestra curso, modalidad, sede ni código.

El modal muestra la cantidad de inscriptos actuales calculada como `cupo_maximo - vacantes` de la fila
que abrió. Es un dato de contexto para que la secretaría vea el piso antes de guardar; la fuente sigue
siendo la autoridad y su rechazo se muestra tal cual. La validación local del cupo evita un viaje
innecesario, pero no reemplaza la del servidor.

### D-D — Actualizar la fila con la respuesta

La respuesta trae la comisión con el curso anidado, el docente, el código derivado y las vacantes
recalculadas. La pantalla reemplaza la fila por `id` en el estado de comisiones; no vuelve a pedir el
listado completo. El chip del catálogo no cambia porque la cantidad de comisiones no cambió.

### D-E — Frontera de datos y pruebas

`dataService.editarComision(id, datos)` delega en la fuente configurada. `apiDataSource` hace
`PUT /comisiones/{id}` y `mockDataSource` actualiza su store con las mismas validaciones de cupo, para
que las pruebas de pantalla puedan ejercitar el rechazo sin red. Los tests de backend cubren el
`422` con la cantidad de inscriptos, el `404` del docente y de la comisión, y la autorización.

## Riesgos

- Dos ediciones o una edición y una inscripción simultáneas pueden dejar el cupo por debajo de los
  inscriptos. Es la misma carrera que ya tiene el alta de inscripción; se documenta y no se resuelve
  en esta entrega.
- Si la fila quedó vieja, el modal muestra una cantidad de inscriptos desactualizada; el servidor
  rechaza igual y la pantalla muestra el número real que devuelve el error.
- La modalidad y la sede no se editan. Corregirlas sigue requiriendo dar de baja la comisión y crearla
  de nuevo; queda para una historia posterior.

## Migración

Ninguna. Las columnas y la tabla de inscripciones ya existen.
