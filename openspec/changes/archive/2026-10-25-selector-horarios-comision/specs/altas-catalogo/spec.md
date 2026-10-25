# Spec Delta

## MODIFIED Requirements

### Requirement: Consulta y alta de comisiones

El sistema SHALL exponer la consulta de comisiones y su alta. La consulta
`GET /comisiones` SHALL devolver las comisiones con su código derivado, su curso, su
docente, sus horarios de cursada, su texto de días y horarios, su cupo máximo, su arancel
y su modalidad. El alta `POST /comisiones` SHALL aceptar el curso, el docente, los
horarios de cursada, el arancel, el cupo máximo, la modalidad y la sede opcional.

Los horarios SHALL venir como una lista no vacía de rangos, y cada rango SHALL traer el
día de la semana (`LUN` a `DOM`), la hora de inicio y la hora de fin en formato `HH:MM`.
Un mismo día SHALL aparecer a lo sumo una vez. El alta **SHALL NOT aceptar
`dias_horarios` como texto libre**: un cuerpo que lo traiga SHALL responder `422`. El
texto `dias_horarios` de la respuesta SHALL ser el resumen que el sistema deriva de los
horarios guardados, y la respuesta SHALL traer además los horarios estructurados.

WHEN los minutos de un inicio o de un fin no sean múltiplos de 15, WHEN una hora esté
fuera del rango de 6:00 a 22:00, WHEN el fin no sea estrictamente posterior al inicio o
WHEN la lista traiga dos rangos que se pisen dentro de la misma comisión, el sistema SHALL
rechazar el alta con `422` e indicar qué dato corregir.

WHEN el docente ya tenga, en cualquier curso, otra comisión **vigente** —con `activo` en
verdadero— el mismo día cuyo rango se pise con el que se está creando, el sistema SHALL
rechazar el alta con `409` e informar la comisión en conflicto con su código, su día y su
rango. Dos horarios que se tocan sin pisarse —uno termina a las 18:30 y el otro empieza a
las 18:30— SHALL permitirse, porque la comparación de intervalos es estricta. El mismo
horario dictado por docentes distintos SHALL permitirse. Comisiones no vigentes SHALL NOT
participar del chequeo, y una comisión sin docente asignado SHALL NO ser chequeada.

