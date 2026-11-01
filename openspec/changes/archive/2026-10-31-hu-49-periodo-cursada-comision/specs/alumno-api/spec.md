# Spec Delta

## MODIFIED Requirements

### Requirement: Detalle de la cursada propia

El sistema SHALL exponer el detalle de una inscripción propia a partir del código de la comisión.
La respuesta SHALL incluir los datos de la comisión con su docente y sus días y horarios, la
categoría y el porcentaje de beca, el estado de habilitación con su causa, el período de cursada y
los próximos encuentros.

El período de cursada SHALL informar la fecha de inicio y la fecha de fin cargadas en la comisión, o
ninguna de las dos: el contrato SHALL NOT informar una fecha con la otra sin definir. WHEN la
comisión no tenga período —porque se creó antes de que el período existiera—, la respuesta SHALL
informar las dos fechas como no definidas, y el sistema SHALL NOT inventar fechas de referencia.
Los próximos encuentros SHALL derivarse de los días y horarios cargados de la comisión,
desde el día corriente en adelante y **hasta la fecha de fin, inclusive**, con la fecha de cada
encuentro, el horario de ese día y el tema de la clase cuando exista. WHEN la fecha de fin ya haya
pasado, la respuesta SHALL NOT informar ningún encuentro. El link de la clase virtual SHALL NOT
formar parte de este contrato.

Cuando el código no corresponda a una inscripción del alumno que llama —porque no existe o porque
es de otra comisión— el sistema SHALL responder `404` con el mismo mensaje en ambos casos, sin
revelar si la comisión existe.

#### Scenario: El alumno abre el detalle de su cursada

- **WHEN** el alumno consulta el detalle de la comisión en la que está inscripto
- **THEN** recibe docente, días y horarios, categoría, estado de habilitación con su causa, período y próximos encuentros

#### Scenario: El período informa la fecha de fin

- **WHEN** el alumno consulta el detalle de una comisión que tiene el período cargado
- **THEN** la respuesta informa la fecha de inicio y la fecha de fin, sin completar ninguna con un valor de ejemplo

#### Scenario: La comisión todavía no tiene fecha de fin

- **WHEN** el alumno consulta el detalle de una comisión creada antes de que el período existiera
- **THEN** la respuesta informa las dos fechas del período como no definidas, sin completarlas con un valor de ejemplo

#### Scenario: Los encuentros no pasan la fecha de fin

- **WHEN** la fecha de fin de la comisión cae antes de juntar los encuentros que la pantalla muestra
- **THEN** la respuesta informa solo los encuentros cuya fecha es igual o anterior a la fecha de fin

#### Scenario: La cursada terminada no muestra encuentros

- **WHEN** el alumno consulta el detalle de una comisión cuya fecha de fin ya pasó
- **THEN** la respuesta informa el período completo y no informa ningún encuentro próximo

#### Scenario: La cursada terminada lo dice en la pantalla

- **WHEN** el alumno abre el detalle de una comisión cuyo período ya terminó y la respuesta no trae encuentros
- **THEN** la pantalla informa la fecha en que terminó la cursada y no dice que faltan los días de cursada

#### Scenario: El tema de la clase todavía no está cargado

- **WHEN** los próximos encuentros se derivan de los horarios y no hay tema cargado para esa fecha
- **THEN** el encuentro informa su fecha y su horario y deja el tema sin definir, y la pantalla no muestra ningún texto de tema en su lugar

#### Scenario: Cada encuentro informa su horario

- **WHEN** el alumno consulta los próximos encuentros de una comisión
- **THEN** cada encuentro trae el rango horario de ese día en la grilla de la comisión, por ejemplo `18:30-21:30`, aunque todavía no haya clase cargada

#### Scenario: El link de la clase no está disponible

- **WHEN** el alumno consulta el detalle de su cursada
- **THEN** la respuesta no incluye ningún link de clase virtual, porque esa función llega con la historia #39

#### Scenario: El alumno pide el detalle de una comisión ajena

- **WHEN** el alumno consulta el detalle de una comisión en la que no está inscripto
- **THEN** el sistema responde `404` sin revelar si esa comisión existe
