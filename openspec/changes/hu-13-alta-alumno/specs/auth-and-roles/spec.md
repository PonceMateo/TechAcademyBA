# Spec Delta

## MODIFIED Requirements

### Requirement: Cuentas con cambio de contraseña obligatorio

El sistema SHALL almacenar en cada cuenta un indicador `must_change_password`. Las cuentas creadas en el alta de docente SHALL nacer con ese indicador en `false` y con la contraseña de demostración documentada, porque en esta fase los docentes no son personas reales y su flujo de cambio no forma parte de esta entrega. Las cuentas creadas en el alta de alumno SHALL nacer con ese indicador en `true` y con una contraseña inicial generada a partir del nombre y del DNI, porque esa contraseña la conoce el administrador y sigue una convención adivinable (historia #13). WHEN la cuenta tiene el indicador en `true` SHALL quedar marcada como pendiente de cambio y SHALL NOT acceder a las funcionalidades de su rol hasta cambiarla.

#### Scenario: Alta de docente o alumno

- **WHEN** se da de alta un docente o un alumno y se genera su contraseña
- **THEN** la cuenta de un **docente** queda creada con `must_change_password` en `false`, de manera coherente con las cuentas de demostración; la cuenta de un **alumno** queda creada con ese indicador en `true` y con una contraseña inicial generada

#### Scenario: Cuenta pendiente de cambio

- **WHEN** un usuario con `must_change_password` en `true` inicia sesión
- **THEN** el sistema lo autentica, la interfaz lo lleva a la pantalla de cambio de contraseña y el backend le rechaza las rutas de rol hasta que la cambie

#### Scenario: Cuenta ya actualizada

- **WHEN** un usuario sin pendiente inicia sesión
- **THEN** el sistema lo autentica sin solicitarle un cambio de contraseña

## ADDED Requirements

### Requirement: Cambio de contraseña obligatorio en el primer ingreso

El sistema SHALL exponer un endpoint autenticado de cambio de contraseña que reciba la actual y
la nueva, verifique la actual, exija al menos ocho caracteres y que la nueva sea distinta, guarde
solo el hash y deje `must_change_password` en `false` en la misma transacción. SHALL responder con
la sesión actualizada. WHEN la actual no coincide SHALL devolver `400` sin cambiar nada. WHEN la
nueva es corta o repite la actual SHALL devolver `422` sin cambiar nada.

#### Scenario: Cambio exitoso

- **WHEN** una cuenta autenticada y pendiente envía su contraseña actual y una nueva válida y distinta
- **THEN** el sistema guarda el hash de la nueva, deja `must_change_password` en `false`, devuelve la sesión actualizada y permite el acceso a las rutas de su rol

#### Scenario: Contraseña actual incorrecta

- **WHEN** la cuenta envía una contraseña actual que no coincide
- **THEN** el sistema devuelve `400`, no modifica la contraseña ni el indicador de cambio pendiente

#### Scenario: Contraseña nueva inválida

- **WHEN** la cuenta envía una contraseña nueva de menos de ocho caracteres o igual a la actual
- **THEN** el sistema devuelve `422` y no modifica la contraseña ni el indicador de cambio pendiente

### Requirement: Bloqueo de las cuentas pendientes de cambio

WHEN la cuenta tiene `must_change_password` en `true`, las rutas que declaran un rol SHALL devolver
`403` con un mensaje que indique que debe cambiar la contraseña y SHALL NOT procesar la operación.
El login, la consulta de la sesión actual y el cambio de contraseña SHALL seguir accesibles, porque
son las rutas que permiten salir del estado pendiente.

#### Scenario: Cuenta pendiente bloqueada en el backend

- **WHEN** una cuenta con `must_change_password` en `true` llama a una ruta que declara un rol
- **THEN** el sistema devuelve `403` con el aviso de cambio pendiente y el encabezado `X-Cambio-Password-Pendiente: true`, sin ejecutar la operación

#### Scenario: Rutas accesibles durante el cambio pendiente

- **WHEN** una cuenta pendiente consulta su sesión o cambia su contraseña
- **THEN** el sistema responde con normalidad, porque esas rutas son las que le permiten salir del estado pendiente
