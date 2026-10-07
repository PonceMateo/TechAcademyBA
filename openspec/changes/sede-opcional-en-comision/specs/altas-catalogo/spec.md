# Spec Delta

## Purpose

Definir el comportamiento de los cuatro endpoints de consulta y alta del catálogo y de
docentes, y de las tres pantallas de alta de Administración que los consumen. Es una
capability nueva porque `domain-schema` declara explícitamente que no define endpoints
CRUD de dominio: la estructura de datos y su migración inicial viven allá, y el
comportamiento observable de las altas vive acá.

## MODIFIED Requirements

### Requirement: Consulta y alta de comisiones

El sistema SHALL exponer la consulta de comisiones y su alta. La consulta
`GET /comisiones` SHALL devolver las comisiones con su código derivado, su curso, su
docente, sus días y horarios, su cupo máximo, su arancel y su modalidad. El alta
`POST /comisiones` SHALL aceptar el curso, el docente, los días y horarios, el arancel,
el cupo máximo, la modalidad y la sede opcional.

El `docente_id` SHALL ser obligatorio en el alta, aunque la columna de la comisión admita
ausencia para poder asignar el docente más adelante. WHEN falte el docente, el sistema
SHALL rechazar el alta e indicar que el docente es obligatorio. WHEN falte el cupo, los
días y horarios o el arancel, el sistema SHALL rechazar el alta e indicar los campos
faltantes. WHEN el cupo máximo sea cero, negativo o no numérico, el sistema SHALL rechazarlo
e informar que el cupo debe ser un entero positivo. WHEN el arancel sea negativo o no
numérico, el sistema SHALL rechazarlo e informar el error. `sede_id` SHALL ser **opcional
en toda modalidad**; WHEN la modalidad sea Virtual y la comisión informe una sede, el
sistema SHALL rechazar el alta con `422`. El número de la comisión SHALL ser el máximo de
los números de ese curso más uno, y la respuesta SHALL devolver el código derivado con la
forma del código del curso más el número. WHEN la numeración ya ocupada por otra comisión
del mismo curso colisione, la API SHALL informar el conflicto (historias #2, #5 y #8).

#### Scenario: Alta de comisión correcta
- **WHEN** se envía una comisión con curso, docente, días y horarios, cupo máximo, arancel y modalidad
- **THEN** el sistema responde con la comisión creada y su código derivado, y la comisión queda asociada al curso

#### Scenario: Comisión sin docente
- **WHEN** se envía una comisión sin docente
- **THEN** el sistema no la crea e indica que el docente es obligatorio

#### Scenario: Comisión con campos faltantes
- **WHEN** se envía una comisión sin cupo máximo, sin días y horarios o sin arancel
- **THEN** el sistema no la crea e indica los campos faltantes

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
- **THEN** cada fila trae el código derivado, el nombre del curso, el docente, los días y horarios, el cupo máximo y el arancel