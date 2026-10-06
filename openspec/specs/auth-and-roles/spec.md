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
