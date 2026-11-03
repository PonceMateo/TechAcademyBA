# Design

## Context

Ver `proposal.md` para la motivación. El código actual tiene dos puntos de verdad para el dinero: la
inscripción guarda `importe_arancel` y `services/habilitacion.py` lo usa como monto requerido cuando
no es nulo; el descuento de beca solo se calcula cuando ese campo está vacío. El prorrateo, agregado
en la H/U 50, escribe el importe ya descontado, así que un cambio posterior de categoría no puede
recuperar el descuento. El estado de la comisión no existe en el modelo: `Comision` solo tiene
`activo`, y la UI del docente inventa `Activa`/`Inactiva`, mientras el mock usa `Cerrada por cupo`.
El chequeo de solapamiento del docente compara día y hora pero no el período, aunque los specs de
altas y edición ya hablan de comisiones vigentes sin aclarar las fechas.

## Goals / Non-Goals

**Goals:**

- Una sola regla de dinero: el importe base prorrateado se guarda una vez y el descuento de beca se
  deriva siempre, de modo que el `PATCH` de categoría funcione sin recalcular nada.
- Un único cálculo de estado de comisión, usado por Administración, el docente y los rechazos de
  inscripción y nómina.
- Solapamiento del docente por día, horario y período, con borde compartido permitido.
- Paridad del modo mock con la API para que las pruebas de pantalla no validen una regla distinta.

**Non-Goals:**

- No se agrega columna de estado, job programado ni migración de datos de comisiones.
- No se recalcula el prorrateo de inscripciones existentes ni se toca su importe histórico.
- No se modifican el flujo de cobranzas, la habilitación por deuda, la facturación ni la lógica de
  cupo.
- No se agrega un estado `Cerrada por cupo`: el cupo sigue siendo un derivado de `cupo_maximo`.

## Decisions

### 1. `importe_arancel` guarda la base prorrateada, sin descuento de beca

`calcular_importe_arancel` deja de aplicar el porcentaje de beca y `derivar_montos` lo aplica
siempre sobre el importe base guardado (o sobre el arancel actual cuando el campo es nulo por ser
legado). La beca parcial multiplica por `(100 - porcentaje) / 100`; la beca total sigue en cero y el
corporativo en nulo.

- **Por qué:** el monto requerido pasa a ser una función pura de `(importe base, categoría,
  porcentaje)`. Cambiar la categoría, o el porcentaje, ya no deja un importe viejo, y no hace falta
  reconstruir el base ni re-prorratear.
- **Alternativas descartadas:** recalcular `importe_arancel` en el `PATCH` recuperando el base desde
  el importe anterior (arrastra centavos y agrega una regla de reconstrucción); guardar la fecha de
  alta y re-prorratear en cada cambio (columna nueva y el monto cambiaría según el momento de la
  edición, que no es lo que se quiere).
- **Contrato:** el campo expuesto `importe_arancel` cambia de significado. Ningún cliente lo
  consume; las pantallas usan `monto_requerido` y `saldo_pendiente`. Se documenta en
  `docs/decisions.md`.

### 2. Backfill de las inscripciones becadas ya guardadas

La migración des-aplica el descuento a las filas con `categoria = 'BECADO_PARCIAL'` e
`importe_arancel` no nulo: `importe_arancel * 100 / (100 - porcentaje_beca)`, redondeado a centavos.
Las filas con `importe_arancel` nulo no se tocan.

- **Por qué:** son las únicas filas cuyo valor guardado incluye el descuento. Sin backfill, después
  del cambio se descontaría dos veces.
- **Techo asumido:** el redondeo del alta puede dejar una diferencia de hasta un centavo en el base
  reconstruido. No hay forma de recuperar el base exacto sin la fecha de alta, y el desvío es menor
  que el que produce dejar el importe viejo. Se acepta y se documenta.

### 3. Estado de comisión derivado, en un helper del dominio

Un único helper (junto a `cantidad_clases`, en `models/catalogo.py`) devuelve `Vigente` o
`Finalizada` comparando `fecha_fin` con el día corriente en `America/Argentina/Buenos_Aires`, con un
parámetro opcional de fecha para las pruebas. `ComisionOut` lo expone como `estado`; el perfil del
docente lo usa en lugar de `Activa`/`Inactiva`; inscripciones y nómina lo consultan antes de crear.

- **Por qué:** el estado es una función de `fecha_fin`; una columna o un cron se desincronizan.
- **Alternativa descartada:** columna `estado` con job nocturno (requiere migración y una ventana en
  la que el dato es falso).
