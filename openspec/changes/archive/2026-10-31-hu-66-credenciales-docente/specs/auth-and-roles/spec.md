# Spec Delta

## MODIFIED Requirements

### Requirement: Cuentas con cambio de contraseña obligatorio

El sistema SHALL almacenar en cada cuenta un indicador `must_change_password`. Las cuentas del alta
de docente o alumno SHALL nacer con una contraseña inicial `<primer nombre><DNI>` y el indicador en
`true`; la base SHALL guardar solo su hash. WHILE esté en `true`, SHALL permitir únicamente
consultar la sesión y cambiar la contraseña, y SHALL responder `403` en cualquier otra ruta. El
cambio SHALL exigir la actual, guardar solo el hash de la nueva, invalidarla y dejar el indicador en
`false`.

#### Scenario: Alta de docente o alumno

- **WHEN** se da de alta un docente o un alumno y se genera su contraseña
- **THEN** la cuenta de un **docente** queda creada con `must_change_password` en `true` y una contraseña inicial generada, igual que la cuenta de un **alumno**

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

#### Scenario: El docente cambia su contraseña inicial

- **WHEN** un docente recién dado de alta ingresa con su email y su contraseña inicial y confirma una contraseña nueva
- **THEN** el sistema guarda el hash de la nueva, deja `must_change_password` en `false`, invalida la contraseña inicial y le permite el acceso a las funcionalidades de su rol

#### Scenario: Las credenciales iniciales se entregan una sola vez

- **WHEN** el alta de docente termina y el administrador cierra el modal de credenciales
- **THEN** la contraseña inicial deja de mostrarse y no queda disponible en el listado, en la edición ni al recargar la página

#### Scenario: Las cuentas docentes existentes no cambian

- **WHEN** se aplica la HU 66 sobre una base con docentes creados antes de la entrega
- **THEN** esas cuentas conservan su contraseña, su `must_change_password` y sus sesiones, y el restablecimiento administrativo de la contraseña sigue funcionando igual
