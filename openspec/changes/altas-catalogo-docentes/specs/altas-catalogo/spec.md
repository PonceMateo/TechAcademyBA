# Spec Delta

## Purpose

Definir el comportamiento de los cuatro endpoints de consulta y alta del catálogo y de
docentes, y de las tres pantallas de alta de Administración que los consumen. Es una
capability nueva porque `domain-schema` declara explícitamente que no define endpoints
CRUD de dominio: la estructura de datos y su migración inicial viven allá, y el
comportamiento observable de las altas vive acá.

## ADDED Requirements

### Requirement: Consulta y alta de cursos

El sistema SHALL exponer la consulta del catálogo de cursos y su alta. La consulta
`GET /cursos` SHALL devolver los cursos con su código generado, su nombre y su descripción.
El alta `POST /cursos` SHALL aceptar **únicamente** el nombre del curso y una descripción
opcional: el código SHALL NOT formar parte del contrato de entrada, porque lo genera el
sistema. WHEN el nombre informado normalice al mismo valor que el de un curso existente,
el sistema SHALL rechazar el alta e informar que el nombre ya está registrado e
identificar el curso existente. WHEN el nombre falte o venga vacío, el sistema SHALL
rechazar el alta e indicar que el nombre es obligatorio. WHEN el alta es exitosa, la
respuesta SHALL devolver el curso creado **con el código generado** y el curso SHALL
quedar disponible en el catálogo (historia #1).

#### Scenario: Alta de curso correcta
- **WHEN** se envía el nombre de un curso que no existe, con una descripción opcional
- **THEN** el sistema responde con el curso creado y su código generado, y el curso queda disponible en la consulta del catálogo

#### Scenario: El contrato de alta no lleva código
- **WHEN** se inspecciona lo que el alta de curso admite
- **THEN** admite nombre y descripción opcional, y ningún campo de código

#### Scenario: Nombre de curso duplicado
- **WHEN** se envía un nombre que solo difiere del existente en mayúsculas, acentos o espacios
- **THEN** el sistema rechaza el alta, informa que el nombre está repetido e identifica el curso existente

#### Scenario: Curso sin nombre
- **WHEN** se envía un alta de curso sin nombre o con el nombre vacío
- **THEN** el sistema no crea el curso e indica que el nombre es obligatorio

#### Scenario: Listado del catálogo
- **WHEN** se consulta el catálogo de cursos
- **THEN** la respuesta trae cada curso con su código generado y su nombre

### Requirement: Consulta y alta de comisiones

El sistema SHALL exponer la consulta de comisiones y su alta. La consulta
`GET /comisiones` SHALL devolver las comisiones con su código derivado, su curso, su
docente, sus días y horarios, su cupo máximo, su arancel y su modalidad. El alta
`POST /comisiones` SHALL aceptar el curso, el docente, los días y horarios, el arancel,
el cupo máximo, la modalidad y, cuando corresponda, la sede.

El `docente_id` SHALL ser obligatorio en el alta, aunque la columna de la comisión admita
ausencia para poder asignar el docente más adelante. WHEN falte el docente, el sistema
SHALL rechazar el alta e indicar que el docente es obligatorio. WHEN falte el cupo, los
días y horarios o el arancel, el sistema SHALL rechazar el alta e indicar los campos
faltantes. WHEN el cupo máximo sea cero, negativo o no numérico, el sistema SHALL rechazarlo
e informar que el cupo debe ser un entero positivo. WHEN el arancel sea negativo o no
numérico, el sistema SHALL rechazarlo e informar el error. WHEN la modalidad sea Presencial
o Híbrido y no se informe sede, el sistema SHALL rechazar el alta y solicitar seleccionar
una sede; WHEN la modalidad sea Virtual, la sede SHALL ser opcional. El número de la
comisión SHALL ser el máximo de los números de ese curso más uno, y la respuesta SHALL
devolver el código derivado con la forma del código del curso más el número. WHEN la
numeración ya ocupada por otra comisión del mismo curso colisione, la API SHALL informar
el conflicto (historias #2, #5 y #8).

#### Scenario: Alta de comisión correcta
- **WHEN** se envía una comisión con curso, docente, días y horarios, cupo máximo, arancel, modalidad y sede cuando corresponde
- **THEN** el sistema responde con la comisión creada y su código derivado, y la comisión queda asociada al curso

#### Scenario: Comisión sin docente
- **WHEN** se envía una comisión sin docente
- **THEN** el sistema no la crea e indica que el docente es obligatorio

#### Scenario: Comisión con campos faltantes
- **WHEN** se envía una comisión sin cupo máximo, sin días y horarios o sin arancel
- **THEN** el sistema no la crea e indica los campos faltantes

#### Scenario: Cupo inválido
- **WHEN** se envía un cupo máximo cero, negativo o no numérico
- **THEN** el sistema rechaza el alta e informa que el cupo debe ser un entero positivo

#### Scenario: Arancel inválido
- **WHEN** se envía un arancel negativo o no numérico
- **THEN** el sistema rechaza el alta e informa el error

#### Scenario: Modalidad que exige sede
- **WHEN** se envía una comisión Presencial o Híbrida sin sede
- **THEN** el sistema rechaza el alta y solicita seleccionar una sede

#### Scenario: Modalidad virtual sin sede
- **WHEN** se envía una comisión Virtual sin sede
- **THEN** el sistema la registra y no exige sede

#### Scenario: Numeración por curso
- **WHEN** se crean dos comisiones del mismo curso y después una tercera
- **THEN** sus códigos derivados llevan los números consecutivos de ese curso, y el número de la tercera es el máximo anterior más uno

#### Scenario: Listado de comisiones
- **WHEN** se consulta el listado de comisiones
- **THEN** cada fila trae el código derivado, el nombre del curso, el docente, los días y horarios, el cupo máximo y el arancel

### Requirement: Consulta y alta de docentes

El sistema SHALL exponer la consulta del padrón de docentes y su alta. La consulta
`GET /docentes` SHALL devolver los docentes con sus datos personales y la cantidad de
comisiones asignadas. El alta `POST /docentes` SHALL aceptar nombre, apellido, DNI, email
y teléfono opcional, y **SHALL NOT incluir el CUIL en el contrato**: el CUIL no es
información que el alta exija y la columna queda para completarla cuando haya docentes
reales. WHEN el DNI o el email informados ya estén registrados, el sistema SHALL rechazar
el alta e informar **cuál de los dos datos se repitió**, porque el criterio de la historia
pide saber qué colisionó. WHEN el alta es exitosa, el sistema SHALL crear en **una sola
transacción** el docente y su cuenta de acceso con rol de docente, de modo que el docente
quede creado y accesible por su email o no quede ninguno de los dos. La cuenta creada
SHALL quedar sin cambio de contraseña pendiente, de manera coherente con las cuentas
de demostración, porque el flujo de cambio de contraseña todavía no existe (historia #9).

#### Scenario: Alta de docente correcta
- **WHEN** se envían nombre, apellido, DNI, email y teléfono de un docente no registrado
- **THEN** el sistema responde con el docente creado y su acceso por ese email, y el docente queda disponible para asignar a una comisión

#### Scenario: El contrato de alta de docente no lleva CUIL
- **WHEN** se inspecciona lo que el alta de docente admite
- **THEN** admite nombre, apellido, DNI, email y teléfono opcional, y ningún campo de CUIL

#### Scenario: DNI de docente repetido
- **WHEN** se envía un DNI que ya está registrado
- **THEN** el sistema rechaza el alta e informa que el DNI está repetido

#### Scenario: Email de docente repetido
- **WHEN** se envía un email que ya está registrado
- **THEN** el sistema rechaza el alta e informa que el email está repetido

#### Scenario: Alta con email tomado en el otro padrón
- **WHEN** se envía un email que ya está registrado en el padrón de alumnos
- **THEN** el sistema rechaza el alta e informa que el email ya está en uso

#### Scenario: Docente creado y cuenta en la misma operación
- **WHEN** el alta de docente es exitosa
- **THEN** quedan creados el docente y su cuenta de acceso, y la cuenta accede a su panel

#### Scenario: Listado del padrón de docentes
- **WHEN** se consulta el padrón de docentes
- **THEN** cada fila trae los datos personales del docente y la cantidad de comisiones que tiene asignadas

### Requirement: Consulta de sedes

El sistema SHALL exponer la consulta de sedes con `GET /sedes`, de modo que el alta de
comisión pueda ofrecer la lista de sedes entre las que elegir. No hay historia de alta de
sede: es un endpoint de lectura, y la respuesta SHALL traer el identificador y el nombre de
cada sede (historia #8).

#### Scenario: Listado de sedes para el formulario
- **WHEN** se consulta el listado de sedes
- **THEN** la respuesta trae el identificador y el nombre de cada sede, y el formulario de alta de comisión puede ofrecerlas para elegir

### Requirement: Las pantallas de alta confirman contra la base

Las tres pantallas de alta de Administración —curso, comisión y docente— SHALL enviar lo
que el operador completa a la fuente de datos real y SHALL confirmar contra lo que la base
devuelve. Cada pantalla SHALL mostrar el resultado del alta, incluido el código generado
cuando corresponde. WHEN el alta es rechazada, la pantalla SHALL informar el motivo que
devuelve la fuente y **SHALL NOT** cerrar el formulario ni mostrar una confirmación.
WHEN una pantalla no puede alcanzar la base, SHALL informar que el alta no se guardó en
lugar de escribir en un almacén de memoria.

Las tres pantallas SHALL ofrecer la acción de alta. La pantalla de alta de docente hoy
muestra la acción sin formulario detrás, y SHALL dejar de hacerlo.

#### Scenario: El alta de curso muestra el código generado
- **WHEN** el operador completa el nombre de un curso y confirma
- **THEN** la pantalla muestra el código generado por la base y el curso aparece en el catálogo

#### Scenario: Alta rechazada
- **WHEN** la fuente de datos rechaza el alta e informa el dato duplicado
- **THEN** la pantalla muestra ese motivo, mantiene lo que el operador completó y no confirma el alta

#### Scenario: Alta que no llega a la base
- **WHEN** la fuente de datos no puede registrar el alta
- **THEN** la pantalla informa que el alta no se guardó y no muestra una confirmación

#### Scenario: El selector de curso ofrece cualquier curso del catálogo
- **WHEN** se abre el formulario de alta de comisión
- **THEN** el selector de curso se arma con el catálogo de cursos, de modo que un curso sin ninguna comisión todavía se puede elegir para abrirle la primera

#### Scenario: La pantalla de docente ofrece el formulario
- **WHEN** se abre la pantalla de docentes
- **THEN** la acción de alta abre un formulario que pide nombre, apellido, DNI, email y teléfono, sin campo de CUIL

#### Scenario: Aviso de que el maquetado no guarda nada
- **WHEN** se revisan las tres pantallas de alta
- **THEN** ninguna dice que el maquetado no guarda nada todavía