# Spec Delta

## MODIFIED Requirements

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
