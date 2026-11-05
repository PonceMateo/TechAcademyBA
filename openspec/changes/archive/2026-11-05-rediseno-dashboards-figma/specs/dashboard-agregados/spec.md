# Spec Delta

## Purpose

Contrato de los agregados que alimentan los tres tableros: indicadores, serie mensual de cobros,
ocupación por comisión, comprobantes recientes y agenda de clases, calculados en el servidor, con
permisos por rol y sin datos inventados.

## ADDED Requirements

### Requirement: Agregado del tablero de Administración

`GET /admin/dashboard` SHALL exigir rol `ADMIN` y devolver en una sola respuesta los indicadores, la
serie de cobros acreditados, la ocupación por comisión, los comprobantes recientes y la agenda. Los
indicadores SHALL ser `alumnos_inscriptos`, `inscripciones_activas`, `cupo_promedio_ocupado`,
`comisiones`, `comisiones_vigentes`, `cobros_pendientes`, `comprobantes_pendientes`,
`cobranzas_observadas` y `cobrado_mes_actual`.

#### Scenario: El administrador consulta el agregado
- **WHEN** un usuario `ADMIN` llama a `GET /admin/dashboard`
- **THEN** recibe 200 con los nueve indicadores, `cobros_por_mes`, `ocupacion_por_comision`, `comprobantes_recientes` y `agenda`, todos calculados desde la base

#### Scenario: El agregado cuenta alumnos distintos
- **WHEN** un alumno tiene dos inscripciones activas
- **THEN** `alumnos_inscriptos` lo cuenta una sola vez y `inscripciones_activas` cuenta las dos

#### Scenario: No hay comisiones vigentes
- **WHEN** el catálogo no tiene ninguna comisión vigente
- **THEN** `cupo_promedio_ocupado` es `null`, `comisiones_vigentes` es `0` y `ocupacion_por_comision` es una lista vacía, sin un porcentaje inventado

#### Scenario: Los cobros pendientes suman dos fuentes
- **WHEN** hay dos comprobantes pendientes de revisión y una cobranza observada
- **THEN** `comprobantes_pendientes` es `2`, `cobranzas_observadas` es `1` y `cobros_pendientes` es `3`

#### Scenario: Rol distinto de administrador
- **WHEN** un docente o un alumno llama a `GET /admin/dashboard`
- **THEN** el sistema responde 403 y no devuelve ningún agregado

#### Scenario: Sin sesión
- **WHEN** se llama a `GET /admin/dashboard` sin token
- **THEN** el sistema responde 401

### Requirement: Serie mensual de cobros acreditados

El agregado SHALL devolver `cobros_por_mes` con los últimos seis meses calendario, incluido el
corriente, ordenados, con `mes` en `YYYY-MM` e `importe`. El importe SHALL sumar solo cobranzas
`ACREDITADO` con `fecha` en ese mes; los meses sin cobros SHALL ser `0`. `cobrado_mes_actual` SHALL
ser la suma acreditada del mes corriente y las cobranzas `OBSERVADO` y `RECHAZADO` SHALL NOT sumarse.

#### Scenario: Seis meses sin huecos
- **WHEN** el administrador consulta el agregado en noviembre de 2026
- **THEN** `cobros_por_mes` trae los meses `2026-06` a `2026-11`, en ese orden, incluidos los meses sin cobros con importe `0`

#### Scenario: Solo lo acreditado suma
- **WHEN** un mes tiene una cobranza acreditada de $ 50.000, una observada de $ 30.000 y una rechazada de $ 20.000
- **THEN** el importe de ese mes es $ 50.000 y `cobrado_mes_actual` refleja solo lo acreditado del mes corriente

#### Scenario: Mes corriente sin cobros
- **WHEN** el mes corriente no tiene ninguna cobranza acreditada
- **THEN** `cobrado_mes_actual` es `0` y el mes aparece en la serie con importe `0`

### Requirement: Ocupación y comprobantes recientes del agregado administrativo

