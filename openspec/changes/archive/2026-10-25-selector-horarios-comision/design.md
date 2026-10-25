# Design

## Context

`comision.dias_horarios` es un `String(255)` NOT NULL con un CHECK `no_vacio` (migración
`0001`), y es lo único que hoy representa el horario: `ComisionCreate` y `ComisionUpdate` lo
reciben como texto libre y `ComisionOut` lo devuelve igual. El modal de alta y el de edición de
`CoursesPage.jsx` usan un `<Input>` con el placeholder `Ej: Mar y Jue 19 a 21 hs`, y la columna
`HORARIO` de la tabla pinta ese texto tal cual. `components/ui/Modal.jsx` cierra con `Escape`
pero no atrapa el foco ni tiene pila de modales, así que un modal sobre otro no se puede manejar.
La paleta del rol de Administración sale de `data-acento='secretaria'` en `index.css` (azul
`#3975d5`). Los mocks son solo infraestructura de test: en ejecución la fuente es siempre la API.

En Supabase (producción) no hay ninguna comisión creada, así que la conversión de textos no
tiene filas reales que convertir. El Excel del cliente queda fuera del alcance: sus datos no
están normalizados.

## Goals / Non-Goals

**Goals:**

- Que el horario de cursada sea un dato estructurado, comparable y consultable por día.
- Que la API sea la autoridad del rechazo: `422` por rango o minutos inválidos y `409` por
  choque de horario del mismo docente.
- Que el formulario de comisión cargue horarios con un selector accesible y sin depender de
  texto libre.
- Que la migración sea reversible y no pierda el texto que ya existe.

**Non-Goals:**

- Choques de aula/sala, y cualquier validación de recurso físico.
- Importar o normalizar datos del Excel del cliente.
- Migrar las pantallas de docente y de alumno, que leen otro campo de endpoints todavía no
  conectados.
- Filtrar la tabla de Administración por horario estructurado: el buscador sigue comparando
  contra el texto.
- Pre-validar el choque de horario en el navegador: la API manda y el `409` llega al guardar.

## Decisions

### D1 — Tabla nueva `comision_horario` y `dias_horarios` conservado como texto derivado

Una fila por día: `comision_id` (FK a `comision`, `ondelete=CASCADE`), `dia` (`LUN`..`DOM`),
`inicio` y `fin` (`TIME`), con `UNIQUE(comision_id, dia)` y un CHECK de `fin > inicio`. Las
reglas estáticas —minutos múltiplos de 15 y horas dentro de 6:00–22:00— también se sostienen
como CHECK, siguiendo el patrón de `cupo_maximo` y `arancel`: el validador de Pydantic pone el
mensaje en es-AR y la base es la red de seguridad.

`comision.dias_horarios` **no se dropea**: se mantiene como el texto que leen los listados, y
desde este change lo escribe el backend a partir de las filas. Con eso la reversión del downgrade
no pierde nada y las comisiones que la migración no pudo interpretar siguen listándose.

*Alternativa descartada:* guardar los horarios como JSON en la misma columna. Complicaba el
chequeo por día, obligaba a parsear en cada lectura y no dejaba consultar por día con un índice
simple.

### D2 — El texto lo deriva el backend, con el mismo formato que los chips del front

Fuente única: las filas. El servicio regenera el texto cada vez que guarda horarios, con el
formato del resumen del formulario (`Lun y Mié 19-21hs`, `Mar 18:15-21:30hs`): días en orden de
semana, grupos de días con igual rango, hora sin minutos cuando valen cero y con minutos cuando
no. Si el front mandara también el texto, serían dos fuentes de verdad que se desincronizan.

### D3 — Contrato: `horarios` estructurado en la entrada, `horarios` + `dias_horarios` en la salida

`ComisionCreate` y `ComisionUpdate` reemplazan `dias_horarios: str` por
`horarios: list[HorarioComision]` (`dia` enum `LUN`..`DOM`, `inicio`/`fin` como `"HH:MM"`) y
conservan `extra="forbid"`, de modo que mandar el texto viejo responde `422`. `ComisionOut`
suma `horarios` y mantiene `dias_horarios`, ya derivado. Los strings `"LUN"` y `"HH:MM"` son
legibles en el cuerpo del `422` y en los logs; enteros minutos desde medianoche serían más
compactos pero ilegibles en un mensaje de rechazo.

