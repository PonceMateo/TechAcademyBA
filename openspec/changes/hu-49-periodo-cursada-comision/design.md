# Design

## Context

Ver `proposal.md` para la motivación. Lo que condiciona el cómo:

- `comision` ya tiene `fecha_inicio` (nullable) desde la migración inicial y **nunca se escribió por
  la API**: no está en `ComisionCreate`, ni en `ComisionUpdate`, ni en `ComisionOut`. `fecha_fin`
  no existe, y D60 lo dejó escrito a propósito.
- El panel del alumno ya tiene el campo en el contrato: `CronogramaOut` con `inicio` y `fin`, y el
  servicio lo llena con `fin=None` fijo. La pantalla ya renderiza la fecha cuando viene.
- Los encuentros se derivan de `comision_horario` desde el día corriente hasta juntar
  `ENCUENTROS_VISIBLES`, sin tope de fin.
- `inscripcion` no guarda arancel ni importe: no existe prorrateo, así que no hay nada que
  recalcular al editar el período.
- Las reglas estáticas del proyecto viven en CHECK de la base y los mensajes de interfaz en
  es-AR los pone el contrato; el frontend solo muestra un `detail` de texto cuando la API rechaza.
- D56: toda migración es expand/contract, sin borrar ni renombrar en el mismo deploy que cambia el
  código que la usa.

## Goals / Non-Goals

**Goals:**

- Que el período exista en el modelo, se pueda cargar y editar por la API y sea obligatorio para
  toda escritura nueva.
- Que la cantidad de clases sea una sola cuenta, derivada y reutilizable por la H/U 50.
- Que el panel del alumno deje de mentir sobre el fin de su cursada y no muestre clases después del
  cierre.
- Que las comisiones heredadas sigan siendo legibles sin inventarles calendario.

**Non-Goals:**

- Prorratear el arancel, avisar en la inscripción que no se pudo prorratear y recalcular importes
  (H/U 50 y 51).
- Feriados y suspensiones: el conteo cuenta días de la semana, no un calendario académico.
- Persistir la cantidad de clases.
- Backfill de fechas para las comisiones existentes.

## Decisions

### D1 — Columna `fecha_fin` nula en `comision`, con CHECK de coherencia

`fecha_fin` nace nula y `fecha_inicio` se queda como está. El CHECK es
`fecha_fin IS NULL OR (fecha_inicio IS NOT NULL AND fecha_fin >= fecha_inicio)`: deja pasar el
legado con inicio solo y prohíbe un fin sin inicio o anterior al inicio.

**Por qué:** es expand puro (D56). Un `NOT NULL` con backfill obligaría a inventarle un calendario a
cada comisión existente, que es exactamente lo que D60 evitó, y rompería el deploy si alguna fila no
cumpliera.
**Alternativas descartadas:** tabla `comision_periodo` aparte (una relación 1:1 sin atributos propios
no se modela con tabla), y `NOT NULL` desde el día uno (backfill inventado).

### D2 — El período es obligatorio en el contrato y opcional en la base

`ComisionCreate` y `ComisionUpdate` exigen las dos fechas; la columna admite nulos. La obligación la
sostiene el contrato, no la base, para que el legado se pueda leer y no se pueda reescribir sin
fechas.

**Por qué:** el usuario pidió que toda comisión nueva y toda edición tengan período. Si la regla se
pusiera en un `NOT NULL`, el primer deploy tendría que decidir por las comisiones viejas.
**Trade-off:** una fila creada por fuera de la API podría quedar sin período. A la escala del
proyecto el único escritor es el backend, y el CHECK igual impide la combinación incoherente.

### D3 — Validación cruzada en el servicio, no en Pydantic

`PeriodoInvalido` y `_validar_periodo(inicio, fin, horarios)` viven en `services/catalogo.py` y la
ruta los traduce a `422` con `detail` de texto. Los dos mensajes son «La fecha de fin no puede ser
anterior a la de inicio.» y «El período no contiene ninguna clase: revisá las fechas o los días de
cursada.».

