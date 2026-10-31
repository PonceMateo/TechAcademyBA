# Spec Delta

## MODIFIED Requirements

### Requirement: Perfil del docente

El sistema SHALL mostrar una tarjeta de identidad con el avatar de la cuenta de la sesión, su
nombre y la nota de Secretaría. El bloque de datos personales SHALL mostrar `Nombre`, `Apellido`,
`DNI` y `CUIL` en solo lectura y `Email` y `Teléfono` editables con guardado real. La pantalla
SHALL incluir una tarjeta `Seguridad` que reutilice `POST /auth/change-password` y SHALL mostrar
`Comisiones asignadas` con `CÓDIGO`, `CURSO`, `HORARIO` y `ESTADO`.

#### Scenario: El docente abre su perfil
- **WHEN** el docente abre `Mi Perfil`
- **THEN** ve la tarjeta de identidad con el avatar y el nombre de la cuenta de la sesión y la nota `Los cambios administrativos deben solicitarse a Secretaría BA.`, sin chip de permisos

#### Scenario: El docente revisa sus datos de contacto
- **WHEN** el docente baja al bloque de datos personales
- **THEN** ve `Nombre`, `Apellido`, `DNI` y `CUIL` como campos deshabilitados y `Email` y `Teléfono` como campos editables con el valor guardado

#### Scenario: El docente edita su email y su teléfono
- **WHEN** el docente cambia el email o el teléfono y guarda
- **THEN** la pantalla muestra el aviso de éxito y los valores que devolvió la API, y la sesión refleja el email nuevo

#### Scenario: El guardado falla
- **WHEN** el email ya pertenece a otra persona o el formato es inválido
- **THEN** la pantalla muestra el error, conserva lo ingresado y no confirma el cambio

#### Scenario: El docente cambia su contraseña desde el perfil
- **WHEN** el docente completa contraseña actual, nueva y confirmación y confirma el cambio
- **THEN** la pantalla muestra el aviso de éxito y la contraseña anterior deja de funcionar

#### Scenario: El docente revisa sus comisiones
- **WHEN** el docente baja al bloque `Comisiones asignadas`
- **THEN** ve las columnas `CÓDIGO`, `CURSO`, `HORARIO` y `ESTADO`, con sus comisiones reales y el estado `Activa` en verde

#### Scenario: El docente intenta editar su perfil
- **WHEN** el docente intenta modificar `Nombre`, `Apellido`, `DNI` o `CUIL`
- **THEN** los campos están deshabilitados y la API rechaza el intento con `422`, mientras `Email`, `Teléfono` y la contraseña sí se pueden editar
