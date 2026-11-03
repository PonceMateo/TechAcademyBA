# Spec Delta

## MODIFIED Requirements

### Requirement: Listado de comisiones asignadas

The system SHALL mostrar, como encabezado del tablero, el saludo `Buen día, {nombre de la
cuenta}` seguido de una línea de fecha con la fecha real del día que la fuente informa,
formateada para español rioplatense con el día de la semana capitalizado (por ejemplo `Viernes
9 de octubre`), y la frase de apoyo `Tu agenda y tus comisiones en un solo lugar.`. La fecha
SHALL ser un valor calculado a partir del día corriente, no un literal del maquetado. El texto
SHALL NOT anunciar una cantidad de clases ni de entregas: esos valores no están en el
maquetado.

The system SHALL mostrar cuatro tarjetas de indicador —`COMISIONES ACTIVAS`, `ALUMNOS
HABILITADOS`, `BLOQUEADOS` y `PRÓXIMA CLASE`— cuyos valores SHALL derivarse de las comisiones
que el docente tiene asignadas: la cantidad de comisiones asignadas, los conteos de acceso de
esas comisiones y la próxima clase que estas informan, con un `0` real cuando el conteo es cero y
`—` cuando la fuente no puede responder (por ejemplo, cuando no hay ninguna próxima clase). Las
tarjetas SHALL NOT mostrar valores literales fijos, sino los que resultan de las comisiones
asignadas del docente. SHALL mostrar el bloque `Comisiones asignadas` con una fila por comisión
asignada, con su código, su curso, su horario, su estado `Vigente` o `Finalizada`, su próxima clase y
los conteos de habilitados y bloqueados de su padrón. Una comisión `Finalizada` SHALL seguir
apareciendo en la vista del docente con su estado, sin eliminarse por haber terminado. El docente del
maquetado tiene exactamente una comisión asignada en los datos del cliente, por lo que el maquetado
SHALL NOT inventar comisiones adicionales para completar el bloque.

El tablero SHALL conservar siempre su forma: las cuatro tarjetas, el bloque `Comisiones
asignadas` y el bloque `Tu agenda` SHALL renderizarse aunque su dato no exista todavía, y el
tablero SHALL NOT eliminar una tarjeta ni un bloque porque la fuente no pueda responder. Donde la
fuente no puede responder, el valor SHALL ser `—`; donde la fuente responde, SHALL mostrarse el
valor real, incluido un `0` real. El valor `—` SHALL significar "todavía no lo sé" y SHALL NOT
significar "cero". Mientras la lectura de las comisiones asignadas no haya resuelto, cada valor
que depende de ella SHALL ser `—`, nunca un `0` ni un literal.

El tablero SHALL organizarse en dos columnas: a la izquierda, los indicadores y el bloque
`Comisiones asignadas`; a la derecha, un bloque `Tu agenda` con una fila por clase de esa misma
comisión, tomada de su horario y de su próxima clase. Cuando el docente no tiene comisiones
asignadas, el bloque `Comisiones asignadas` SHALL caer a su mensaje de vacío y `Tu agenda` a su
propio mensaje de vacío. El tablero SHALL NOT mostrar bloques de correcciones pendientes,
novedades ni mensajes: el maquetado no registra entregas por corregir ni mensajes, y esos bloques
del prototipo no tienen datos detrás.

Los contadores SHALL renderizarse como chip verde para los habilitados y chip rojo para los
bloqueados, y la forma singular o plural SHALL coincidir con la cantidad. El encabezado que el
prototipo titula `RESTRICCIONES` SHALL renombrarse `ACCESO`, porque sus celdas contienen
conteos de acceso y no restricciones. Este renombrado es una corrección intencional de una
inconsistencia del prototipo.

#### Scenario: El docente abre sus comisiones
- **WHEN** el docente abre `Mis Comisiones`
- **THEN** ve el saludo con su nombre y la línea de fecha real del día, las cuatro tarjetas —`COMISIONES ACTIVAS`, `ALUMNOS HABILITADOS`, `BLOQUEADOS` y `PRÓXIMA CLASE`— con los valores derivados de sus comisiones asignadas, el bloque `Comisiones asignadas` y, en la columna derecha, el bloque `Tu agenda`

#### Scenario: El docente espera mientras cargan sus comisiones
- **WHEN** el docente abre `Mis Comisiones` y la consulta de sus comisiones asignadas todavía no resolvió
- **THEN** el tablero ya se pinta con su forma completa y cada valor que depende de la lectura muestra `—`, nunca un `0` ni un literal, hasta que la consulta resuelve

#### Scenario: El docente no tiene comisiones asignadas
- **WHEN** el docente no tiene ninguna comisión asignada
- **THEN** las cuatro tarjetas muestran un `0` real o `—` según lo que la fuente respalde, el bloque `Comisiones asignadas` cae a su mensaje de vacío y `Tu agenda` a su propio mensaje de vacío, sin eliminar ninguna tarjeta ni bloque

#### Scenario: El docente compara los contadores de acceso
- **WHEN** el docente recorre los contadores de cada comisión
- **THEN** los habilitados aparecen en chip verde y los bloqueados en chip rojo, y las etiquetas usan singular o plural según la cantidad, por ejemplo `1 bloqueado` frente a `4 bloqueados`

#### Scenario: El docente cruza los indicadores con su única comisión
- **WHEN** el docente compara `COMISIONES ACTIVAS` con el contenido del bloque `Comisiones asignadas`
- **THEN** los conteos de las tarjetas coinciden con las comisiones asignadas y su padrón, porque los indicadores se derivan de las comisiones asignadas y no de valores fijos

#### Scenario: El docente ve una comisión finalizada
- **WHEN** el docente tiene asignada una comisión cuya `fecha_fin` es anterior a hoy en `America/Argentina/Buenos_Aires`
- **THEN** la comisión sigue apareciendo en el bloque `Comisiones asignadas` con el estado `Finalizada`

#### Scenario: El docente busca la columna de restricciones
- **WHEN** el docente lee los encabezados de la tabla de comisiones
- **THEN** la columna de conteos se titula `ACCESO` y no `RESTRICCIONES`

#### Scenario: El docente busca entregas o mensajes
- **WHEN** el docente recorre el tablero buscando `Correcciones pendientes` o novedades
- **THEN** no los encuentra, porque el maquetado no registra entregas por corregir ni mensajes
