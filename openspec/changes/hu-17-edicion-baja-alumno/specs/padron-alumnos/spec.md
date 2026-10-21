# Spec Delta

## ADDED Requirements

### Requirement: Edición de los datos del alumno

El sistema SHALL exponer `PUT /alumnos/{id}` solo para Administración. La edición SHALL aceptar
documento, nombre, email y teléfono, con las mismas validaciones del alta: DNI de 7 u 8 dígitos
con puntos, espacios o guiones, nombre y email obligatorios, email con forma válida y teléfono
opcional. El sistema SHALL conservar el `id` del alumno y SHALL NOT modificar sus inscripciones,
pagos ni relaciones. SHALL sincronizar `nombre` y `email` del `Usuario` vinculado en la misma
transacción.

#### Scenario: Edición exitosa
- **WHEN** se modifican DNI, nombre, email o teléfono de un alumno y se guarda
- **THEN** los cambios quedan persistidos y las inscripciones y pagos siguen asociados al mismo `id` y legajo

#### Scenario: La cuenta de acceso queda sincronizada
- **WHEN** se edita el nombre o el email de un alumno con cuenta de acceso
- **THEN** el `Usuario` vinculado queda con el nuevo nombre y email, y el alumno puede iniciar sesión con el email nuevo

#### Scenario: DNI duplicado
- **WHEN** el nuevo DNI pertenece a otro alumno
- **THEN** el sistema rechaza la edición con `409` e informa que el documento está repetido

#### Scenario: Email duplicado
- **WHEN** el nuevo email pertenece a otro alumno, docente o cuenta de usuario
- **THEN** el sistema rechaza la edición con `409` e informa el conflicto

#### Scenario: Datos inválidos
- **WHEN** se envía un DNI con menos de 7 o más de 8 dígitos, un nombre vacío o un email sin forma
- **THEN** el sistema rechaza la edición con `422` e indica qué campo corregir

#### Scenario: Alumno inexistente
- **WHEN** se edita un `id` que no corresponde a ningún alumno
- **THEN** el sistema responde `404`

### Requirement: Restablecimiento administrativo de contraseña

El sistema SHALL exponer `POST /alumnos/{id}/password` solo para Administración. El cuerpo SHALL
aceptar `new_password` de al menos 8 caracteres y como máximo el límite de bcrypt. El sistema
SHALL guardar únicamente el hash bcrypt, SHALL invalidar la contraseña anterior y SHALL dejar
`must_change_password = true` en la cuenta. SHALL NOT enviar correo ni devolver la contraseña en
claro.

#### Scenario: Restablecimiento exitoso
- **WHEN** el administrador define una nueva contraseña válida para un alumno
- **THEN** la contraseña anterior deja de ser válida, la nueva permite iniciar sesión y la cuenta queda con cambio obligatorio

#### Scenario: Contraseña demasiado corta
- **WHEN** la nueva contraseña tiene menos de 8 caracteres
- **THEN** el sistema responde `422` y no modifica la contraseña

#### Scenario: Alumno sin cuenta de acceso
- **WHEN** se restablece la contraseña de un alumno que no tiene `Usuario` vinculado
- **THEN** el sistema responde `409` con un mensaje claro y no crea una cuenta implícitamente

#### Scenario: Solo Administración
- **WHEN** un Docente o un Alumno intenta restablecer una contraseña
- **THEN** el sistema responde `403`; sin token responde `401`

### Requirement: Baja lógica del alumno

El sistema SHALL exponer `DELETE /alumnos/{id}` solo para Administración. La baja SHALL ser
lógica: SHALL marcar `alumno.activo = false` y `usuario.is_active = false` en una sola
transacción, y SHALL NOT eliminar filas ni relaciones. Los alumnos con `activo = false` SHALL NOT
aparecer en `GET /alumnos` y su cuenta SHALL NOT poder iniciar sesión. Sus inscripciones, pagos e
historial SHALL conservarse.

#### Scenario: Baja exitosa
- **WHEN** el administrador confirma la baja de un alumno registrado
- **THEN** el alumno deja de aparecer en el listado, su cuenta queda inactiva y sus inscripciones y pagos siguen existiendo en la base

#### Scenario: El alumno dado de baja no inicia sesión
- **WHEN** el alumno dado de baja intenta iniciar sesión con su email y contraseña
- **THEN** el sistema responde `401` con el mensaje genérico de credenciales inválidas

#### Scenario: La baja no afecta a otros registros
- **WHEN** se da de baja a un alumno
- **THEN** los demás alumnos, inscripciones, pagos y relaciones siguen disponibles y sin cambios

#### Scenario: Baja de un alumno ya dado de baja
- **WHEN** se intenta dar de baja a un alumno que ya está inactivo
- **THEN** el sistema responde `409` y no vuelve a modificar el registro

#### Scenario: Solo Administración
- **WHEN** un Docente o un Alumno intenta dar de baja a un alumno
- **THEN** el sistema responde `403`; sin token responde `401`

### Requirement: Reactivación de un alumno dado de baja

El sistema SHALL exponer `GET /alumnos/reactivable?documento=&email=` y `POST /alumnos/{id}/reactivar` solo para Administración. La consulta SHALL devolver el alumno inactivo solo si el DNI o el email le corresponde y no hay conflicto con un registro activo u otra cuenta. La reactivación SHALL conservar el mismo `id`, legajo, inscripciones, pagos e historial, reactivar alumno y cuenta, y generar una nueva contraseña inicial con cambio obligatorio. SHALL NOT duplicar el registro.

#### Scenario: El alta detecta un alumno inactivo
- **WHEN** el administrador intenta registrar un DNI o email que pertenece a un alumno dado de baja
- **THEN** el sistema informa que puede reactivar ese registro y no crea un duplicado

#### Scenario: Reactivación confirmada
- **WHEN** el administrador confirma la reactivación
- **THEN** el alumno vuelve al listado de activos con el mismo `id`, legajo, inscripciones, pagos e historial; su cuenta vuelve a estar activa y recibe una nueva contraseña inicial generada con la convención de la HU 13, de la que solo se guarda el hash

#### Scenario: La reactivación exige cambio de contraseña
- **WHEN** el alumno reactivado inicia sesión con la nueva contraseña inicial
- **THEN** la sesión informa `must_change_password = true` y debe cambiarla antes de usar el sistema

#### Scenario: La contraseña inicial no se expone fuera de la respuesta
- **WHEN** se reactiva un alumno
- **THEN** la contraseña inicial en claro solo aparece en la respuesta de la reactivación y no se envía por correo ni se guarda en claro

#### Scenario: Reactivación cancelada
- **WHEN** el administrador cancela la reactivación
- **THEN** no se modifica ningún dato del alumno ni se crea un registro nuevo

#### Scenario: Conflicto real de unicidad
- **WHEN** el DNI o el email del formulario pertenece a otro registro activo, otro padrón o otra cuenta
- **THEN** la reactivación se rechaza con `409` y el alta no crea un duplicado

#### Scenario: Solo Administración reactiva
- **WHEN** un Docente o un Alumno intenta consultar o reactivar un alumno dado de baja
- **THEN** el sistema responde `403`; sin token responde `401`
