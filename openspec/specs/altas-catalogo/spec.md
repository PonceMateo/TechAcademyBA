# altas-catalogo Specification

## Purpose
Definir el comportamiento de los cuatro endpoints de consulta y alta del catálogo y de
docentes, y de las tres pantallas de alta de Administración que los consumen. Es una
capability nueva porque `domain-schema` declara explícitamente que no define endpoints
CRUD de dominio: la estructura de datos y su migración inicial viven allá, y el
comportamiento observable de las altas vive acá.

## Requirements

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
- **WHEN** se envía un nombre que solo difiere del existente en mayúsculas, acentos o espacios, por ejemplo "Curso Python" y "curso   python"
- **THEN** el sistema rechaza el alta, informa que el nombre está repetido e identifica el curso existente

#### Scenario: Palabras distintas no son el mismo curso
- **WHEN** se envían "Curso Python" y "Curso de Python", que difieren en una palabra
- **THEN** el sistema los acepta como dos cursos distintos, porque la normalización colapsa formato y no palabras

#### Scenario: Curso sin nombre
- **WHEN** se envía un alta de curso sin nombre o con el nombre vacío
- **THEN** el sistema no crea el curso e indica que el nombre es obligatorio

#### Scenario: Listado del catálogo
- **WHEN** se consulta el catálogo de cursos
- **THEN** la respuesta trae cada curso con su código generado y su nombre

### Requirement: Consulta y alta de comisiones

El sistema SHALL exponer la consulta de comisiones y su alta. La consulta
`GET /comisiones` SHALL devolver las comisiones con su código derivado, su curso, su
docente, sus horarios de cursada, su texto de días y horarios, su cupo máximo, su arancel
y su modalidad, además de su período de cursada —fecha de inicio y fecha de fin— y la
cantidad de clases derivada de él. El alta `POST /comisiones` SHALL aceptar el curso, el
docente, los horarios de cursada, el arancel, el cupo máximo, la modalidad, la sede
opcional y el período de cursada.

Los horarios SHALL venir como una lista no vacía de rangos, y cada rango SHALL traer el
día de la semana (`LUN` a `DOM`), la hora de inicio y la hora de fin en formato `HH:MM`.
Un mismo día SHALL aparecer a lo sumo una vez. El alta **SHALL NOT aceptar
`dias_horarios` como texto libre**: un cuerpo que lo traiga SHALL responder `422`. El
texto `dias_horarios` de la respuesta SHALL ser el resumen que el sistema deriva de los
horarios guardados, y la respuesta SHALL traer además los horarios estructurados.

El período de cursada SHALL ser **obligatorio** en el alta y sus dos fechas SHALL viajar
como fecha sin hora en formato `YYYY-MM-DD`; el sistema SHALL NOT completarlas con una
fecha por defecto ni con un valor de ejemplo. La fecha de fin SHALL ser igual o posterior
a la de inicio: una comisión de un solo día es válida. WHEN la fecha de fin sea anterior a
la de inicio, el sistema SHALL rechazar el alta con `422` y el mensaje «La fecha de fin no
puede ser anterior a la de inicio.», que el formulario muestra en el campo de la fecha de
fin porque valida antes de enviar. El período SHALL contener al menos una clase según los
días de cursada de la comisión; WHEN no la contenga, el sistema SHALL rechazar el alta con
`422` y el mensaje «El período no contiene ninguna clase: revisá las fechas o los días de
cursada.».

