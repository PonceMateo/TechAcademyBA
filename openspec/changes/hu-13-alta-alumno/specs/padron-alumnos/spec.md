# Spec Delta

## Purpose

Definir el alta y la consulta básica del padrón de alumnos, con sus validaciones, la unicidad
de documento y email, y la creación transaccional de la cuenta de acceso.

## ADDED Requirements

### Requirement: Alta de alumno con DNI

El sistema SHALL exponer `POST /alumnos` para Administración. El alta SHALL aceptar DNI,
nombre, email y teléfono opcional; el DNI y el nombre SHALL ser obligatorios. El DNI SHALL
tener 7 u 8 dígitos después de quitar puntos, espacios y guiones. El sistema SHALL almacenar
`tipo_documento = DNI` y SHALL NOT aceptar pasaporte ni un campo `tipo_documento` en el
contrato de esta entrega. WHEN el alta es exitosa, SHALL responder `201` con el alumno creado.

#### Scenario: Alta de alumno correcta
- **WHEN** se envían un DNI de 7 u 8 dígitos, un nombre, un email y un teléfono de un alumno cuyos datos no están registrados
- **THEN** el sistema responde `201` con el alumno creado, su `tipo_documento` en `DNI`, su `password_inicial` y el alumno queda disponible en la consulta del padrón

#### Scenario: DNI escrito con puntos, espacios o guiones
- **WHEN** se informa un DNI como `38.456.789`, `38 456 789` o `38-456-789`
- **THEN** el sistema lo acepta, guarda `documento_norm = 38456789` y conserva el formato informado en `documento`

#### Scenario: DNI con formato inválido
- **WHEN** se informa un DNI con letras, con menos de 7 dígitos o con más de 8 dígitos
- **THEN** el sistema rechaza el alta con `422` e indica que el DNI debe tener 7 u 8 dígitos

#### Scenario: Nombre faltante
- **WHEN** se envía un alta sin nombre o con el nombre vacío
- **THEN** el sistema rechaza el alta con `422` e indica que el nombre es obligatorio

#### Scenario: Teléfono opcional
- **WHEN** se envía un alta con DNI, nombre y email, sin teléfono
- **THEN** el sistema crea el alumno con el teléfono en `null`

#### Scenario: El contrato no acepta pasaporte ni tipo de documento
- **WHEN** se envía un alta con `tipo_documento` o con un documento de pasaporte
- **THEN** el sistema rechaza el alta con `422`, porque el contrato de esta entrega admite solo DNI y no incluye el campo `tipo_documento`

### Requirement: Validación del email del alumno

El email SHALL ser obligatorio y SHALL tener un formato válido: algo antes de la arroba, una
arroba y un dominio con al menos un punto que no termine en punto. WHEN el formato sea
inválido, el alta SHALL rechazarse con `422` e indicar el error de formato. La regla SHALL ser
la misma que aplica el alta de docente, para que un correo no se acepte en un padrón y se
rechace en el otro.

#### Scenario: Email con formato válido
- **WHEN** se envía un email como `juan.perez@example.com`
- **THEN** el sistema acepta el alta y guarda el email tal como se informó

#### Scenario: Email con formato inválido
- **WHEN** se envía un email como `juan@`, `juan.perez`, `@example.com` o `juan@example.`
- **THEN** el sistema rechaza el alta con `422` e indica que el email no tiene un formato válido

#### Scenario: Email faltante
- **WHEN** se envía un alta sin email o con el email vacío
- **THEN** el sistema rechaza el alta con `422` e indica que el email es obligatorio

### Requirement: Unicidad de documento y email

El documento normalizado y el email SHALL ser únicos. WHEN el documento o el email ya
pertenezcan a otro alumno, el alta SHALL rechazarse con `409` y el mensaje SHALL nombrar el
campo repetido. WHEN el email ya esté registrado en el padrón de docentes o en una cuenta de
usuario, el alta SHALL rechazarse con `409`. El mensaje SHALL NOT incluir los datos del alumno
existente; esta desviación del criterio «muestra el alumno existente» queda pendiente de
aprobación del equipo.

#### Scenario: Documento de alumno duplicado
- **WHEN** se intenta registrar un alumno con `38.456.789` y ya existe otro alumno con `38456789`
- **THEN** el sistema rechaza el alta con `409` e informa que el documento está repetido

#### Scenario: Email de alumno duplicado
- **WHEN** se intenta registrar un alumno con un email que ya pertenece a otro alumno
- **THEN** el sistema rechaza el alta con `409` e informa que el email está repetido

