# auth-and-roles Specification

## Purpose

Definir la autenticación y la autorización por rol de TechAcademy BA: un único acceso por email y contraseña que emite un JWT, tres roles (Administración, Docente, Alumno) con dependencias de autorización reutilizables, y las cuentas de usuario que los sostienen.

## Requirements

### Requirement: Autenticación por email y contraseña

El sistema SHALL exponer un único endpoint de login que acepte `email` y `contraseña` y emita un token JWT firmado. WHEN las credenciales son válidas SHALL devolver el token junto con el identificador, el rol y las banderas de la cuenta. WHEN el email no existe o la contraseña no coincide SHALL devolver `401` con un mensaje genérico que no revele cuál de los dos datos falló. WHEN el cuerpo no incluye email o contraseña SHALL devolver `422`.

#### Scenario: Credenciales válidas
- **WHEN** un usuario registrado envía su email y su contraseña correcta
- **THEN** el sistema devuelve `200` con el token, el identificador del usuario, su rol y `must_change_password`

#### Scenario: Contraseña incorrecta
- **WHEN** un usuario registrado envía su email con una contraseña que no coincide
- **THEN** el sistema devuelve `401` con un mensaje genérico de credenciales inválidas, sin distinguir entre email inexistente y contraseña incorrecta

#### Scenario: Datos de acceso incompletos
- **WHEN** la solicitud de login omite el email o la contraseña
- **THEN** el sistema devuelve `422` indicando los campos faltantes

### Requirement: Roles del sistema

El sistema SHALL soportar exactamente tres roles: `ADMIN`, `DOCENTE` y `ALUMNO`. Administración y Secretaría SHALL ser un único rol `ADMIN`; la distinción entre ambas denominaciones es únicamente de presentación y la UI la muestra como "Secretaría". El sistema SHALL NOT crear un rol separado para Secretaría.

#### Scenario: Administración y Secretaría comparten rol
- **WHEN** se consulta la lista de roles del sistema
- **THEN** existe un único rol de administración con etiqueta `ADMIN` y la interfaz lo presenta como "Secretaría"

#### Scenario: Un usuario tiene exactamente un rol
- **WHEN** se lee la cuenta de cualquier usuario
- **THEN** expone un único valor de rol dentro del conjunto `ADMIN`, `DOCENTE` o `ALUMNO`

### Requirement: Consulta de la sesión actual

El sistema SHALL exponer un endpoint que devuelva la identidad del usuario autenticado a partir de un token válido, incluyendo su identificador, email, rol, nombre para mostrar y `must_change_password`. WHEN el token falta, es inválido o está expirado SHALL devolver `401`.

#### Scenario: Token válido
- **WHEN** un usuario autenticado solicita su propia sesión con un token vigente
- **THEN** el sistema devuelve `200` con su identificador, email, rol, nombre para mostrar y `must_change_password`

#### Scenario: Token ausente o inválido
- **WHEN** la solicitud no incluye un token, o incluye uno expirado o manipulado
- **THEN** el sistema devuelve `401` y no expone ningún dato de la cuenta

### Requirement: Autorización por rol reutilizable

El sistema SHALL proporcionar un conjunto de dependencias de autorización parametrizables por rol y reutilizables por cualquier endpoint, de modo que una ruta declare el rol o los roles admitidos y el acceso se evalúe de forma uniforme. WHEN el rol del usuario autenticado no está entre los admitidos por la ruta SHALL devolver `403`. WHEN el usuario no está autenticado SHALL devolver `401`, y la respuesta nunca SHALL revelar si el recurso solicitado existe.

#### Scenario: Rol admitido
- **WHEN** un usuario cuyo rol está entre los declarados por la ruta accede a ella
- **THEN** el sistema permite el acceso

#### Scenario: Rol no admitido
- **WHEN** un usuario autenticado accede a una ruta que no admite su rol
- **THEN** el sistema devuelve `403` sin procesar la operación

#### Scenario: Sin autenticar
- **WHEN** una solicitud llega a una ruta protegida sin un token válido
- **THEN** el sistema devuelve `401` sin revelar la existencia del recurso

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

#### Scenario: El alumno cambia su contraseña desde el panel