La cantidad total de clases SHALL derivarse contando los días comprendidos entre la fecha
de inicio y la de fin, **ambas incluidas**, que caigan en alguno de los días de cursada de
la comisión. SHALL NOT persistirse como columna y SHALL acompañar a la comisión en las
respuestas del alta y de la consulta, junto con las dos fechas del período. WHEN la
comisión se haya creado antes de que el período existiera y no tenga fechas cargadas, la
consulta SHALL informar el período como no definido y la cantidad de clases como no
definida, sin inventar valores.

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
horarios, el arancel o alguna de las dos fechas del período, el sistema SHALL rechazar el
alta e indicar los campos faltantes. WHEN el cupo máximo sea cero, negativo o no numérico,
el sistema SHALL rechazarlo e informar que el cupo debe ser un entero positivo. WHEN el
arancel sea negativo o no numérico, el sistema SHALL rechazarlo e informar el error.
`sede_id` SHALL ser **opcional en toda modalidad**; WHEN la modalidad sea Virtual y la
comisión informe una sede, el sistema SHALL rechazar el alta con `422`. El número de la
comisión SHALL ser el máximo de los números de ese curso más uno, y la respuesta SHALL
devolver el código derivado con la forma del código del curso más el número. WHEN la
numeración ya ocupada por otra comisión del mismo curso colisione, la API SHALL informar
el conflicto (historias #2, #5 y #8).

#### Scenario: Alta de comisión correcta
- **WHEN** se envía una comisión con curso, docente, horarios de cursada, período de cursada, cupo máximo, arancel y modalidad
- **THEN** el sistema responde con la comisión creada, su código derivado, sus horarios y la cantidad de clases calculada, y la comisión queda asociada al curso

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
- **WHEN** se envía una comisión sin cupo máximo, sin horarios, sin arancel o sin alguna de las dos fechas del período
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

#### Scenario: Fecha de fin anterior a la de inicio
- **WHEN** se envía una comisión con una fecha de fin anterior a la de inicio
- **THEN** el sistema responde `422` con el mensaje «La fecha de fin no puede ser anterior a la de inicio.» y no crea la comisión

#### Scenario: Período sin ninguna clase
- **WHEN** se envía una comisión cuyas fechas de inicio y de fin no contienen ninguno de sus días de cursada
- **THEN** el sistema responde `422` con el mensaje «El período no contiene ninguna clase: revisá las fechas o los días de cursada.» y no crea la comisión

#### Scenario: Los dos extremos del período cuentan
- **WHEN** la fecha de inicio o la fecha de fin de la comisión caen en un día de cursada
- **THEN** esa clase se cuenta dentro del total, porque el rango se cuenta con sus dos extremos incluidos

#### Scenario: Comisión heredada sin período
- **WHEN** se consulta una comisión creada antes de que el período existiera, que no tiene fechas cargadas
- **THEN** la respuesta informa el período y la cantidad de clases como no definidos, sin completarlos con valores de ejemplo

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
- **THEN** cada fila trae el código derivado, el nombre del curso, el docente, los horarios y su texto derivado, el período de cursada con su cantidad de clases, el cupo máximo y el arancel

### Requirement: Consulta y alta de docentes

`GET /docentes` SHALL devolver el padrón y `POST /docentes` SHALL aceptar nombre, apellido, DNI,
email, teléfono y `cuil` opcionales con las validaciones vigentes, creando en una transacción
el docente y su cuenta. Esta SHALL nacer con una contraseña inicial generada, guardada solo como
hash, y cambio obligatorio. La respuesta del alta SHALL incluir `password_inicial`; ningún otro
endpoint SHALL exponerla. WHEN el DNI o el email ya existan, SHALL rechazar el alta e informar cuál
se repitió.

#### Scenario: Alta de docente correcta

- **WHEN** se envían nombre, apellido, DNI, email y teléfono de un docente no registrado
- **THEN** el sistema responde con el docente creado y su acceso por ese email, y el docente queda disponible para asignar a una comisión

#### Scenario: El contrato de alta de docente no lleva CUIL

- **WHEN** se inspecciona lo que el alta de docente admite
- **THEN** el contrato ya no excluye el CUIL: admite nombre, apellido, DNI, email, teléfono opcional y `cuil` opcional, y sin `cuil` el docente se guarda con ese dato en `null`. El nombre del escenario es histórico

#### Scenario: Alta de docente con CUIL válido

- **WHEN** se envía un alta con un CUIL de 11 dígitos, con o sin guiones, cuyo prefijo es válido y cuyos 8 dígitos del medio coinciden con el DNI
- **THEN** el sistema crea el docente, guarda el CUIL en 11 dígitos y lo devuelve en ese formato

#### Scenario: Alta de docente con CUIL inválido

- **WHEN** se envía un alta con un CUIL parcial, con un prefijo no permitido o con 8 dígitos del medio que no coinciden con el DNI
- **THEN** el sistema rechaza el alta con `422` y no crea el docente

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
- **THEN** quedan creados el docente y su cuenta de acceso, y la cuenta accede a su panel después de cambiar la contraseña inicial

#### Scenario: Listado del padrón de docentes

- **WHEN** se consulta el padrón de docentes
- **THEN** cada fila trae los datos personales del docente y la cantidad de comisiones que tiene asignadas, sin contraseña ni hash

#### Scenario: Contraseña inicial del alta de docente

- **WHEN** se da de alta a `María González` con DNI `30.111.222`
- **THEN** la respuesta incluye `password_inicial` con `maria30111222`, la base guarda solo el hash bcrypt y la cuenta nace con `must_change_password` en `true`

#### Scenario: La contraseña inicial se entrega una sola vez

- **WHEN** se consulta el listado, se edita el docente o se restablece su contraseña
- **THEN** ninguna de esas respuestas incluye `password_inicial`, la contraseña en claro ni el hash

#### Scenario: Los docentes anteriores conservan su credencial

- **WHEN** el alta de la HU 66 convive con docentes creados antes de la entrega
- **THEN** esas cuentas conservan su contraseña y su `must_change_password`, y no se regeneran ni se actualizan de forma masiva

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
- **THEN** la pantalla **falla y no muestra ninguna confirmación**. Lo que muestra es el motivo de la falla —«No pudimos conectar con el servidor.» o «La API respondió 500 a POST /cursos.»—, que no llega a decir literalmente que el alta no se guardó. Lo que importa para la secretaría, que es que no aparezca una confirmación falsa, sí está garantizado: el alta nunca cae al ejemplo

#### Scenario: El selector de curso ofrece cualquier curso del catálogo
- **WHEN** se abre el formulario de alta de comisión
- **THEN** el selector de curso se arma con el catálogo de cursos, de modo que un curso sin ninguna comisión todavía se puede elegir para abrirle la primera

#### Scenario: La pantalla de docente ofrece el formulario
- **WHEN** se abre la pantalla de docentes
- **THEN** la acción de alta abre un formulario que pide nombre, apellido, DNI, email, teléfono y un CUIL opcional, con el control de teléfono y los tres controles del CUIL

#### Scenario: Aviso de que el maquetado no guarda nada
- **WHEN** se revisan las tres pantallas de alta
- **THEN** ninguna dice que el maquetado no guarda nada todavía