### D4 — Migración reversible con parser defensivo

`0005_comision_horario.py` crea la tabla y convierte los `dias_horarios` existentes en filas.
El parser vive dentro de la migración y es deliberadamente acotado: acepta días completos y
abreviados, con o sin acento, separados por `y` o por coma, y un rango con `a`, `-` o espacio
(`18:00 a 20:00`, `19 a 21`, `18:30-21:00`), con `hs` opcional. Un texto sin rango explícito —
«Sábados intensivo»— o con dos rangos para el mismo día **no se convierte**: la comisión queda
sin filas y con su texto original.

Antes de insertar, cada fila candidata pasa por la misma guarda que sostiene la tabla —minutos en la
grilla de 15, horas entre 6:00 y 22:00, `fin > inicio` y un solo horario por día—, y lo que no la
pase **tampoco se convierte**. Un solo texto raro del historial —`Lunes 19:10 a 21:00` o un día
repetido— dejaría el `upgrade head` a mitad de camino en todos los entornos, y ese es el único punto
del change donde un dato de entrada puede tumbar un deploy. El `downgrade` solo dropea la tabla, así
que `dias_horarios` nunca se pierde.

*Alternativa descartada:* no incluir el parser porque en producción no hay filas. Se descarta
porque el enunciado del trabajo pide la conversión como parte de la migración, y un parser con
tests cubre el caso real de un entorno local que sí tenga comisiones.

### D5 — El choque de horario se chequea en el servicio, con intervalos estrictos

Antes de persistir, `crear_comision` y `editar_comision` consultan las comisiones del mismo
`docente_id` con `activo = true`, del mismo día, y comparan `a.inicio < b.fin AND b.inicio <
a.fin`. La comparación estricta permite que un rango termine a las 18:30 y el otro empiece a las
18:30. En la edición se excluye la propia comisión. El choque levanta una excepción de servicio
que la ruta traduce a `409` con un `detail` en es-AR que nombra la comisión en conflicto, su día
y su rango: es el texto que el formulario reproduce bajo el campo `Días y Horarios`.

Solo se chequea contra comisiones vigentes (`activo = true`): no hay columna `estado` ni fecha de
fin en el modelo, y la baja lógica va por `activo`. Una comisión sin docente no se chequea, aunque
en la práctica el alta y la edición siempre llevan docente.

A la escala declarada del proyecto (10 comisiones) la consulta no necesita índice. Si creciera,
el corte fino es un índice GiST sobre un rango calculado; la carrera entre dos altas simultáneas
del mismo docente, que este chequeo de aplicación no puede ver, se cerraría con un lock por
docente.

### D6 — `react-datepicker` en modo solo hora, como única dependencia nueva

Se usa `react-datepicker` (versión con soporte de React 19, que el proyecto ya usa en `^19.3`)
en modo `showTimeSelect` + `showTimeSelectOnly`, `timeIntervals={15}`, `timeFormat="HH:mm"`,
`minTime`/`maxTime` para acotar el rango. Trae `date-fns` como dependencia propia, así que no se
declara aparte, y hay que importar su CSS.

*Alternativas descartadas:* un `<select>` nativo con 65 opciones, que no deja tipear y obliga a
recorrer la lista para llegar a las 21:00; y una librería de UI completa, que agregaría un
segundo sistema de componentes junto a `src/components/ui/`.

Dos detalles de integración: el popover del picker se dibuja adentro del modal, pegado al campo,
para que se lea como un desplegable y no como una ventana aparte —solo en pantallas chicas (menos
de 768 px), donde el modal ocupa casi toda la pantalla, se renderiza con portal hacia
`document.body` y con un `z-index` por encima del modal—; y hay
verificar que las 22:00 se puedan elegir, porque `maxTime` es inclusivo pero el borde del paso
final es fácil de perder.

