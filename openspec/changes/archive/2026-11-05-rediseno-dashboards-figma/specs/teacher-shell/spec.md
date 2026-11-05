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
una línea de contexto: `COMISIONES ACTIVAS` con la cantidad de comisiones activas y el contexto `en
el período lectivo`; `ALUMNOS HABILITADOS` con la suma de habilitados de sus comisiones activas y el
contexto `con acceso a la clase`; `BLOQUEADOS` con la suma de bloqueados y el contexto `requieren
revisión`; y `PRÓXIMA CLASE` con la próxima fecha que informan sus comisiones y el curso al que
pertenece. Los valores SHALL derivarse de las comisiones activas, con un `0` real cuando el conteo es
cero y `—` cuando la fuente no puede responder, por ejemplo cuando no hay ninguna próxima clase. Las
tarjetas SHALL NOT mostrar valores literales fijos.

The system SHALL mostrar el bloque `Tus comisiones, a un vistazo` con una tarjeta por comisión
activa, con su código, su curso, su horario, su estado `Vigente`, su próxima clase, los conteos de
habilitados y bloqueados de su padrón como texto —no como chips— y una barra `Acceso habilitado` con
el porcentaje de habilitados sobre el total del padrón. Cada tarjeta SHALL ser un único enlace que
abre el padrón de esa comisión en `/docente/alumnos/{codigo}`; la acción `Ver comisión` es parte visual
de la tarjeta y no contiene un enlace anidado. Las tarjetas SHALL alternar fondo blanco y `#EBF7F2`,
con borde `#E3F2E9` en reposo y en hover, y fondo `#E7F2ED` al pasar el puntero. El carrusel SHALL
mostrar dos tarjetas por fila en pantallas anchas, una en pantallas angostas, y SHALL NOT mostrar
scrollbar visible.

Solo las comisiones activas SHALL listarse, ordenadas por la fecha y hora de su próxima clase, con
las que no tienen próxima clase al final y desempate por código. Una comisión `Finalizada` SHALL NOT
aparecer en el bloque ni en los indicadores, y SHALL NOT generar un aviso en la campana. El sistema
SHALL NOT inventar comisiones para completar el bloque.

El tablero SHALL conservar siempre su forma: las cuatro tarjetas, el bloque `Tus comisiones, a un
vistazo` y el bloque `Tu agenda` SHALL renderizarse aunque su dato no exista todavía, y el tablero
SHALL NOT eliminar una tarjeta ni un bloque porque la fuente no pueda responder. Donde la fuente no
puede responder, el valor SHALL ser `—`; donde la fuente responde, SHALL mostrarse el valor real,
incluido un `0` real. El valor `—` SHALL significar "todavía no lo sé" y SHALL NOT significar
"cero". Mientras la lectura de las comisiones asignadas no haya resuelto, cada valor que dependa de
ella SHALL ser `—`, nunca un `0` ni un literal.

El tablero SHALL organizarse en dos columnas: a la izquierda, los indicadores y el bloque `Tus
comisiones, a un vistazo` con sus tarjetas; a la derecha, el bloque `Tu agenda` con la semana corriente
y las próximas clases de todas sus comisiones activas —hasta cinco encuentros dentro de los próximos
siete días, ordenados por fecha y hora, cada uno con el rango horario, el curso y el código de
comisión—. WHEN haya más de cinco encuentros, la agenda SHALL mostrar `Mostrando 5 de {N}
encuentros.` con el total real. Los avisos de alumnos bloqueados SHALL mostrarse en la campana del
armazón, no en un bloque del tablero.

El tablero SHALL NOT mostrar bloques de entregas por corregir, asistencia promedio, correcciones,
novedades ni mensajes: el maquetado no registra esas entidades y sus valores del prototipo (`18`
entregas, `92 %` de asistencia, `4` comisiones) no son datos del sistema. Tampoco SHALL mostrar un
enlace suelto `Ir a mis alumnos` al pie: la navegación al padrón vive en cada tarjeta. El encabezado de
los conteos de acceso SHALL seguir llamándose `ACCESO` y no `RESTRICCIONES`, porque las tarjetas
muestran conteos de acceso y no restricciones.

