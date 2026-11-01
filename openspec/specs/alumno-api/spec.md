# alumno-api Specification

## Purpose
Contrato de autoservicio del alumno autenticado: consultar sus propias inscripciones y el detalle de
su cursada, ver su estado de habilitación con su causa, leer su perfil y editar sus datos de
contacto, sin acceso a datos de otros alumnos.

## Requirements

### Requirement: Consulta de las inscripciones propias

El sistema SHALL exponer una consulta de las inscripciones del alumno autenticado que devuelva, para
cada inscripción, el código de la comisión, el nombre del curso, el nombre del docente, el resumen
legible de días y horarios, la categoría de inscripción, el porcentaje de beca cuando corresponda y
el estado de habilitación derivado con su causa. La respuesta SHALL ser una lista, vacía cuando el
alumno no tiene inscripciones, y SHALL incluir únicamente las inscripciones de la cuenta que llama.
Un usuario sin rol `ALUMNO` SHALL recibir `403`.

El estado de habilitación y su causa SHALL ser los mismos que ve Administración para esa
inscripción, incluido el bloqueo forzado por Secretaría: el sistema SHALL NOT recalcular el estado
en la pantalla del alumno ni exponer una causa distinta de la administrativa.

#### Scenario: El alumno tiene una cursada

- **WHEN** el alumno autenticado consulta sus inscripciones
- **THEN** recibe una lista con su comisión —código, curso, docente, horarios, categoría y el estado derivado con su causa—

#### Scenario: El alumno no tiene inscripciones

- **WHEN** el alumno autenticado consulta sus inscripciones y no tiene ninguna
- **THEN** recibe una lista vacía, no un error

#### Scenario: La inscripción está bloqueada

- **WHEN** el alumno consulta una inscripción cuyo estado derivado es `BLOQUEADO`
- **THEN** la respuesta trae el estado `BLOQUEADO` con la causa del bloqueo, idéntica a la que ve Administración

#### Scenario: Una cuenta sin rol de alumno consulta

- **WHEN** un usuario autenticado con rol `ADMIN` o `DOCENTE` consulta las inscripciones del alumno
- **THEN** el sistema responde `403` sin devolver ninguna inscripción

#### Scenario: Una cuenta con cambio de contraseña pendiente consulta

- **WHEN** un alumno con cambio de contraseña pendiente consulta sus inscripciones
- **THEN** el sistema responde `403` con el aviso de cambio pendiente, y el alumno solo puede cambiar la contraseña

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

### Requirement: Consulta del perfil propio

El sistema SHALL exponer el perfil de la cuenta del alumno autenticado con su nombre, su documento,
su email y su teléfono. El perfil SHALL NOT incluir datos de otros alumnos ni de terceros
pagadores.

#### Scenario: El alumno abre su perfil

- **WHEN** el alumno autenticado consulta su perfil
- **THEN** recibe su nombre, su documento, su email y su teléfono

#### Scenario: El alumno no tiene teléfono cargado

- **WHEN** el alumno consulta un perfil sin teléfono
- **THEN** el teléfono llega vacío, no como un texto inventado

### Requirement: Edición de los datos de contacto propios

El sistema SHALL permitir que el alumno autenticado actualice **solo su email y su teléfono**. El
documento, el nombre y el identificador asignado por el sistema SHALL permanecer no editables: un
cuerpo que intente modificarlos SHALL rechazarse con `422` sin persistir ningún cambio.

El email SHALL validarse con la misma regla que el alta de alumnos y SHALL ser único entre las
cuentas: cuando ya pertenece a otra cuenta, el sistema SHALL responder `409` informando el conflicto
y SHALL NOT modificar ningún dato. El teléfono SHALL validarse con la misma regla compartida del
padrón. Un email o un teléfono con forma inválida SHALL responder `422`. La operación SHALL
persistir el cambio en la cuenta y en el padrón del alumno, de modo que Administración vea el dato
actualizado.

#### Scenario: El alumno cambia su email y su teléfono

- **WHEN** el alumno envía un email y un teléfono válidos
- **THEN** el sistema guarda los dos datos y la respuesta los devuelve actualizados

#### Scenario: El alumno cambia el email a uno ya registrado

- **WHEN** el alumno envía un email que pertenece a otra cuenta
- **THEN** el sistema responde `409` con el conflicto y no modifica el email ni ningún otro dato

#### Scenario: El alumno intenta editar su documento

- **WHEN** el cuerpo de la edición incluye el documento, el nombre o el identificador del sistema
- **THEN** el sistema responde `422` y no persiste el cambio

#### Scenario: El alumno envía un teléfono con forma inválida

- **WHEN** el alumno envía un teléfono que no cumple la regla del padrón
- **THEN** el sistema responde `422` y conserva el teléfono anterior

#### Scenario: El alumno borra su teléfono

- **WHEN** el alumno envía el teléfono vacío
- **THEN** el sistema guarda el teléfono como no informado y el perfil lo devuelve vacío