El valor interno del formulario vive como string `"HH:MM"` y la conversión a `Date` ocurre solo
en el borde del componente. El tipeo se normaliza al confirmar (blur o Enter): minutos al múltiplo
de 15 más cercano acotado a 6:00–22:00 (`13:42` → `13:45`, `21:19` → `21:15`) y, si el texto no
se interpreta, se restaura el valor anterior. Esa normalización vive en una función pura, para
que el redondeo se pruebe sin renderizar el picker.

### D7 — Estado del formulario

`campos.horarios` es una lista de `{ dia, inicio, fin }` con strings `"HH:MM"`. El modal de
horarios trabaja sobre una copia y solo la devuelve al formulario con `Listo`; `Cancelar` o el
cierre descartan esa copia. La validación de guardado vive en el formulario: lista vacía →
`Agregá al menos un horario` bajo el campo, sin llamar a la API.

### D8 — `Modal.jsx` gana foco atrapado y pila de modales

El selector se abre sobre el modal de comisión, así que `Modal` pasa a mantener una pila: el
`Escape` cierra solo el tope y el foco queda atrapado dentro del modal activo, devolviéndose al
control que lo abrió al cerrar. Es un cambio de componente compartido, y mejora todos los modales
existentes sin alterar su contrato.

### D9 — Una sola función para el resumen y el renderer compacto

`frontend/src/domain/horarios.js` exporta la función pura que agrupa los horarios por igual rango
y devuelve los grupos con sus días en orden de semana. De ahí salen el chip del formulario y el
texto de la tabla. El renderer compacto usa regla determinista para el badge `+N`: se pinta el
primer chip y el badge cuando hay más de un grupo, en lugar de medir anchos, que en `jsdom` no
se puede y en el navegador vuelve frágil cualquier test.

### D10 — Verificación

Pytest contra PostgreSQL real, nunca SQLite: la migración con sus CHECK, el parser de
conversión, las validaciones de `422` y los casos de `409` —borde exacto 18:30/18:30, docente
distinto, comisión baja, edición sin falso conflicto—. Vitest con `jsdom` para el selector, el
modal superpuesto y el formulario de comisión; el modo mock se adapta al payload estructurado
porque es la infraestructura de test.

## Risks / Trade-offs

- [El texto derivado cambia de forma respecto de lo que escribían los operadores] → el buscador
  sigue comparando contra el texto; `19` o `mié` siguen coincidiendo, y el formato nuevo queda
  especificado en los specs.
- [Las comisiones sin filas estructuradas no participan del chequeo de horarios] → son solo las
  que la migración no pudo interpretar; en producción no hay ninguna, y al editarlas el
  operador carga sus horarios con el selector.
- [Dos implementaciones del formato del resumen, en el front y en el back] → ambas se especifican
  en el mismo requirement y se cubren con tests de cada lado; si divergen, el chip y el texto de
  la tabla dejarían de coincidir.
- [`react-datepicker` renderizado dentro de un modal en `jsdom`] → los tests del selector prueban
  la lógica de modo, redondeo y agrupación con funciones puras y mockean el picker; el
  comportamiento visual se revisa en el navegador.
- [La regla `fin > inicio` vive en el CHECK y en el validador] → es el mismo patrón de
  `cupo_maximo` y `arancel`; el texto amigable lo pone el validador y la base no deja pasar nada.
- [Dos altas simultáneas del mismo docente pueden cruzarse] → a la escala declarada es aceptable;
  el arreglo, si hiciera falta, es un lock por docente y no toca el contrato.

## Migration Plan

1. `backend/alembic/versions/0005_comision_horario.py`: crea `comision_horario` con sus
   restricciones y convierte los textos existentes. `downgrade` dropea la tabla.
2. El deploy de Vercel **no corre** `alembic upgrade head`: antes de publicar el front que
   depende de la tabla hay que aplicar la migración a mano en Supabase.
3. Rollback: `alembic downgrade -1` elimina las filas y deja `dias_horarios` intacto; el
   backend viejo vuelve a funcionar porque la columna de texto nunca se tocó.

## Open Questions

Ninguna que cambie los specs ni el desglose de tareas. El chequeo de choques de aula/sala y el
solapamiento contra el calendario de clases quedan para el change que implemente esas historias.