**Por qué:** un `422` de Pydantic viaja como arreglo y el cliente solo muestra `detail` cuando es
texto (`apiDataSource.js`). Si la regla viviera en el validador, el administrador leería «La API
respondió 422 a POST /comisiones». El servicio ya tiene ese patrón en `CupoInsuficiente` y es el
único lugar con los horarios ya armados.
**Alternativas descartadas:** validador de modelo en el schema (mensaje ilegible) y confiar solo en
el CHECK (llega como `IntegrityError` con el texto crudo de PostgreSQL).

### D4 — La cantidad de clases es derivada, con una función pura en el modelo

`clases_del_periodo(inicio, fin, horarios)` cuenta los días del rango con sus dos extremos incluidos
que caen en un día de cursada. La property `Comision.cantidad_clases` devuelve `None` sin período y
delega en la función; `ComisionOut` la expone junto con las fechas.

**Por qué:** es una cuenta, no un dato: una columna se desincroniza apenas se editan los horarios o
el período. Vive en el modelo —como `resumen_de_horarios`— para que la respuesta, la validación del
período y la H/U 50 usen exactamente la misma función.
**Alternativas descartadas:** columna persistida (se desincroniza), cálculo en el servicio y pasado
a mano a la respuesta (dos lugares que pueden divergir), cálculo en el frontend (duplicaría la
regla en JS).

### D5 — Los encuentros del alumno se cortan en la fecha de fin

`_dias_de_cursada` deja de juntar fechas al pasar `fecha_fin`; si el período ya terminó, devuelve
vacío.

**Por qué:** con el fin cargado, seguir mostrando clases futuras de una cursada terminada sería un
dato falso. Es la única forma de que el período signifique algo en el panel.
**Alternativa descartada:** informar la fecha y dejar la derivación intacta (el alcance literal del
criterio, pero deja la pantalla contradiciéndose).

### D6 — Fechas con `<input type="date">`, sin dependencia nueva

Los dos campos usan el `Input` del proyecto con `type="date"`, que ya se usa para la fecha de una
cobranza.

**Por qué:** `react-datepicker` está instalado para el selector de horarios, donde hace falta elegir
hora; para una fecha suelta el control nativo es más simple, no agrega peso y su valor ya es
`YYYY-MM-DD`, el mismo formato del contrato.
**Alternativa descartada:** reutilizar `react-datepicker` por consistencia visual.

## Risks / Trade-offs

- **El legado queda sin período y la primera edición lo exige** → el `422` dice qué falta, la
  pantalla de edición precarga lo que la comisión tenga y la spec deja el caso escrito. No se
  inventan fechas para las comisiones viejas.
- **El CHECK se valida contra las filas existentes al crearse** → la única columna nueva es nula en
  todas las filas, y el legado con `fecha_inicio` sola está permitido por la expresión.
- **El conteo itera día por día** → con períodos de un cuatrimestre son decenas de iteraciones y a la
  escala declarada del proyecto es despreciable. Si algún día importara, se cambia por aritmética de
  semanas sin tocar el contrato.
- **Feriados y suspensiones se ignoran** → queda como decisión pendiente declarada en el issue; la
  spec no promete un calendario académico.
- **El mock de la demo calcula el conteo por su cuenta** → puede divergir del backend. Se documenta
  en el mock que el número real es el de la API y el cálculo vive en un único helper.
- **Migración en CI** → el job aplica `alembic upgrade head` sobre Supabase después de las suites;
  acá solo hay `add_column` y `create_check_constraint`, sin pérdida de datos.

## Migration Plan

1. Migración `0006_comision_periodo`: `add_column` de `fecha_fin` nula y `create_check_constraint`.
2. En el mismo release, el código que exige y escribe las fechas. El orden dentro del deploy no
   importa: la columna es nula y el código nuevo tolera nulos al leer.
3. Revertir: primero el código que escribe `fecha_fin`, después `alembic downgrade -1`, que borra el
   CHECK y la columna. El `downgrade` no pierde ningún otro dato.

## Open Questions

- Cómo se prorratea exactamente el arancel y qué pasa con la inscripción de una comisión heredada sin
  período: lo resuelve la H/U 50 sobre `cantidad_clases` y sin cambiar este contrato.
- Si los feriados y las suspensiones entran al conteo: otra historia; hoy el conteo es por día de la
  semana.