El `docente_id` SHALL ser obligatorio en el alta, aunque la columna de la comisión admita
ausencia para poder asignar el docente más adelante. WHEN falte el docente, el sistema
SHALL rechazar el alta e indicar que el docente es obligatorio. WHEN falte el cupo, los
horarios o el arancel, el sistema SHALL rechazar el alta e indicar los campos faltantes.
WHEN el cupo máximo sea cero, negativo o no numérico, el sistema SHALL rechazarlo e
informar que el cupo debe ser un entero positivo. WHEN el arancel sea negativo o no
numérico, el sistema SHALL rechazarlo e informar el error. `sede_id` SHALL ser **opcional
en toda modalidad**; WHEN la modalidad sea Virtual y la comisión informe una sede, el
sistema SHALL rechazar el alta con `422`. El número de la comisión SHALL ser el máximo de
los números de ese curso más uno, y la respuesta SHALL devolver el código derivado con la
forma del código del curso más el número. WHEN la numeración ya ocupada por otra comisión
del mismo curso colisione, la API SHALL informar el conflicto (historias #2, #5 y #8).

#### Scenario: Alta de comisión correcta
- **WHEN** se envía una comisión con curso, docente, horarios de cursada, cupo máximo, arancel y modalidad
- **THEN** el sistema responde con la comisión creada, su código derivado y sus horarios, y la comisión queda asociada al curso

#### Scenario: La respuesta trae los horarios estructurados
- **WHEN** se consulta el listado o se recibe la respuesta del alta
- **THEN** cada comisión trae sus horarios como filas de día, inicio y fin, además del texto `dias_horarios` derivado de ellos

#### Scenario: El alta no admite texto libre de horarios
- **WHEN** se envía una comisión con `dias_horarios` en lugar de la lista de horarios
- **THEN** el sistema responde `422` y no crea la comisión

#### Scenario: Comisión sin docente
- **WHEN** se envía una comisión sin docente
- **THEN** el sistema no la crea e indica que el docente es obligatorio

#### Scenario: Comisión con campos faltantes
- **WHEN** se envía una comisión sin cupo máximo, sin horarios o sin arancel
- **THEN** el sistema no la crea e indica los campos faltantes

#### Scenario: Sin horarios
- **WHEN** se envía una comisión con la lista de horarios vacía
- **THEN** el sistema responde `422` e indica que falta el horario de cursada

#### Scenario: Minutos fuera de los pasos de 15 minutos
- **WHEN** se envía un horario cuyo inicio o cuyo fin tiene minutos que no son 0, 15, 30 ni 45
- **THEN** el sistema responde `422`

#### Scenario: Rango horario inválido
- **WHEN** se envía un horario con un fin menor o igual al inicio, o con una hora fuera de 6:00 a 22:00
- **THEN** el sistema responde `422` e indica el rango correcto

#### Scenario: Dos horarios que se pisan dentro de la comisión
- **WHEN** se envía una comisión con dos rangos del mismo día que se pisan, por ejemplo 19:00-21:00 y 20:00-22:00
- **THEN** el sistema responde `422` y no crea la comisión

#### Scenario: Choque de horario con otra comisión del mismo docente
- **WHEN** el docente tiene otra comisión vigente, en otro curso, el martes de 19:00 a 21:00, y se crea una comisión suya del martes de 20:00 a 22:00
- **THEN** el sistema responde `409` e informa la comisión en conflicto con su código, su día y su rango

#### Scenario: Los bordes exactos se permiten
- **WHEN** una comisión del mismo docente termina a las 18:30 y la nueva empieza a las 18:30 el mismo día
- **THEN** el sistema acepta el alta, porque la comparación de intervalos es estricta

#### Scenario: El mismo horario de otro docente se permite
- **WHEN** otro docente ya dicta el mismo día y el mismo rango
- **THEN** el sistema acepta el alta, porque el chequeo de solapamiento es por docente

#### Scenario: Las comisiones no vigentes no chocan
- **WHEN** la comisión del mismo docente que se cruza está dada de baja (`activo` en falso)
- **THEN** el sistema acepta el alta

#### Scenario: Cupo inválido
- **WHEN** se envía un cupo máximo cero, negativo o no numérico
- **THEN** el sistema rechaza el alta con `422`. El texto que llega de la API es el del validador y no está en es-AR; el mensaje «El cupo debe ser un entero positivo» lo pone el formulario de la pantalla, que valida antes de enviar

#### Scenario: Arancel inválido
- **WHEN** se envía un arancel negativo o no numérico
- **THEN** el sistema rechaza el alta e informa el error

#### Scenario: Modalidad que exige sede
- **WHEN** se envía una comisión Presencial o Híbrida sin sede
- **THEN** el sistema la registra con `201` y `sede_id` en `NULL`, porque la sede es opcional en toda modalidad. El nombre del escenario conserva el de la regla anterior: ya no hay modalidad que exija sede

#### Scenario: Modalidad virtual sin sede
- **WHEN** se envía una comisión Virtual sin sede
- **THEN** el sistema la registra y no exige sede

#### Scenario: Modalidad virtual con sede
- **WHEN** se envía una comisión Virtual informando una sede
- **THEN** el sistema rechaza el alta con `422`. **El texto que llega es el crudo de la restricción de la base y no un mensaje de interfaz**: el formulario de la pantalla no renderiza el campo para modalidad `Virtual`, así que no hay mensaje de interfaz que mostrar, y el del backend para esta regla queda pendiente del change que escriba los mensajes de rechazo

#### Scenario: Numeración por curso
- **WHEN** se crean dos comisiones del mismo curso y después una tercera
- **THEN** sus códigos derivados llevan los números consecutivos de ese curso, y el número de la tercera es el máximo anterior más uno

#### Scenario: Listado de comisiones
- **WHEN** se consulta el listado de comisiones
- **THEN** cada fila trae el código derivado, el nombre del curso, el docente, los horarios y su texto derivado, el cupo máximo y el arancel