#### Scenario: Email tomado en otro padrón
- **WHEN** se intenta registrar un alumno con un email que ya pertenece a un docente o a una cuenta de usuario
- **THEN** el sistema rechaza el alta con `409` e informa que el email ya está registrado en el padrón correspondiente

#### Scenario: Documento y email repetidos a la vez
- **WHEN** se intenta registrar un alumno cuyo documento y cuyo email ya pertenecen a alumnos existentes
- **THEN** el sistema rechaza el alta con `409` e informa primero el documento repetido

#### Scenario: El rechazo no muestra los datos del alumno existente
- **WHEN** el alta se rechaza por un documento o un email repetido
- **THEN** la respuesta contiene solo el motivo y el campo repetido, sin el nombre, el documento ni el email del alumno existente. Esta es una desviación consciente del criterio de la historia #13 y queda pendiente de aprobación

### Requirement: Creación transaccional de la cuenta de acceso con contraseña inicial

El alta SHALL crear en una sola transacción el `Alumno` y un `Usuario` con rol `ALUMNO`, su
email y el vínculo `alumno_id`. SHALL generar una contraseña inicial `<primer nombre><DNI>` y
guardarla solo como hash bcrypt; SHALL devolverla en claro únicamente en `POST /alumnos` como
`password_inicial`, y `GET /alumnos` SHALL NOT exponerla. La cuenta SHALL quedar activa y con
`must_change_password` en `true`. El alta SHALL NOT enviar correo. Si falla una fila, no SHALL
quedar ninguna.

#### Scenario: Alumno y cuenta en la misma operación
- **WHEN** el alta de un alumno es exitosa
- **THEN** quedan creados el alumno y su cuenta de acceso con rol `ALUMNO`, y la cuenta puede iniciar sesión con la contraseña inicial que devolvió el alta

#### Scenario: La contraseña inicial sigue la convención del proyecto
- **WHEN** se da de alta a `Juan Ignacio Pérez` con DNI `38.456.789`
- **THEN** la respuesta trae `password_inicial = juan38456789` y la cuenta inicia sesión con esa contraseña

#### Scenario: La contraseña inicial se muestra una sola vez
- **WHEN** se consulta `GET /alumnos` después del alta
- **THEN** ninguna fila incluye `password_inicial`; el dato solo estuvo en la respuesta del alta para que el administrador lo entregue

#### Scenario: La cuenta queda con cambio de contraseña pendiente
- **WHEN** se consulta la cuenta creada por el alta
- **THEN** `must_change_password` es `true`, porque la contraseña inicial la conoce el administrador y el alumno debe elegir una propia en su primer ingreso

#### Scenario: La contraseña se guarda como hash
- **WHEN** se inspecciona la cuenta creada
- **THEN** la base guarda un hash bcrypt y no la contraseña inicial en texto plano

#### Scenario: El alta no envía credenciales
- **WHEN** el alta de un alumno es exitosa
- **THEN** el sistema no envía ningún correo y la pantalla muestra al administrador el usuario y la contraseña inicial para que se los entregue

#### Scenario: Falla la creación de la cuenta
- **WHEN** el alta del alumno no puede crear la cuenta de acceso
- **THEN** la transacción se revierte y no queda creado el alumno

### Requirement: Consulta básica del padrón de alumnos

El sistema SHALL exponer `GET /alumnos` para Administración. La consulta SHALL devolver los
alumnos con `id`, `nombre`, `documento`, `tipo_documento`, `email`, `telefono` y `activo`, y
SHALL incluir `comision`, `categoria`, `porcentaje_beca` y `acceso` en `null` mientras el
alumno no tenga una inscripción. La respuesta SHALL NOT inventar comisión, categoría ni
habilitación. La búsqueda por DNI o email queda para la historia #16.

#### Scenario: El alta aparece en el padrón
- **WHEN** se consulta el padrón después de un alta exitosa
- **THEN** el alumno creado aparece en la respuesta con sus datos personales

#### Scenario: Alumno sin inscripción
- **WHEN** se consulta un alumno que todavía no tiene inscripción
- **THEN** `comision`, `categoria`, `porcentaje_beca` y `acceso` vienen en `null`, y la pantalla los muestra como «Sin comisión» y «—»

#### Scenario: El padrón vacío
- **WHEN** se consulta el padrón y no hay alumnos
- **THEN** la respuesta es una lista vacía y la pantalla muestra su estado vacío, sin filas inventadas

#### Scenario: Solo Administración consulta el padrón
- **WHEN** un usuario con rol Docente o Alumno intenta consultar `GET /alumnos`
- **THEN** el sistema responde `403`; sin token responde `401`