- La constante de zona horaria se mueve al módulo del modelo (o a un módulo de dominio compartido) y
  el prorrateo la importa desde ahí, para no duplicarla.

### 4. Solapamiento del docente por día, horario y período

`_horario_en_conflicto` recibe las fechas del alta o de la edición y descarta las comisiones cuyos
períodos no se cruzan. El cruce usa extremos **estrictos** (`inicio_a < fin_b` y `inicio_b <
fin_a`): una comisión que termina el lunes y otra que empieza ese mismo lunes no se consideran
cruzadas, tal como pide la H/U 70. Una comisión heredada sin fechas participa del chequeo por día y
horario, porque no hay datos para descartar el cruce.

- **Por qué:** el comportamiento actual rechaza altas válidas y contradice el criterio de la
  historia; el borde compartido se resuelve con la comparación estricta.
- **Riesgo aceptado:** el día del borde pueden coexistir dos clases del mismo docente en la misma
  franja. Es lo que la historia pide explícitamente; si el negocio lo revierte, alcanza con cambiar
  la comparación a inclusiva.

### 5. Reactivación sin código nuevo

Editar `fecha_fin` a hoy o al futuro vuelve a derivar `Vigente`. El chequeo de solapamiento corre en
toda edición con el período nuevo, así que un cruce responde `409` y la edición no se guarda. No hay
endpoint ni acción de reactivación.

- **Alternativa descartada:** endpoint o acción explícita de reactivar (más contrato, misma regla).

### 6. Rechazo de inscripción y nómina con 422

Ambos servicios consultan el estado derivado antes de crear filas y levantan una excepción propia que
la ruta traduce a `422` con un mensaje en es-AR (`La comisión ya finalizó.`). El chequeo va antes del
de cupo para que el motivo informado sea el correcto cuando la comisión está terminada y llena.

- **Por qué:** el criterio pide `422`, no `409`, y el mensaje tiene que explicar el motivo.

### 7. UI: chip de estado, vacantes no disponibles y selector filtrado

La tabla de Administración suma la columna `ESTADO` después de `PERÍODO`: chip verde `Vigente`, chip
gris `Finalizada`. `VACANTES` muestra `—` en las finalizadas, sin chip `LLENO`. El selector de
comisión del modal de inscripción (`InscripcionModal`) filtra las `Vigentes` con el mismo `estado`
que devuelve la fuente y, cuando el modal se abre desde la vista de un curso, recibe solo las
comisiones de ese curso: `CoursesPage` ya calcula `comisionesDelCurso` para la tabla, así que le pasa
esa lista en lugar del catálogo completo. Desde la vista de cursos recibe el catálogo. La vista del
docente reemplaza `Activa`/`Inactiva` por `Vigente`/`Finalizada` y el mock deja de usar `Cerrada por
cupo`.

- **Por qué:** el estado tiene que leerse igual en las dos pantallas y no puede haber una regla
  duplicada en el cliente.
- El contador `COMISIONES` del Dashboard no cambia: ya cuenta lo que devuelve el catálogo completo.

## Risks / Trade-offs

- **El backfill desvía centavos** → el error máximo es 1 centavo y se documenta; alternativa peor
  era duplicar el descuento.
- **Cambia el significado de un campo expuesto** (`importe_arancel`) → ningún cliente lo usa; se
  anota en `docs/decisions.md` y en los tests de contrato que correspondan.
- **El borde compartido permite dos comisiones el mismo día** → es el criterio de la H/U 70; se
  cubre con un test explícito para que un cambio futuro sea deliberado.
- **Estado derivado y medianoche** → la inscripción puede entrar si corre justo antes de las 00:00 y
  rechazarse después; es consistente con "se calcula por consulta" y no hay dato que corregir.
- **Comisiones legadas sin período** → siguen bloqueando por día y horario; conservador para no
  permitir un solapamiento real que no se puede verificar.

## Migration Plan

1. Registrar las decisiones en `docs/decisions.md` (estado derivado, reactivación por edición,
   semántica de `importe_arancel`).
2. Publicar la migración expand: crea la revisión de backfill que solo actualiza `importe_arancel` de
   las filas becadas. No borra ni renombra columnas, así que es compatible con el código anterior.
3. Desplegar el código nuevo después de que la migración corra en el pipeline. Rollback: el código
   anterior vuelve a leer `importe_arancel` como importe final; las filas becadas quedarían sin
   descuento, el mismo síntoma que se está corrigiendo. Si hiciera falta, se re-aplica el descuento
   con la misma fórmula inversa.
4. No hay migración de comisiones ni de inscripciones no becadas.
