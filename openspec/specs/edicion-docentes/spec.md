# edicion-docentes Specification

## Purpose
Definir la edición administrativa de los datos personales de un docente y el restablecimiento de su
contraseña, conservando sus comisiones y sincronizando su cuenta de acceso.

## Requirements

### Requirement: Edición de los datos del docente

El sistema SHALL exponer `PUT /docentes/{id}` solo para Administración. La edición SHALL aceptar
nombre, apellido, DNI, email, teléfono opcional y `cuil` opcional, con las mismas validaciones del
alta. El CUIL SHALL tener 11 dígitos después de quitar guiones, SHALL usar el prefijo `20`, `23`,
`24` o `27` y SHALL tener los 8 dígitos del medio iguales al DNI del docente, completado con ceros a
la izquierda cuando el DNI tenga 7 dígitos. La API SHALL NOT calcular ni validar el dígito
verificador. En `PUT`, omitir `cuil` SHALL conservar el CUIL actual, un `null` explícito SHALL
borrarlo y un CUIL parcial o con estructura inválida SHALL responder `422`.

El sistema SHALL conservar el `id` del docente y SHALL NOT modificar sus comisiones asignadas ni su
historial. SHALL sincronizar `nombre` y `email` del `Usuario` vinculado en la misma transacción, de modo
que el docente pueda iniciar sesión con el email nuevo.

WHEN el DNI ya pertenezca a otro docente, el sistema SHALL rechazar la edición con `409` e informar que
el DNI está repetido. WHEN el email ya pertenezca a otro docente, a un alumno o a otra cuenta, SHALL
rechazar la edición con `409` e informar el padrón en el que ya está registrado. La comparación SHALL
excluir al propio docente y a su propia cuenta. WHEN el `id` no corresponda a ningún docente, SHALL
responder `404`; WHEN falte un campo obligatorio o el email no tenga forma, SHALL responder `422`.

#### Scenario: Edición exitosa

- **WHEN** se modifican el nombre, apellido, DNI, email, teléfono o CUIL de un docente con valores válidos y no duplicados
- **THEN** los cambios quedan persistidos, el docente conserva sus comisiones asignadas y la respuesta trae la fila actualizada

#### Scenario: La cuenta de acceso queda sincronizada

- **WHEN** se edita el nombre o el email de un docente con cuenta de acceso
- **THEN** el `Usuario` vinculado queda con el nuevo nombre y email, y el docente puede iniciar sesión con el email nuevo

#### Scenario: DNI duplicado

- **WHEN** el nuevo DNI pertenece a otro docente
- **THEN** el sistema rechaza la edición con `409` e informa que el DNI está repetido

#### Scenario: Email duplicado en el padrón de docentes

- **WHEN** el nuevo email pertenece a otro docente
- **THEN** el sistema rechaza la edición con `409` e informa el conflicto

#### Scenario: Email tomado en otro padrón

- **WHEN** el nuevo email pertenece a un alumno o a otra cuenta de usuario
- **THEN** el sistema rechaza la edición con `409` e informa en qué padrón ya está registrado

#### Scenario: Guardar los mismos datos

- **WHEN** se guarda un docente sin cambiar su DNI ni su email
- **THEN** el sistema acepta la edición, porque la comparación excluye al propio docente y a su cuenta

#### Scenario: Edición con CUIL válido

- **WHEN** se envía un `PUT /docentes/{id}` con un CUIL completo, con prefijo permitido y con los 8 dígitos del medio iguales al DNI
- **THEN** el sistema guarda el CUIL en 11 dígitos y la respuesta lo devuelve en ese formato

#### Scenario: Edición sin CUIL conserva el actual

- **WHEN** se envía un `PUT /docentes/{id}` sin el campo `cuil`
- **THEN** el sistema conserva el CUIL que el docente ya tenía

#### Scenario: Edición con CUIL en null lo borra

- **WHEN** se envía un `PUT /docentes/{id}` con `cuil` en `null`
- **THEN** el sistema borra el CUIL del docente y la respuesta lo devuelve en `null`

#### Scenario: CUIL fuera del contrato

- **WHEN** se envía un `PUT /docentes/{id}` con un CUIL parcial, con un prefijo no permitido o con 8 dígitos del medio que no coinciden con el DNI
- **THEN** el sistema rechaza la edición con `422` y el CUIL anterior no cambia. El nombre del escenario es histórico: desde este change el CUIL forma parte del contrato

#### Scenario: Docente inexistente

- **WHEN** se edita un `id` que no corresponde a ningún docente
- **THEN** el sistema responde `404`

#### Scenario: Solo Administración

- **WHEN** un Docente o un Alumno intenta editar un docente
- **THEN** el sistema responde `403`; sin token responde `401`

### Requirement: Restablecimiento administrativo de la contraseña del docente

El sistema SHALL exponer `POST /docentes/{id}/password` solo para Administración. El cuerpo SHALL
aceptar `new_password` de al menos 8 caracteres y como máximo el límite de bcrypt. El sistema SHALL
guardar únicamente el hash bcrypt, SHALL invalidar la contraseña anterior y SHALL dejar
`must_change_password = true` en la cuenta, de modo que el docente la cambie en ese mismo ingreso.
SHALL NOT enviar correo ni devolver la contraseña en claro.

WHEN el docente no tenga cuenta de acceso, SHALL responder `409` con un mensaje claro y SHALL NOT
crear una cuenta implícitamente. WHEN la contraseña no cumpla la regla, SHALL responder `422` sin
modificar la anterior. WHEN el `id` no corresponda a ningún docente, SHALL responder `404`.

#### Scenario: Restablecimiento exitoso

- **WHEN** el administrador define una nueva contraseña válida para un docente
- **THEN** la contraseña anterior deja de ser válida, la nueva permite iniciar sesión y la cuenta queda con cambio obligatorio

#### Scenario: El docente cambia la contraseña en su próximo ingreso

- **WHEN** el docente inicia sesión con la contraseña definida por Administración
- **THEN** el sistema lo lleva al cambio de contraseña y no le permite usar el resto del shell hasta cambiarla

#### Scenario: Contraseña demasiado corta

- **WHEN** la nueva contraseña tiene menos de 8 caracteres
- **THEN** el sistema responde `422` y no modifica la contraseña

#### Scenario: Docente sin cuenta de acceso

- **WHEN** se restablece la contraseña de un docente que no tiene `Usuario` vinculado
- **THEN** el sistema responde `409` con un mensaje claro y no crea una cuenta implícitamente

#### Scenario: Docente inexistente

- **WHEN** se restablece la contraseña de un `id` que no corresponde a ningún docente
- **THEN** el sistema responde `404`

#### Scenario: Solo Administración

- **WHEN** un Docente o un Alumno intenta restablecer la contraseña de un docente
- **THEN** el sistema responde `403`; sin token responde `401`
