# Spec Delta

## ADDED Requirements

### Requirement: Credenciales iniciales del alta de docente

Después de un alta de docente exitosa, la pantalla `Docentes` SHALL cerrar el formulario, actualizar
el listado y abrir un modal con nombre, email, contraseña inicial, el aviso de cambio obligatorio y
el botón `Entendido`. La contraseña SHALL mostrarse solo después del alta exitosa y SHALL
desaparecer al cerrar el modal: no SHALL quedar en el listado, la edición ni al recargar. Un alta
rechazada SHALL mantener el formulario abierto y SHALL NOT mostrar credenciales.

#### Scenario: El alta exitosa muestra las credenciales

- **WHEN** el administrador confirma un alta de docente que la fuente acepta
- **THEN** el formulario se cierra, el listado se actualiza y aparece el modal `Credenciales del docente` con el nombre, el email de acceso, la contraseña inicial generada y el aviso de que deberá cambiarla en su primer ingreso

#### Scenario: Cerrar el modal oculta la contraseña

- **WHEN** el administrador pulsa `Entendido`
- **THEN** el modal se cierra y la contraseña inicial deja de estar visible en la pantalla

#### Scenario: La contraseña no queda en el padrón

- **WHEN** el administrador recorre el listado, abre la edición del docente o recarga la página después del alta
- **THEN** la contraseña inicial no aparece en la fila, ni en el formulario de edición, ni después de recargar

#### Scenario: Un alta rechazada no muestra credenciales

- **WHEN** la fuente rechaza el alta con un DNI o un email duplicado
- **THEN** el formulario queda abierto con lo que el administrador escribió, se muestra el motivo del rechazo y no aparece el modal de credenciales

#### Scenario: Las dos fuentes de datos se comportan igual

- **WHEN** la pantalla se usa en modo API o en modo de ejemplo
- **THEN** el modal recibe el email y la contraseña inicial con la misma forma en los dos modos, y la contraseña se genera con la convención `<primer nombre><DNI>`
