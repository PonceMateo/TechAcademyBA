# Design

## Context

Ver `proposal.md` — Why. Este cambio se aplica después de la HU 64 en la misma rama: cuenta con
`GET /alumnos/{id}` con todas las inscripciones y con el formulario de categoría de una inscripción.
Hoy `app/services/habilitacion.py` ya calcula, dentro de `derivar_estado`, el arancel requerido y lo
acreditado, pero no los devuelve; el estado se expone y los montos se descartan. El componente
`Modal` ya maneja `Escape`, atrapa el foco, apila modales y devuelve el foco al elemento que lo
abrió. `Table` no soporta filas clickeables ni enfocables.

## Goals / Non-Goals

**Goals:**

- Una sola pantalla de lectura por alumno, con una pestaña por inscripción y sus importes.
- Que el saldo y el estado de habilitación salgan de la misma regla, sin duplicar el cálculo.
- Que la ficha sea operable con teclado y que las acciones existentes funcionen desde el modal.
- Retirar del padrón la columna y la acción de categoría, dejando la edición en la pestaña.

**Non-Goals:**

- Editar inscripciones ni pagos desde la ficha: solo la categoría.
- Guardar el arancel en la inscripción o emitir cuotas: no hay modelo de cuotas (D-esquema).
- Un endpoint nuevo de ficha: se extiende el detalle de la HU 64.
- Rutas propias para la ficha: la historia pide un modal.

## Decisions

### Se extiende `GET /alumnos/{id}`, no se crea otro endpoint

Cada inscripción del detalle suma `arancel`, `monto_requerido`, `total_pagado`,
`total_observado` y `saldo_pendiente`. Alternativa: `GET /alumnos/{id}/ficha` con otro contrato;
se descartó porque el detalle ya trae alumno, inscripciones, empresa y acceso, y dos endpoints
parecidos obligarían a la pantalla a hacer dos llamadas y a mantener dos esquemas en paralelo.

### `derivar_montos` es la única regla de dinero

Se extrae de `derivar_estado` una función `derivar_montos(session, inscripcion)` que devuelve el
requerido, lo acreditado y lo observado. `derivar_estado` la usa para decidir habilitado o bloqueado
y el detalle la usa para exponer los importes. Alternativa: calcular el saldo en el esquema o en el
servicio de alumnos; se descartó porque el criterio de beca, corporativo y cobros observados
quedaría escrito dos veces y podría divergir del estado que ve el alumno.

Reglas: el requerido es el arancel actual de la comisión, ajustado por el porcentaje de la beca
parcial; cero para beca total; nulo para corporativo. Lo acreditado descuenta; lo observado no
descuenta y se informa aparte. El saldo nunca es negativo. Para corporativo el saldo es nulo y la
pantalla muestra «A cargo de la empresa».

El requerido se cuantiza a centavos (`ROUND_HALF_UP`) antes de compararlo con lo acreditado y de
calcular el saldo. Sin eso, un arancel con centavos y una beca de dos decimales dejan un saldo de
fracciones que la pantalla formatea como `$0,00` mientras el acceso está bloqueado.

### La ficha es un modal montado en el padrón, con datos pedidos al abrir

`StudentsPage` guarda la fila seleccionada, abre la ficha y pide el detalle en ese momento; no hay
ruta nueva. Alternativa: una ruta `/admin/alumnos/:id` con deep link; se descartó porque la historia
pide un modal, el shell no tiene rutas anidadas de alumno y obligaría a rehacer la navegación. Se
vuelve a pedir el detalle al abrir para no mostrar un saldo viejo después de cobrar.

### `Table` gana filas navegables de forma opcional

Se agrega a `Table` una prop opcional para click y teclado en la fila: `tabIndex=0`, Enter y espacio
abren la ficha, `aria-label` con el nombre del alumno y un estilo de fila accionable. Las tablas que
no la pasan siguen igual. Alternativa: un botón en la primera celda; se descartó porque la historia
pide pulsar la fila y usar Enter con el foco en ella.

### La ficha se apoya en los modales que ya existen

Editar, Eliminar y Restablecer contraseña abren los mismos modales actuales desde el menú ⋮. El
componente `Modal` ya apila y da `Escape` solo al de arriba, así que la ficha queda debajo sin
cambios. Al terminar una edición o un restablecimiento se refresca la ficha y la fila; al confirmar
la baja se cierra la ficha y se recarga el padrón. El foco vuelve solo a la fila que abrió la ficha;
si la fila ya no existe por la baja, el `Modal` no fuerza el foco.

### Cambiar la categoría desde la pestaña

La pestaña abierta ofrece **Categoría**, que reutiliza el formulario y el `PATCH` de la HU 64 y
refresca solo el detalle del alumno. Así el padrón pierde la acción sin perder la capacidad de
recategorizar una inscripción.

### La habilitación solo se deriva para inscripciones activas

`derivar_estado` no mira el estado de la inscripción: una cursada `COMPLETADA` sin pagos se
derivaría como bloqueada. El detalle devuelve `acceso` nulo para lo que no está `ACTIVA`, la
pestaña muestra el estado de la inscripción y los importes se siguen informando, porque la deuda de
una cursada terminada existe.

### Pestañas sin estado persistente

El índice de la pestaña vive en el estado del modal y se reinicia al abrir otro alumno. Se muestran
todas las inscripciones, activas o no, con su estado visible; el mensaje informativo aparece solo
cuando no hay ninguna.

## Risks / Trade-offs

- **Foco después de una baja**: la fila que abrió la ficha desaparece → el `Modal` solo devuelve el
  foco si el elemento sigue conectado; si no, el foco queda en el cuerpo y se documenta como
  comportamiento aceptado.
- **Modal dentro de modal**: las confirmaciones se apilan; la pila de `Modal` ya resuelve `Escape` y
  el foco, y los tests deben cubrir que `Escape` cierra solo el de arriba.
- **Consultas por inscripción**: el detalle deriva montos y estado para cada una; el volumen es de
  pocas inscripciones por alumno y se cargan comisión, curso, empresa e imputaciones con
  `selectinload` para no caer en N+1.
- **Saldo atado al arancel actual**: editar la comisión cambia el saldo de todas sus inscripciones.
  Es la decisión tomada para la HU 64 y se documenta en la ficha y en `docs/decisions.md`.
- **Datos de ejemplo**: si los mocks no traen montos, la pestaña no puede mostrar el caso de deuda →
  se agregan imputaciones de ejemplo que cubran particular con saldo, beca parcial, beca total y
  corporativo.

## Migration Plan

Sin migración. El orden es backend (montos en el detalle y refactor de la derivación), servicios del
frontend, ficha y tabla, y verificación integrada. El rollback revierte el commit del cambio; el
padrón vuelve a la columna de acciones de la HU 64.
