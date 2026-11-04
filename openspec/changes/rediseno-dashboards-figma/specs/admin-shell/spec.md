# Spec Delta

## MODIFIED Requirements

### Requirement: Tablero operativo con indicadores del catálogo y valores pendientes

The system SHALL mostrar, como encabezado del tablero, el saludo `Buen día, {nombre de la cuenta}`
seguido de una línea de fecha con la fecha real del día que la fuente informa, formateada para español
rioplatense con el día de la semana capitalizado (por ejemplo `Viernes 9 de octubre`), y la frase de
apoyo `Todo lo que necesitás para gestionar tu academia.`. El nombre es el de la cuenta de la sesión y
la fecha SHALL ser un valor calculado a partir del día corriente, no un literal del maquetado.

El sistema SHALL mostrar una fila de cuatro tarjetas de indicador, cada una con su ícono, su rótulo,
su valor y una línea de contexto: `ALUMNOS INSCRIPTOS` con la cantidad de alumnos distintos con al
menos una inscripción activa y el contexto `{N} inscripciones activas`; `CUPO PROMEDIO OCUPADO` con el
promedio del porcentaje de ocupación de las comisiones vigentes y el contexto `{N} comisiones
vigentes`; `COMISIONES` con el total que informa el catálogo y el contexto `{N} vigentes`; y `COBROS
PENDIENTES DE COBRO` con la suma de comprobantes pendientes de revisión y cobranzas observadas, y el
contexto que separa ambas cantidades. Los cuatro valores SHALL venir calculados del agregado del
tablero y la pantalla SHALL NOT calcular ningún agregado propio.

El sistema SHALL mostrar el bloque `Panorama de cobros` con el valor destacado `Cobrado este mes`,
que SHALL ser la suma real de las cobranzas acreditadas con fecha en el mes corriente, y con un
gráfico de línea de los cobros acreditados por mes de los últimos seis meses, incluido el corriente y
con los meses sin cobros en `0`. A la derecha del gráfico SHALL mostrar `Ocupación por comisión` con
hasta tres comisiones vigentes y su porcentaje real. El bloque SHALL NOT graficar inscripciones por
mes ni ningún valor sin fuente: el modelo no registra la fecha de inscripción. La pantalla SHALL NOT
mostrar los números del prototipo (`1.248 alumnos activos`, `$ 8,4 M cobrados`, `84 % del objetivo`,
`68 %`, `92 %`).

El sistema SHALL mostrar el bloque `Comprobantes recientes` con hasta cinco comprobantes enviados por
alumnos, de cualquier estado, ordenados por fecha de recepción descendente. Las filas y las etiquetas
de estado SHALL ser las mismas que las del bloque `Comprobantes de alumnos` de `Cobranzas e Ingresos`
—`PENDIENTE DE REVISIÓN`, `ACEPTADO`, `OBSERVADO` y `RECHAZADO`—, con el alumno, el curso y la
comisión, el estado y la fecha de recepción. El bloque SHALL ofrecer `Ver todos`, que navega a
`/admin/cobranzas`. El bloque que el prototipo titula `Últimas inscripciones` se reemplaza por este:
el sistema no registra la fecha de inscripción.

El sistema SHALL mostrar el bloque `Tu agenda` con la semana corriente y las próximas clases de todas
las comisiones, ordenadas por fecha y hora, con un máximo de ocho encuentros dentro de los próximos
siete días. Cada encuentro SHALL mostrar la fecha agrupada con el encabezado `HOY, {día de la semana}
{día} DE {mes}` o su equivalente, el rango horario, el curso, el código de comisión y el docente
cuando lo tenga. La agenda SHALL incluir las comisiones de todos los docentes y SHALL NOT mostrar
clases de comisiones finalizadas. El bloque SHALL ofrecer `Ver comisiones`, que navega a
`/admin/cursos`, y SHALL NOT mostrar controles de semana inerte.

El sistema SHALL mostrar el bloque `Requiere tu atención` con las alertas de gestión reales cuyo
conteo sea mayor a cero: comprobantes pendientes de revisión, cobranzas observadas y comisiones sin
vacantes. Cada alerta SHALL mostrar su cantidad y SHALL navegar a la pantalla donde se resuelve
—`/admin/cobranzas` o `/admin/cursos`—. WHEN no haya ninguna alerta, el bloque SHALL mostrar un
mensaje informativo y SHALL NOT quedar vacío ni mostrar líneas del prototipo.

El sistema SHALL mostrar el bloque `Accesos Rápidos del Personal` con dos acciones reales:
`Registrar Cobranza`, que navega a `/admin/cobranzas`, y `Verificar Habilitaciones`, que navega a
`/admin/alumnos`, donde vive la ficha con la habilitación por inscripción. La tercera acción del
prototipo, `Descargar Reporte del Día`, SHALL NOT renderizarse porque no tiene historia ni endpoint
detrás.

