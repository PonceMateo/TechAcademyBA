# Spec Delta

## ADDED Requirements

### Requirement: Consulta del perfil propio del docente

El sistema SHALL exponer `GET /docente/mi-perfil`, accesible solo con rol `DOCENTE`, que devuelva
el nombre, apellido, DNI, CUIL, email y teléfono del docente autenticado y sus comisiones asignadas.
La ruta SHALL NOT recibir un identificador de docente: el registro sale de la cuenta autenticada.
WHEN falta el token SHALL devolver `401` y WHEN el rol no es `DOCENTE` SHALL devolver `403`.

#### Scenario: El docente consulta su perfil
- **WHEN** un docente autenticado solicita `GET /docente/mi-perfil`
- **THEN** recibe `200` con sus datos personales y la lista de comisiones asignadas

#### Scenario: Otro rol consulta el perfil docente
- **WHEN** un usuario con rol `ADMIN` o `ALUMNO` solicita `GET /docente/mi-perfil`
- **THEN** el sistema responde `403` y no devuelve ningún dato del docente

#### Scenario: Sin autenticar
- **WHEN** la solicitud llega sin un token válido
- **THEN** el sistema responde `401` sin revelar datos del perfil

### Requirement: Edición de los datos de contacto del docente

El sistema SHALL permitir que el docente autenticado actualice **solo su email y su teléfono** con
`PUT /docente/mi-perfil`. El cuerpo SHALL rechazar con `422` cualquier otro campo, incluidos nombre,
apellido, DNI y CUIL. El email SHALL validarse con la regla compartida y conservarse sin cambios si
es el propio. La unicidad SHALL verificarse entre los tres padrones (M1) y un email ya registrado
SHALL responder `409` sin modificar nada.

#### Scenario: El docente guarda un email y un teléfono válidos
- **WHEN** el docente envía un email con formato correcto que no pertenece a otra persona y un teléfono E.164
- **THEN** el sistema responde `200` con los datos guardados y persiste ambos en PostgreSQL

#### Scenario: El docente conserva su email actual
- **WHEN** el docente envía el mismo email que ya tiene
- **THEN** el sistema lo acepta y no lo considera duplicado

#### Scenario: El email pertenece a otro padrón
- **WHEN** el docente envía un email que ya tiene otro docente, un alumno o una cuenta
- **THEN** el sistema responde `409` con un mensaje que nombra el conflicto y no modifica el perfil

#### Scenario: El docente intenta editar un dato de identidad
- **WHEN** el cuerpo incluye `nombre`, `apellido`, `dni` o `cuil`
- **THEN** el sistema responde `422` y no modifica ninguno de esos datos

#### Scenario: Formato inválido
- **WHEN** el email o el teléfono no cumplen la validación compartida
- **THEN** el sistema responde `422` y conserva los valores anteriores

#### Scenario: El docente no puede editar a otro docente
- **WHEN** un docente autenticado intenta modificar el perfil de otra persona
- **THEN** no existe ruta ni parámetro que reciba un identificador y la operación solo alcanza su propia cuenta

### Requirement: Sincronización del email con la cuenta de acceso

El sistema SHALL actualizar el email del padrón docente y el de su `Usuario` en la misma
transacción. Después del cambio, `POST /auth/login` SHALL autenticar con el email nuevo y SHALL
rechazar el anterior, salvo que otra cuenta legítima lo tenga.

#### Scenario: Login con el email nuevo
- **WHEN** el docente cambia su email y vuelve a iniciar sesión con el nuevo
- **THEN** el sistema lo autentica con `200` y `GET /auth/me` devuelve el email nuevo

#### Scenario: Login con el email anterior
- **WHEN** el docente intenta iniciar sesión con el email que dejó de usar
- **THEN** el sistema responde `401` con el mensaje genérico de credenciales inválidas