#### Scenario: El docente abre sus comisiones
- **WHEN** el docente abre `Mis Comisiones`
- **THEN** ve el saludo con su nombre y la fecha real, las cuatro tarjetas con sus valores derivados, el bloque `Tus comisiones, a un vistazo` con una tarjeta por comisión activa, `Tu agenda` y la campana del armazón con los alumnos bloqueados

#### Scenario: El docente espera mientras cargan sus comisiones
- **WHEN** el docente abre `Mis Comisiones` y la consulta todavía no resolvió
- **THEN** el tablero ya se pinta con su forma completa y cada valor que depende de la lectura muestra `—`, nunca un `0` ni un literal

#### Scenario: El docente no tiene comisiones asignadas
- **WHEN** el docente no tiene ninguna comisión asignada
- **THEN** las cuatro tarjetas muestran un `0` real o `—` según lo que la fuente respalde, `Tus comisiones, a un vistazo` cae a su mensaje de vacío y `Tu agenda` a su propio mensaje de vacío, sin eliminar ninguna tarjeta ni bloque

#### Scenario: El docente compara los contadores de acceso
- **WHEN** el docente recorre una tarjeta de comisión
- **THEN** los habilitados y los bloqueados aparecen como texto con singular o plural según la cantidad, por ejemplo `1 bloqueado` frente a `4 bloqueados`, y la barra `Acceso habilitado` muestra el porcentaje del padrón

#### Scenario: El docente cruza los indicadores con su única comisión
- **WHEN** el docente compara `COMISIONES ACTIVAS`, `ALUMNOS HABILITADOS` y `BLOQUEADOS` con las tarjetas de `Comisiones asignadas`
- **THEN** los conteos coinciden con las comisiones activas y sus padrones, porque los indicadores se derivan de esas comisiones y no de valores fijos

#### Scenario: El docente abre el padrón desde su tablero
- **WHEN** el docente pulsa cualquier parte de una tarjeta de `Tus comisiones, a un vistazo`
- **THEN** navega al padrón de esa comisión en `/docente/alumnos/{codigo}`

#### Scenario: El docente ve una comisión finalizada
- **WHEN** el docente tiene asignada una comisión cuya `fecha_fin` es anterior a hoy en `America/Argentina/Buenos_Aires`
- **THEN** la comisión no aparece en `Tus comisiones, a un vistazo` ni en los indicadores, porque solo se listan las activas

#### Scenario: El docente ordena sus comisiones por próxima clase
- **WHEN** el docente tiene dos o más comisiones activas con próximas clases distintas
- **THEN** las tarjetas aparecen de la próxima clase más cercana a la más lejana, y las que no tienen próxima clase quedan al final

#### Scenario: El docente revisa su agenda
- **WHEN** el docente mira `Tu agenda`
- **THEN** ve hasta cinco próximas clases de todas sus comisiones activas, agrupadas por fecha, ordenadas por hora, con el rango horario, el curso y el código de comisión, y `Mostrando 5 de {N} encuentros.` cuando hay más

#### Scenario: El docente no tiene clases próximas
- **WHEN** no hay ninguna clase en los próximos siete días
- **THEN** `Tu agenda` muestra su mensaje de vacío y no desaparece

#### Scenario: El docente lee los avisos en la campana
- **WHEN** el docente tiene alumnos bloqueados en comisiones activas y abre la campana
- **THEN** el panel muestra la alerta con su cantidad y su enlace, y las comisiones finalizadas no generan ningún aviso

#### Scenario: El docente no tiene avisos
- **WHEN** el docente no tiene alumnos bloqueados en comisiones activas
- **THEN** la campana no muestra el punto y, al abrirla, el panel muestra un mensaje informativo y no un bloque vacío

#### Scenario: El docente busca entregas o mensajes
- **WHEN** el docente recorre el tablero buscando `Entregas por corregir`, `Correcciones pendientes` o `Asistencia promedio`
- **THEN** no los encuentra, porque el maquetado no registra entregas ni promedios de asistencia; el único aviso vive en la campana

#### Scenario: El docente busca la columna de restricciones
- **WHEN** el docente lee los conteos de acceso de una tarjeta de comisión
- **THEN** no encuentra una columna `RESTRICCIONES`, porque la tarjeta usa conteos de acceso
