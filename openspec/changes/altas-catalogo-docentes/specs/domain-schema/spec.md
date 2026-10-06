# Spec Delta

## MODIFIED Requirements

### Requirement: Catálogo de cursos normalizado

El sistema SHALL almacenar un curso con un nombre y un código, y el nombre SHALL ser
único. El código **lo genera el sistema y no el operador**: `curso.codigo` SHALL ser una
columna generada y almacenada por la base, con la expresión
`'CUR' || lpad(id::text, greatest(3, length(id::text)), '0')`, de modo que el número del
código sea el identificador de la fila. El `greatest` SHALL ser parte de la expresión:
`lpad` trunca cuando el texto es más largo que el largo pedido, así que sin él el curso
con identificador 1000 recibiría el código `CUR100` y colisionaría con el 100. La
expresión SHALL conservar el cero a la izquierda hasta el identificador 999 y SHALL NOT
truncar a partir del 1000. El sistema SHALL NOT almacenar una segunda forma normalizada
del código: un valor generado no tiene dos representaciones que puedan diferir, así que
`curso.codigo_norm` SHALL NOT existir y su índice único SHALL NOT existir. La unicidad
del código SHALL sostenerse con un índice único sobre `curso.codigo`. La unicidad del
nombre SHALL evaluarse normalizando mayúsculas, acentos y espacios, de modo que `Curso
Python` y `curso  de  python` sean el mismo curso y el segundo alta SHALL ser rechazada
mostrando el curso existente. El nombre SHALL ser obligatorio y el código SHALL tener el
CHECK de no vacío aunque la expresión generada no pueda producir una cadena vacía, porque
ese CHECK forma parte del conjunto de obligatorios del esquema. La edición de un curso
SHALL preservar el historial de sus comisiones asociadas (historias #1 y #3).

#### Scenario: Alta de curso sin duplicados
- **WHEN** se da de alta un curso cuyo nombre no existe, informando solo el nombre y una descripción opcional
- **THEN** el curso se crea con el código generado por la base a partir de su identificador, queda disponible en el catálogo y el código se muestra al confirmar el alta

#### Scenario: Código o nombre duplicado por normalización
- **WHEN** se intenta guardar un curso cuyo nombre solo difiere del existente en mayúsculas, acentos o espacios
- **THEN** el sistema rechaza el alta e identifica el curso ya existente
- **AND** la mitad del nombre de este escenario que habla del código ya no aplica: el código dejó de ser un dato que se cargue, así que no puede duplicarse

#### Scenario: Código generado que no trunca
- **WHEN** se crean cursos cuyos identificadores son 999, 1000 y 1001
- **THEN** sus códigos son respectivamente `CUR999`, `CUR1000` y `CUR1001`, los tres distintos, y ninguno se confunde con `CUR100`

#### Scenario: No existe una forma normalizada del código
- **WHEN** se revisa la estructura de la tabla de cursos
- **THEN** no existe una columna normalizada del código ni su índice único, y el índice único del código está sobre el código generado

#### Scenario: Datos obligatorios faltantes
- **WHEN** se intenta guardar un curso sin nombre
- **THEN** el sistema no lo crea e indica que el nombre es obligatorio

#### Scenario: Edición sin pérdida de historial
- **WHEN** se modifica el nombre o la descripción de un curso que ya tiene comisiones
- **THEN** el cambio se guarda y las comisiones y su historial siguen asociados al curso

### Requirement: Comisiones con cupo, arancel, modalidad y sede

El sistema SHALL almacenar una comisión asociada a un curso, con docente, días y
horarios, `cupo_maximo`, arancel, modalidad, sede y estado. La comisión **SHALL NOT
almacenar su código**: `comision.codigo` SHALL NOT existir, y con él su índice único ni
su CHECK de obligatorio. En su lugar SHALL existir `numero`, un entero mayor que cero,
único dentro del curso, de modo que dos comisiones del mismo curso no puedan compartir
número. El número SHALL ser incremental por curso: SHALL ser el máximo de los números de
ese curso más uno. El código de la comisión SHALL ser un valor **derivado** con la forma
`{código del curso}-{número}`, por ejemplo `CUR001-1`, y SHALL estar disponible sin
persistirse como columna. `cupo_maximo` SHALL ser un entero mayor que cero, y el arancel
SHALL ser un valor numérico mayor que cero. La modalidad SHALL tomar un valor entre
Virtual, Presencial e Híbrido. WHEN la modalidad sea Presencial o Híbrido, `sede` SHALL
ser obligatoria; WHEN sea Virtual, la sede SHALL ser opcional. Las vacantes SHALL
derivarse de `cupo_maximo` menos la cantidad de inscripciones activas y SHALL NOT
almacenarse como un valor editable (historias #2, #5, #6, #7 y #8).

Las dos reglas que dependen de las inscripciones —no Inscribir en una comisión sin vacantes y no
reducir el cupo por debajo de los inscriptos— **quedan diferidas al change de inscripciones**.
Este change no incluye el alta de inscripciones, así que todavía no hay servicio ni endpoint que
las pueda rechazar. Se mantienen escritas porque el modelo las tiene que sostener cuando existan,
y la forma de derivar las vacantes por consulta —que es su base— ya está resuelta (D10).

#### Scenario: Alta de comisión completa
- **WHEN** se crea una comisión con curso, docente, días, horarios, cupo, arancel y modalidad
- **THEN** la comisión queda asociada al curso con un número propio y su código derivado se compone con el código del curso

#### Scenario: Número único dentro del curso
- **WHEN** se intenta crear dos comisiones del mismo curso con el mismo número
- **THEN** la base rechaza la segunda y la API informa el conflicto

#### Scenario: Número cero o negativo
- **WHEN** se intenta guardar una comisión con número cero o negativo
- **THEN** la base rechaza el valor

#### Scenario: No existe columna de código en la comisión
- **WHEN** se revisa la estructura de la tabla de comisiones
- **THEN** no hay columna de código persistida, ni índice único sobre ella, ni CHECK de obligatorio

#### Scenario: Modalidad que exige sede
- **WHEN** se selecciona modalidad Presencial o Híbrido y se intenta guardar sin indicar sede
- **THEN** el sistema rechaza el guardado con `422`. **El texto que llega de la API es el crudo de la restricción de la base y no un mensaje de interfaz**: el formulario de la pantalla impide el envío y muestra su propio mensaje en es-AR, y el mensaje de interfaz del backend para esta regla queda pendiente del change que escriba los mensajes de rechazo

#### Scenario: Modalidad virtual sin sede
- **WHEN** se selecciona modalidad Virtual y se guarda sin indicar sede
- **THEN** la comisión se registra con su modalidad y sin exigir sede

#### Scenario: Cupo inválido
- **WHEN** se intenta guardar un cupo cero, negativo o no numérico
- **THEN** el sistema rechaza el valor con `422`. El texto que llega de la API es el del validador y no está en es-AR; el mensaje «El cupo debe ser un entero positivo» lo muestra el formulario de la pantalla antes de enviar, y el del backend queda pendiente del change que escriba los mensajes de rechazo

#### Scenario: Arancel inválido
- **WHEN** se intenta guardar un arancel negativo o no numérico
- **THEN** el sistema rechaza el valor e informa el error

#### Scenario: Vacantes calculadas
- **WHEN** una comisión tiene cupo máximo 20 y 12 inscripciones activas
- **THEN** el sistema muestra 8 vacantes, derivadas y sin recalculado manual

#### Scenario: Comisión completa
- **WHEN** una comisión no tiene vacantes y se intenta una nueva inscripción
- **THEN** **Diferido a las inscripciones.** Hoy no hay servicio ni endpoint de inscripciones, así que la inscripción no se puede intentar y la regla no está verificada. La base de la regla ya está: las vacantes se derivan por consulta, así que una comisión sin vacantes es una comisión cuyo cupo iguala la cantidad de inscripciones activas

#### Scenario: Reducción de cupo por debajo de los inscriptos
- **WHEN** una comisión tiene 15 inscripciones activas y se intenta reducir su cupo máximo a un valor menor que 15
- **THEN** **Diferido a las inscripciones.** No existe endpoint que modifique `cupo_maximo`, así que el cambio no se puede intentar y la regla no está verificada. Cuando exista, la regla se sostiene con la misma derivación de vacantes por consulta, sin columna nueva

### Requirement: Padrón de docentes y alumnos

El sistema SHALL almacenar un docente con nombre, apellido, DNI, CUIL, email y teléfono, y
un alumno con nombre, DNI o pasaporte, email y teléfono. El CUIL del docente SHALL ser
**opcional**: el sistema SHALL admitir un docente sin CUIL y no SHALL rechazarlo por eso,
porque en esta fase los docentes no son personas reales y un CUIL inventado es peor que
ninguno. La columna SHALL conservarse y SHALL seguir siendo única cuando tiene valor,
por lo que un índice único sobre el CUIL SHALL permanecer. El sistema SHALL garantizar
que el DNI del docente sea único, que el DNI o pasaporte del alumno sea único y que el
email sea único dentro de cada padrón y además único frente al padrón del otro rol, de
modo que una misma dirección de correo no identifique a dos personas. WHEN se cargue un
email con formato inválido SHALL rechazarse el alta (historias #9 y #13).

El alta de un alumno SHALL admitir que el documento sea un pasaporte y que el alumno no
tenga DNI, porque el instituto inscribe alumnos del exterior. Los datos adicionales que
un alumno extranjero requiere no forman parte de este change: su definición se discute
con el cliente.

#### Scenario: Alta de docente con CUIL
- **WHEN** se da de alta un docente con nombre, apellido, DNI, CUIL, email y teléfono cuyos datos no están registrados
- **THEN** el docente se crea con acceso por su email y queda disponible para ser asignado a comisiones. **Este caso es a nivel de modelo**: el contrato del alta no admite `cuil`, así que por la API un docente con CUIL no se puede dar de alta. Lo que se verifica es que el dato se sostenga en el esquema y que el índice único sobre él siga en pie

#### Scenario: Docente sin CUIL
- **WHEN** se intenta guardar un docente sin informar CUIL
- **THEN** el sistema registra el docente y solo exige completar el CUIL cuando haya docentes reales

#### Scenario: Varios docentes sin CUIL conviven
- **WHEN** se registran dos docentes distintos sin CUIL
- **THEN** el sistema los acepta a los dos, porque un índice único admite múltiples valores ausentes

#### Scenario: CUIL repetido
- **WHEN** se intenta registrar un docente con un CUIL ya registrado
- **THEN** el sistema rechaza el alta e informa que el CUIL está repetido. Lo sostiene el índice único sobre `cuil` en la base. **Por la API el caso no se alcanza**, porque el alta no pide CUIL, así que queda verificado a nivel de esquema

#### Scenario: Alta de docente
- **WHEN** se completa nombre, apellido, DNI, email y teléfono de un docente cuyos datos no están registrados
- **THEN** el docente se crea con acceso por su email

#### Scenario: DNI o email de docente duplicado
- **WHEN** se intenta registrar un docente con un DNI o un email ya registrados
- **THEN** el sistema rechaza el alta e informa el dato duplicado

#### Scenario: Alta de alumno
- **WHEN** se completa DNI o pasaporte, nombre, email y teléfono de un alumno cuyos datos no están registrados
- **THEN** el alumno se crea en el padrón

#### Scenario: Documento de alumno duplicado
- **WHEN** se intenta registrar un alumno con un DNI o pasaporte ya registrado
- **THEN** el sistema rechaza el alta y muestra el alumno existente

#### Scenario: Alumno del exterior sin DNI
- **WHEN** se da de alta un alumno con pasaporte y sin DNI, y con un email no registrado
- **THEN** el sistema crea el alumno en el padrón y lo admite como identificador del legajo

#### Scenario: Email con formato inválido
- **WHEN** se intenta guardar un docente con un email de formato incorrecto
- **THEN** el sistema rechaza el alta e indica el error de formato. **La mitad del alumno no aplica**: el alta de alumno no forma parte de este change y `alumno.email` es una columna sin validador de formato, así que esa validación queda para el change del alta de alumno