El tablero SHALL conservar siempre su forma: la fila de cuatro tarjetas y los bloques `Panorama de
cobros`, `Comprobantes recientes`, `Tu agenda`, `Requiere tu atención` y `Accesos Rápidos del
Personal` SHALL renderizarse aunque su dato no exista todavía, y el tablero SHALL NOT eliminar una
tarjeta ni un bloque porque la fuente no pueda responder. Donde la fuente no puede responder, el valor
SHALL ser `—`; donde la fuente responde, SHALL mostrarse el valor real, incluido un `0` real. El valor
`—` SHALL significar "todavía no lo sé" y SHALL NOT significar "cero". Mientras la lectura del
agregado no haya resuelto, cada valor que dependa de ella SHALL ser `—`, nunca un `0` ni un literal.
Si la lectura falla, los bloques SHALL informar el fallo en lugar de afirmar que no hay datos.

#### Scenario: El usuario abre el Dashboard
- **WHEN** un usuario de Secretaría abre `Dashboard`
- **THEN** ve el saludo con su nombre y la fecha real, las cuatro tarjetas con sus valores reales y su contexto, `Panorama de cobros`, `Comprobantes recientes`, `Tu agenda` y `Requiere tu atención`

#### Scenario: El usuario compara los indicadores con el catálogo
- **WHEN** el usuario contrasta `ALUMNOS INSCRIPTOS`, `CUPO PROMEDIO OCUPADO`, `COMISIONES` y `COBROS PENDIENTES DE COBRO` con el padrón, el catálogo y las cobranzas
- **THEN** los cuatro valores coinciden con los calculados en el servidor y el tablero no calcula ningún agregado propio

#### Scenario: El usuario espera mientras carga el tablero
- **WHEN** el usuario abre `Dashboard` y el agregado todavía no resolvió
- **THEN** la fila de cuatro tarjetas y los cinco bloques ya se pintan con su forma, y cada valor que depende de la lectura muestra `—`, nunca un `0` ni un literal

#### Scenario: El usuario lee el panorama de cobros
- **WHEN** el usuario mira `Panorama de cobros`
- **THEN** ve `Cobrado este mes` con la suma de las cobranzas acreditadas del mes y la línea de los últimos seis meses, con los meses sin cobros en `0`

#### Scenario: El usuario abre el tablero sin cobranzas
- **WHEN** no hay ninguna cobranza acreditada en los últimos seis meses
- **THEN** `Cobrado este mes` muestra `0`, la serie muestra seis meses en `0` y el bloque informa que todavía no hay cobros, sin inventar una curva

#### Scenario: El usuario busca un gráfico del prototipo
- **WHEN** el usuario recorre el tablero buscando la sección `La academia en números` o un gráfico de inscripciones por mes
- **THEN** no las encuentra: el gráfico es `Panorama de cobros` y se construye con las fechas de pago, porque el modelo no guarda la fecha de inscripción

#### Scenario: El usuario compara los comprobantes recientes con Cobranzas
- **WHEN** el usuario abre `Cobranzas e Ingresos` y compara su bloque `Comprobantes de alumnos` con `Comprobantes recientes`
- **THEN** las filas son los mismos comprobantes enviados por alumnos, con las mismas etiquetas de estado, y `Ver todos` abre `/admin/cobranzas`

#### Scenario: El usuario recorre la agenda de todas las comisiones
- **WHEN** el usuario mira `Tu agenda`
- **THEN** ve las próximas clases de todas las comisiones, agrupadas por fecha, ordenadas por hora, con curso, código de comisión y docente, y sin clases de comisiones finalizadas

#### Scenario: El usuario no tiene clases próximas
- **WHEN** no hay ninguna clase en los próximos siete días
- **THEN** `Tu agenda` muestra su mensaje de vacío y no desaparece

#### Scenario: El usuario lee la línea de lista de espera
- **WHEN** el usuario recorre `Requiere tu atención` buscando la línea de lista de espera de `CUR-104`
- **THEN** no la encuentra: el bloque muestra alertas reales o su mensaje informativo, y ninguna línea del prototipo

#### Scenario: El usuario lee las alertas de gestión
- **WHEN** hay comprobantes pendientes, cobranzas observadas o comisiones sin vacantes
- **THEN** `Requiere tu atención` muestra cada alerta con su cantidad y su enlace a la pantalla donde se resuelve

#### Scenario: El usuario no tiene alertas
- **WHEN** no hay comprobantes pendientes, cobranzas observadas ni comisiones sin vacantes
- **THEN** `Requiere tu atención` muestra un mensaje informativo y no un bloque vacío

#### Scenario: El usuario pulsa una acción rápida
- **WHEN** el usuario pulsa `Registrar Cobranza`
- **THEN** navega a `/admin/cobranzas`; WHEN pulsa `Verificar Habilitaciones` THEN navega a `/admin/alumnos`

#### Scenario: El usuario busca el reporte del día
- **WHEN** el usuario recorre los accesos rápidos buscando `Descargar Reporte del Día`
- **THEN** no lo encuentra, porque no tiene historia ni endpoint detrás

#### Scenario: El usuario busca las alertas y los números inventados
- **WHEN** el usuario recorre el tablero
- **THEN** no encuentra `Comprobante ilegible de Agustina Benítez`, `Cheque de Banco Federal pendiente de acreditación`, `Valeria Rossi debe la mitad del arancel`, la lista de espera de `CUR-104` ni los números del prototipo

#### Scenario: Un valor real es cero
- **WHEN** la fuente informa cero comprobantes pendientes y cero cobranzas observadas
- **THEN** los indicadores muestran `0` y no `—`, porque la lectura resolvió y el cero es un dato
