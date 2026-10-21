# Spec Delta

## Purpose

Consulta y alta de empresas contra la API (historia #18). La estructura `empresa` y sus
restricciones viven en `domain-schema`; acá solo comportamiento observable de los endpoints.

## ADDED Requirements

### Requirement: Consulta de empresas

El sistema SHALL exponer la consulta de empresas con rol `ADMIN`. `GET /empresas` SHALL
devolver cada empresa con su razón social, su CUIT tal como se registró, su indicador de
necesidad de Factura A y su estado. WHEN se pide la consulta sin token el sistema SHALL
responder 401, y con un rol que no es ADMIN, 403.

#### Scenario: La empresa dada de alta queda en la consulta
- **WHEN** se envía el alta de una empresa y después se consulta `GET /empresas`
- **THEN** la respuesta incluye la empresa creada con su razón social, su CUIT, su indicador de Factura A y su estado

#### Scenario: Consulta restringida
- **WHEN** se pide `GET /empresas` sin token o con un rol que no es ADMIN
- **THEN** el sistema responde 401 sin token y 403 con otro rol

### Requirement: Alta de empresa

El sistema SHALL exponer el alta de empresas con rol `ADMIN`. `POST /empresas` SHALL aceptar
únicamente razón social, CUIT e indicador de Factura A, y un campo con otro nombre SHALL ser
un 422. WHEN la razón social falta o viene vacía, el sistema SHALL rechazar el alta. WHEN el
alta es exitosa, el sistema SHALL responder 201 con la empresa creada (historia #18).

#### Scenario: Alta de empresa correcta
- **WHEN** se envía una razón social, un CUIT válido y el indicador de Factura A
- **THEN** el sistema responde 201 con la empresa creada

#### Scenario: Razón social obligatoria
- **WHEN** se envía el alta sin razón social o con la razón social vacía
- **THEN** el sistema responde 422 sin crear la empresa

#### Scenario: Contrato de alto a lo suyo
- **WHEN** el alta informa un campo que no es razón social, CUIT ni Factura A
- **THEN** el sistema responde 422

#### Scenario: Solo Administración da de alta
- **WHEN** se envía `POST /empresas` sin token o con un rol que no es ADMIN
- **THEN** el sistema responde 401 sin token y 403 con otro rol

### Requirement: Rechazo del CUIT inválido o duplicado

WHEN el CUIT no tiene once dígitos o su dígito verificador es incorrecto, el sistema SHALL
rechazar el alta con 422 sin crear la empresa. WHEN el CUIT normalizado coincide con el de
una empresa existente —incluido el caso de un CUIT escrito con guiones contra el mismo sin
guiones (D6)—, el sistema SHALL responder 409 e identificar la empresa existente por razón
social y CUIT.

#### Scenario: CUIT con dígito verificador inválido
- **WHEN** se envía un CUIT con once dígitos cuyo dígito verificador es erróneo
- **THEN** el sistema responde 422 sin crear la empresa

#### Scenario: CUIT con formato incorrecto
- **WHEN** se envía un CUIT con letras o con menos de once dígitos
- **THEN** el sistema responde 422 sin crear la empresa

#### Scenario: CUIT duplicado
- **WHEN** se envía un CUIT ya registrado, escrito con guiones o sin ellos
- **THEN** el sistema responde 409 e identifica la empresa existente por razón social y CUIT
