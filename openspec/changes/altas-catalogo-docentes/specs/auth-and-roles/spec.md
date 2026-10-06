# Spec Delta

## MODIFIED Requirements

### Requirement: Cuentas con cambio de contraseña obligatorio

El sistema SHALL almacenar en cada cuenta un indicador `must_change_password`. Las cuentas creadas en el alta de docente SHALL nacer con ese indicador en `false` y con la contraseña de demostración documentada, porque en esta fase los docentes no son personas reales y el flujo de cambio de contraseña todavía no existe. Las cuentas creadas en el alta de alumno SHALL nacer con ese indicador en `true` y con una contraseña generada, porque el alta de un alumno genera credenciales de acceso (historia #13). WHEN la cuenta tiene el indicador en `true` SHALL quedar marcada como pendiente de cambio. Este change SHALL NOT implementar el cambio de contraseña: el indicador se persiste y se expone, y la interfaz SHALL advertir al usuario.

#### Scenario: Alta de docente o alumno
- **WHEN** se da de alta un docente o un alumno y se genera su contraseña
- **THEN** la cuenta de un **docente** queda creada con `must_change_password` en `false`, de manera coherente con las cuentas de demostración, porque el flujo de cambio de contraseña todavía no existe y obligar a cambiar una contraseña conocida dejaría al docente sin poder entrar; la cuenta de un **alumno** queda creada con ese indicador en `true`

#### Scenario: Cuenta pendiente de cambio
- **WHEN** un usuario con `must_change_password` en `true` inicia sesión
- **THEN** el sistema lo autentica y la interfaz le informa que debe cambiar su contraseña

#### Scenario: Cuenta ya actualizada
- **WHEN** un usuario sin pendiente inicia sesión
- **THEN** el sistema lo autentica sin solicitarle un cambio de contraseña