- **WHEN** el alumno ingresa su contraseña actual y una nueva contraseña confirmada, y confirma el cambio
- **THEN** el sistema guarda la nueva contraseña, deja la anterior inválida y el indicador queda en `false`

#### Scenario: La contraseña actual no coincide

- **WHEN** el usuario envía una contraseña actual incorrecta
- **THEN** el sistema responde `400` sin modificar la contraseña ni el indicador

#### Scenario: El docente cambia su contraseña inicial

- **WHEN** un docente recién dado de alta ingresa con su email y su contraseña inicial y confirma una contraseña nueva
- **THEN** el sistema guarda el hash de la nueva, deja `must_change_password` en `false`, invalida la contraseña inicial y le permite el acceso a las funcionalidades de su rol

#### Scenario: Las credenciales iniciales se entregan una sola vez

- **WHEN** el alta de docente termina y el administrador cierra el modal de credenciales
- **THEN** la contraseña inicial deja de mostrarse y no queda disponible en el listado, en la edición ni al recargar la página

#### Scenario: Las cuentas docentes existentes no cambian

- **WHEN** se aplica la HU 66 sobre una base con docentes creados antes de la entrega
- **THEN** esas cuentas conservan su contraseña, su `must_change_password` y sus sesiones, y el restablecimiento administrativo de la contraseña sigue funcionando igual

### Requirement: Vínculo entre usuario y registro de rol

Cada cuenta SHALL vincularse con su registro de dominio cuando corresponda: una cuenta `DOCENTE` con el docente asociado, una cuenta `ALUMNO` con el alumno asociado, y una cuenta `ADMIN` sin ninguno de los dos. El sistema SHALL validar esta correspondencia e impedir una cuenta docente sin docente o una cuenta alumno sin alumno.

#### Scenario: Cuenta docente
- **WHEN** se crea la cuenta de un docente
- **THEN** la cuenta queda vinculada a ese docente y a ningún alumno

#### Scenario: Cuenta de administración
- **WHEN** se crea una cuenta de administración
- **THEN** la cuenta no queda vinculada a ningún docente ni a ningún alumno

### Requirement: Cuentas de demostración

El sistema SHALL proveer un comando de carga de datos iniciales que cree tres cuentas de demostración, una por rol, y que SHALL ser idempotente: ejecutarlo varias veces SHALL dejar el mismo resultado y no SHALL duplicar registros ni fallar. Las credenciales de las cuentas de demostración SHALL estar documentadas y ser públicas para el entorno de desarrollo.

#### Scenario: Primera ejecución
- **WHEN** se ejecuta el comando de carga inicial sobre una base vacía
- **THEN** quedan creadas las cuentas de demostración de administración, docente y alumno

#### Scenario: Ejecución repetida
- **WHEN** se ejecuta el comando de carga inicial por segunda vez
- **THEN** finaliza correctamente y la cantidad de cuentas no aumenta

#### Scenario: Contraseñas del seed
- **WHEN** se inspecciona el resultado del comando de carga inicial
- **THEN** las tres cuentas quedan con contraseñas conocidas y documentadas en el README

### Requirement: Interfaz de envío de correos con implementación de desarrollo

El sistema SHALL definir una interfaz de envío de correos y SHALL resolverla, en el entorno de desarrollo, con una implementación que solo registra el mensaje en el log y no envía correo real. Este change SHALL NOT elegir proveedor de correo. La interfaz SHALL poder informar un fallo de envío sin lanzar una excepción que interrumpa la operación de negocio que la originó, porque el alta de un alumno o docente debe completarse aunque el correo falle y el administrador debe ser informado del fallo (historia #13).

#### Scenario: Envío en desarrollo
- **WHEN** el sistema intenta enviar un correo en el entorno de desarrollo
- **THEN** la implementación registra el mensaje en el log y no contacta ningún proveedor externo

#### Scenario: Fallo de envío informado
- **WHEN** la implementación de desarrollo no puede completar el envío
- **THEN** reporta el error a la capa que la invocó sin revertirse, y la interfaz permite que el administrador reciba el aviso del fallo

#### Scenario: Implementación intercambiable
- **WHEN** se resuelve la interfaz de envío de correo
- **THEN** la resolución ocurre por configuración, de modo que reemplazar la implementación de desarrollo por una real no requiere modificar el código que la consume

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
