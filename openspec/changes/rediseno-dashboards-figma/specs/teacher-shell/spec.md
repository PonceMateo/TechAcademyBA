# Spec Delta

## MODIFIED Requirements

### Requirement: Listado de comisiones asignadas

The system SHALL mostrar, como encabezado del tablero, el saludo `Buen día, {nombre de la cuenta}`
seguido de una línea de fecha con la fecha real del día que la fuente informa, formateada para español
rioplatense con el día de la semana capitalizado (por ejemplo `Viernes 9 de octubre`), y la frase de
apoyo `Tu agenda y tus comisiones en un solo lugar.`. La fecha SHALL ser un valor calculado a partir
del día corriente, no un literal del maquetado. El texto SHALL NOT anunciar una cantidad de clases ni
de entregas.

The system SHALL mostrar cuatro tarjetas de indicador, cada una con su ícono, su rótulo, su valor y
una línea de contexto: `COMISIONES ACTIVAS` con la cantidad de comisiones asignadas y el contexto de
cuántas están vigentes; `ALUMNOS HABILITADOS` con la suma de habilitados de sus comisiones; `BLOQUEADOS`
con la suma de bloqueados; y `PRÓXIMA CLASE` con la próxima fecha y hora que informan sus comisiones.
Los valores SHALL derivarse de las comisiones asignadas, con un `0` real cuando el conteo es cero y
`—` cuando la fuente no puede responder, por ejemplo cuando no hay ninguna próxima clase. Las tarjetas
SHALL NOT mostrar valores literales fijos.

The system SHALL mostrar el bloque `Comisiones asignadas` con una tarjeta por comisión asignada, con
su código, su curso, su horario, su estado `Vigente` o `Finalizada`, su próxima clase y los conteos de
habilitados y bloqueados de su padrón como chips verde y rojo. La tarjeta SHALL ser accionable y SHALL
navegar al padrón de esa comisión en `/docente/alumnos/{codigo}`. Una comisión `Finalizada` SHALL
seguir apareciendo con su estado, sin eliminarse por haber terminado. El sistema SHALL NOT inventar
comisiones para completar el bloque.

El tablero SHALL conservar siempre su forma: las cuatro tarjetas, el bloque `Comisiones asignadas`, el
bloque `Tu agenda` y el bloque `Requiere tu atención` SHALL renderizarse aunque su dato no exista
todavía, y el tablero SHALL NOT eliminar una tarjeta ni un bloque porque la fuente no pueda responder.
Donde la fuente no puede responder, el valor SHALL ser `—`; donde la fuente responde, SHALL mostrarse
el valor real, incluido un `0` real. El valor `—` SHALL significar "todavía no lo sé" y SHALL NOT
significar "cero". Mientras la lectura de las comisiones asignadas no haya resuelto, cada valor que
dependa de ella SHALL ser `—`, nunca un `0` ni un literal.

El tablero SHALL organizarse en dos columnas: a la izquierda, los indicadores y el bloque `Comisiones
asignadas` con sus tarjetas; a la derecha, el bloque `Tu agenda` con la semana corriente y las
próximas clases de todas sus comisiones —hasta ocho encuentros dentro de los próximos siete días,
ordenados por fecha y hora, cada uno con el rango horario, el curso y el código de comisión— y el
bloque `Requiere tu atención` con las alertas reales: alumnos bloqueados y comisiones finalizadas.
Cada alerta SHALL mostrar su cantidad y SHALL navegar a la pantalla donde se consulta. WHEN no haya
alertas, el bloque SHALL mostrar un mensaje informativo. El bloque `Tu agenda` SHALL ofrecer
`Ver comisiones`, que navega a `/docente`.