`ocupacion_por_comision` SHALL devolver hasta tres comisiones vigentes ordenadas por porcentaje
descendente, con `codigo`, `nombre_curso`, `inscriptos`, `cupo` y `porcentaje`; el porcentaje SHALL
ser inscriptos activos sobre cupo por cien, con un decimal y tope de 100. `comprobantes_recientes`
SHALL devolver hasta cinco comprobantes de cualquier estado por `enviado_at` descendente, con la
forma de `GET /comprobantes`.

#### Scenario: Tres comisiones con mayor ocupación
- **WHEN** hay cinco comisiones vigentes con ocupaciones distintas
- **THEN** `ocupacion_por_comision` trae las tres de mayor porcentaje, de mayor a menor, con sus inscriptos y su cupo

#### Scenario: Comisión con sobrecupo
- **WHEN** una comisión tiene más inscriptos activos que cupo máximo
- **THEN** su `porcentaje` informa `100.0` y el sistema no oculta la diferencia entre inscriptos y cupo

#### Scenario: Comprobantes recientes de cualquier estado
- **WHEN** hay comprobantes pendientes, aceptados y observados
- **THEN** `comprobantes_recientes` trae los cinco con `enviado_at` más reciente, sin filtrar por estado y ordenados del más nuevo al más viejo

#### Scenario: No hay comprobantes
- **WHEN** no existe ningún comprobante enviado
- **THEN** `comprobantes_recientes` es una lista vacía

### Requirement: Agenda compartida derivada del horario y el período

El sistema SHALL derivar cada encuentro de las filas de `comision_horario` y del período
`fecha_inicio`/`fecha_fin`. La agenda SHALL empezar hoy, SHALL NOT mostrar fechas anteriores y SHALL
terminar en `fecha_fin`. Una comisión sin horarios, finalizada o sin fechas futuras SHALL producir
una agenda vacía. Cada encuentro SHALL informar `fecha`, `horario` `HH:MM-HH:MM` y el `tema` cuando
exista.

#### Scenario: Dos días de cursada en la misma semana
- **WHEN** una comisión se dicta martes y jueves y su período incluye la semana corriente
- **THEN** la agenda informa los dos encuentros, cada uno con el rango horario de su día, en orden cronológico

#### Scenario: Comisión finalizada
- **WHEN** la `fecha_fin` de la comisión es anterior a hoy
- **THEN** la agenda no informa encuentros de esa comisión

#### Scenario: Comisión sin horarios
- **WHEN** una comisión no tiene filas en `comision_horario`
- **THEN** la agenda no informa encuentros para esa comisión

#### Scenario: Límite de la agenda
- **WHEN** hay más de ocho encuentros en los próximos siete días
- **THEN** la agenda devuelve los ocho más cercanos y no recorta el orden cronológico

#### Scenario: La agenda no inventa feriados ni suspensiones
- **WHEN** un día de cursada coincide con un feriado
- **THEN** el encuentro sigue apareciendo, porque el modelo no registra feriados ni suspensiones

### Requirement: Próximas clases en las comisiones del docente

`GET /docentes/mis-comisiones` SHALL incluir en cada comisión asignada `proximos_encuentros`, con
hasta cuatro encuentros reales derivados de la agenda compartida. La consulta SHALL seguir devolviendo
solo las comisiones del docente autenticado y SHALL NOT revelar comisiones de otro docente.

#### Scenario: Comisión con clases próximas
- **WHEN** el docente consulta sus comisiones y una de ellas tiene horarios y período vigente
- **THEN** esa comisión trae sus próximos encuentros con fecha y horario, ordenados del más cercano al más lejano

#### Scenario: Comisión sin clases próximas
- **WHEN** la comisión está finalizada o no tiene horarios
- **THEN** `proximos_encuentros` es una lista vacía y la comisión sigue apareciendo con su estado

#### Scenario: Comisiones de otro docente
- **WHEN** el docente consulta sus comisiones
- **THEN** la respuesta no incluye ninguna comisión que no tenga asignada
