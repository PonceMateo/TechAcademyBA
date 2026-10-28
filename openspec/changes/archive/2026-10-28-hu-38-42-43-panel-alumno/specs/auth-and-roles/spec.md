# Spec Delta

## MODIFIED Requirements

### Requirement: Cuentas con cambio de contraseña obligatorio

El sistema SHALL almacenar en cada cuenta un indicador `must_change_password`. Las cuentas creadas
en el alta de docente SHALL nacer con ese indicador en `false` y con la contraseña de demostración
documentada. Las cuentas creadas en el alta de alumno SHALL nacer con ese indicador en `true` y con
una contraseña generada, porque el alta de un alumno genera credenciales de acceso (historia #13).

WHILE la cuenta tiene el indicador en `true`, el sistema SHALL permitir únicamente la consulta de la
sesión actual y el cambio de contraseña, y SHALL responder `403` con el aviso de cambio pendiente en
cualquier otra ruta. El cambio de contraseña SHALL pedir la contraseña actual y una nueva, SHALL
rechazar con `400` una contraseña actual incorrecta y con `422` una nueva que no cumpla la regla, y
con éxito SHALL guardar solo el hash, dejar la contraseña anterior inválida y poner el indicador en
`false`.

La interfaz del alumno SHALL ofrecer el cambio de contraseña desde su panel, y SHALL informar al
usuario con una cuenta pendiente que debe cambiar la contraseña antes de usar el sistema.

#### Scenario: Alta de docente o alumno

- **WHEN** se da de alta un docente o un alumno y se genera su contraseña
- **THEN** la cuenta de un **docente** queda creada con `must_change_password` en `false`, y la cuenta de un **alumno** queda creada con ese indicador en `true`

#### Scenario: Cuenta pendiente de cambio

- **WHEN** un usuario con `must_change_password` en `true` inicia sesión y abre una pantalla de su rol
- **THEN** el sistema lo autentica, la interfaz le informa que debe cambiar su contraseña y las rutas de rol responden `403` hasta que la cambie

#### Scenario: El alumno cambia su contraseña desde el panel

- **WHEN** el alumno ingresa su contraseña actual y una nueva contraseña confirmada, y confirma el cambio
- **THEN** el sistema guarda la nueva contraseña, deja la anterior inválida y el indicador queda en `false`

#### Scenario: La contraseña actual no coincide

- **WHEN** el usuario envía una contraseña actual incorrecta
- **THEN** el sistema responde `400` sin modificar la contraseña ni el indicador

#### Scenario: Cuenta ya actualizada

- **WHEN** un usuario sin pendiente inicia sesión
- **THEN** el sistema lo autentica sin solicitarle un cambio de contraseña