El tablero SHALL NOT mostrar bloques de entregas por corregir, asistencia promedio, correcciones,
novedades ni mensajes: el maquetado no registra esas entidades y sus valores del prototipo (`18`
entregas, `92 %` de asistencia, `4` comisiones) no son datos del sistema. El encabezado de los
conteos de acceso SHALL seguir llamándose `ACCESO` y no `RESTRICCIONES`, porque las tarjetas muestran
conteos de acceso y no restricciones.

#### Scenario: El docente abre sus comisiones
- **WHEN** el docente abre `Mis Comisiones`
- **THEN** ve el saludo con su nombre y la fecha real, las cuatro tarjetas con sus valores derivados, el bloque `Comisiones asignadas` con una tarjeta por comisión, `Tu agenda` y `Requiere tu atención`

#### Scenario: El docente espera mientras cargan sus comisiones
- **WHEN** el docente abre `Mis Comisiones` y la consulta todavía no resolvió
- **THEN** el tablero ya se pinta con su forma completa y cada valor que depende de la lectura muestra `—`, nunca un `0` ni un literal

#### Scenario: El docente no tiene comisiones asignadas
- **WHEN** el docente no tiene ninguna comisión asignada
- **THEN** las cuatro tarjetas muestran un `0` real o `—` según lo que la fuente respalde, `Comisiones asignadas` cae a su mensaje de vacío y `Tu agenda` a su propio mensaje de vacío, sin eliminar ninguna tarjeta ni bloque

#### Scenario: El docente compara los contadores de acceso
- **WHEN** el docente recorre una tarjeta de comisión
- **THEN** los habilitados aparecen en chip verde y los bloqueados en chip rojo, con singular o plural según la cantidad, por ejemplo `1 bloqueado` frente a `4 bloqueados`

#### Scenario: El docente cruza los indicadores con su única comisión
- **WHEN** el docente compara `COMISIONES ACTIVAS`, `ALUMNOS HABILITADOS` y `BLOQUEADOS` con las tarjetas de `Comisiones asignadas`
- **THEN** los conteos coinciden con las comisiones asignadas y sus padrones, porque los indicadores se derivan de esas comisiones y no de valores fijos

#### Scenario: El docente abre el padrón desde su tablero
- **WHEN** el docente pulsa una tarjeta de `Comisiones asignadas`
- **THEN** navega al padrón de esa comisión en `/docente/alumnos/{codigo}`

#### Scenario: El docente ve una comisión finalizada
- **WHEN** el docente tiene asignada una comisión cuya `fecha_fin` es anterior a hoy en `America/Argentina/Buenos_Aires`
- **THEN** la comisión sigue apareciendo con el estado `Finalizada` y su agenda no informa encuentros nuevos

#### Scenario: El docente revisa su agenda
- **WHEN** el docente mira `Tu agenda`
- **THEN** ve las próximas clases de todas sus comisiones, agrupadas por fecha, ordenadas por hora, con el rango horario, el curso y el código de comisión

#### Scenario: El docente no tiene clases próximas
- **WHEN** no hay ninguna clase en los próximos siete días
- **THEN** `Tu agenda` muestra su mensaje de vacío y no desaparece

#### Scenario: El docente lee las alertas
- **WHEN** el docente tiene alumnos bloqueados o comisiones finalizadas
- **THEN** `Requiere tu atención` muestra cada alerta con su cantidad y su enlace

#### Scenario: El docente no tiene alertas
- **WHEN** el docente no tiene alumnos bloqueados ni comisiones finalizadas
- **THEN** `Requiere tu atención` muestra un mensaje informativo y no un bloque vacío

#### Scenario: El docente busca entregas o mensajes
- **WHEN** el docente recorre el tablero buscando `Entregas por corregir`, `Correcciones pendientes` o `Asistencia promedio`
- **THEN** no los encuentra, porque el maquetado no registra entregas ni promedios de asistencia

#### Scenario: El docente busca la columna de restricciones
- **WHEN** el docente lee los conteos de acceso de una tarjeta de comisión
- **THEN** el encabezado dice `ACCESO` y no `RESTRICCIONES`
