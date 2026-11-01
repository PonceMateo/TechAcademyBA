# Spec Delta

## ADDED Requirements

### Requirement: Restablecimiento administrativo de la contraseña de un alumno

La contraseña restablecida por Administración desde la ficha del alumno SHALL guardarse como hash
bcrypt y SHALL invalidar la anterior. La cuenta SHALL quedar con `must_change_password = true`,
de modo que el alumno deba cambiarla en el siguiente ingreso por el mecanismo existente de
`POST /auth/change-password`. El sistema SHALL NOT enviar correo.

#### Scenario: El alumno ingresa con la contraseña restablecida
- **WHEN** el administrador restablece la contraseña y el alumno inicia sesión con la nueva
- **THEN** el login es exitoso y la sesión informa `must_change_password = true`

#### Scenario: La contraseña anterior deja de servir
- **WHEN** el alumno intenta iniciar sesión con la contraseña anterior después del restablecimiento
- **THEN** el sistema responde `401` con el mensaje genérico de credenciales inválidas

#### Scenario: La baja desactiva el acceso
- **WHEN** un alumno es dado de baja lógica
- **THEN** su `Usuario` queda con `is_active = false` y no puede iniciar sesión

#### Scenario: La reactivación restablece el acceso
- **WHEN** un alumno dado de baja es reactivado
- **THEN** su cuenta vuelve a `is_active = true`, recibe una nueva contraseña inicial y queda con `must_change_password = true`
