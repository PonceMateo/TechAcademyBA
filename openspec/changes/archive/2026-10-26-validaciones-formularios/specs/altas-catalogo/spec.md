# Spec Delta

## MODIFIED Requirements

### Requirement: Consulta y alta de docentes

El sistema SHALL exponer la consulta del padrón de docentes y su alta. La consulta
`GET /docentes` SHALL devolver los docentes con sus datos personales y la cantidad de
comisiones asignadas. El alta `POST /docentes` SHALL aceptar nombre, apellido, DNI, email,
teléfono opcional y `cuil` opcional. El CUIL SHALL tener 11 dígitos después de quitar guiones,
SHALL usar el prefijo `20`, `23`, `24` o `27` y SHALL tener los 8 dígitos del medio iguales al DNI
del docente, completado con ceros a la izquierda cuando el DNI tenga 7 dígitos. La API SHALL NOT
calcular ni validar el dígito verificador. Un CUIL parcial o con una estructura inválida SHALL
responder `422`. WHEN el DNI o el email informados ya estén registrados, el sistema SHALL rechazar
el alta e informar **cuál de los dos datos se repitió**, porque el criterio de la historia pide saber
qué colisionó. WHEN el alta es exitosa, el sistema SHALL crear en **una sola transacción** el docente
y su cuenta de acceso con rol de docente, de modo que el docente quede creado y accesible por su
email o no quede ninguno de los dos. La cuenta creada SHALL quedar sin cambio de contraseña
pendiente, de manera coherente con las cuentas de demostración, porque el flujo de cambio de
contraseña todavía no existe (historia #9).

#### Scenario: Alta de docente correcta

- **WHEN** se envían nombre, apellido, DNI, email y teléfono de un docente no registrado
- **THEN** el sistema responde con el docente creado y su acceso por ese email, y el docente queda disponible para asignar a una comisión

#### Scenario: El contrato de alta de docente no lleva CUIL

- **WHEN** se inspecciona lo que el alta de docente admite
- **THEN** el contrato ya no excluye el CUIL: admite nombre, apellido, DNI, email, teléfono opcional y `cuil` opcional, y sin `cuil` el docente se guarda con ese dato en `null`. El nombre del escenario es histórico

#### Scenario: Alta de docente con CUIL válido

- **WHEN** se envía un alta con un CUIL de 11 dígitos, con o sin guiones, cuyo prefijo es válido y cuyos 8 dígitos del medio coinciden con el DNI
- **THEN** el sistema crea el docente, guarda el CUIL en 11 dígitos y lo devuelve en ese formato

#### Scenario: Alta de docente con CUIL inválido

- **WHEN** se envía un alta con un CUIL parcial, con un prefijo no permitido o con 8 dígitos del medio que no coinciden con el DNI
- **THEN** el sistema rechaza el alta con `422` y no crea el docente

#### Scenario: DNI de docente repetido

- **WHEN** se envía un DNI que ya está registrado
- **THEN** el sistema rechaza el alta e informa que el DNI está repetido

#### Scenario: Email de docente repetido

- **WHEN** se envía un email que ya está registrado
- **THEN** el sistema rechaza el alta e informa que el email está repetido

#### Scenario: Alta con email tomado en el otro padrón

- **WHEN** se envía un email que ya está registrado en el padrón de alumnos
- **THEN** el sistema rechaza el alta e informa que el email ya está en uso

#### Scenario: Docente creado y cuenta en la misma operación

- **WHEN** el alta de docente es exitosa
- **THEN** quedan creados el docente y su cuenta de acceso, y la cuenta accede a su panel

#### Scenario: Listado del padrón de docentes

- **WHEN** se consulta el padrón de docentes
- **THEN** cada fila trae los datos personales del docente y la cantidad de comisiones que tiene asignadas

### Requirement: Las pantallas de alta confirman contra la base

Las tres pantallas de alta de Administración —curso, comisión y docente— SHALL enviar lo
que el operador completa a la fuente de datos real y SHALL confirmar contra lo que la base
devuelve. Cada pantalla SHALL mostrar el resultado del alta, incluido el código generado
cuando corresponde. WHEN el alta es rechazada, la pantalla SHALL informar el motivo que
devuelve la fuente y **SHALL NOT** cerrar el formulario ni mostrar una confirmación.
WHEN una pantalla no puede alcanzar la base, SHALL informar que el alta no se guardó en
lugar de escribir en un almacén de memoria.

Las tres pantallas SHALL ofrecer la acción de alta. La pantalla de alta de docente hoy
muestra la acción sin formulario detrás, y SHALL dejar de hacerlo.

#### Scenario: El alta de curso muestra el código generado

- **WHEN** el operador completa el nombre de un curso y confirma
- **THEN** la pantalla muestra el código generado por la base y el curso aparece en el catálogo

#### Scenario: Alta rechazada

- **WHEN** la fuente de datos rechaza el alta e informa el dato duplicado
- **THEN** la pantalla muestra ese motivo, mantiene lo que el operador completó y no confirma el alta

#### Scenario: Alta que no llega a la base

- **WHEN** la fuente de datos no puede registrar el alta
- **THEN** la pantalla **falla y no muestra ninguna confirmación**. Lo que muestra es el motivo de la falla —«No pudimos conectar con el servidor.» o «La API respondió 500 a POST /cursos.»—, que no llega a decir literalmente que el alta no se guardó. Lo que importa para la secretaría, que es que no aparezca una confirmación falsa, sí está garantizado: el alta nunca cae al ejemplo

#### Scenario: El selector de curso ofrece cualquier curso del catálogo

- **WHEN** se abre el formulario de alta de comisión
- **THEN** el selector de curso se arma con el catálogo de cursos, de modo que un curso sin ninguna comisión todavía se puede elegir para abrirle la primera

#### Scenario: La pantalla de docente ofrece el formulario

- **WHEN** se abre la pantalla de docentes
- **THEN** la acción de alta abre un formulario que pide nombre, apellido, DNI, email, teléfono y un CUIL opcional, con el control de teléfono y los tres controles del CUIL

#### Scenario: Aviso de que el maquetado no guarda nada

- **WHEN** se revisan las tres pantallas de alta
- **THEN** ninguna dice que el maquetado no guarda nada todavía
