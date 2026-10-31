# Spec Delta

## ADDED Requirements

### Requirement: Cambio de contraseña del docente desde su perfil

El sistema SHALL permitir que el docente cambie su contraseña desde su perfil reutilizando
`POST /auth/change-password`. El formulario SHALL pedir contraseña actual, nueva y confirmación, y
SHALL exigir que la nueva coincida con la confirmación antes de enviar. El backend SHALL verificar
la actual, guardar solo el hash de la nueva y rechazar con `400` una actual incorrecta y con `422`
una nueva que no cumpla la regla.

#### Scenario: El docente cambia su contraseña
- **WHEN** el docente ingresa su contraseña actual, una nueva válida y la confirmación coincidente
- **THEN** el sistema guarda la nueva, deja la anterior inválida y muestra el aviso de éxito

#### Scenario: La contraseña actual no coincide
- **WHEN** el docente envía una contraseña actual incorrecta
- **THEN** el sistema responde `400`, no cambia la contraseña y muestra el error en la tarjeta

#### Scenario: La confirmación no coincide
- **WHEN** la contraseña nueva y su confirmación son distintas
- **THEN** el formulario muestra el error y no envía la solicitud

#### Scenario: El cambio obligatorio del primer ingreso se conserva
- **WHEN** una cuenta docente con `must_change_password` en `true` inicia sesión
- **THEN** la interfaz la envía a `ChangePasswordPage` y las rutas de rol siguen respondiendo `403` hasta que cambie la contraseña
