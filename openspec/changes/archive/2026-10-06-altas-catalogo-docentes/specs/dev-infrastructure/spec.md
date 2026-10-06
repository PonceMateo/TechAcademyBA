# Spec Delta

## MODIFIED Requirements

### Requirement: Estructura del frontend y capa de datos intercambiable

El frontend SHALL organizarse con una capa de datos de ejemplo, una capa de servicios y
componentes de presentación. Los datos de las pantallas SHALL residir en un módulo
separado de los componentes. Los componentes SHALL consumir los datos exclusivamente a
través de la capa de servicios, de modo que reemplazarla por llamadas a la API real no
requiera modificar los componentes. WHEN se reemplaza la implementación de un servicio de
ejemplo por una implementación remota, los componentes que lo consumen SHALL NOT requerir
cambios.

El modo de la fuente de datos real SHALL ser el valor por defecto, y el entorno de
desarrollo SHALL publicarlo. WHEN la fuente real atienda una consulta de lectura y la
respuesta sea 404 porque el recurso todavía no tiene endpoint, SHALL caer al datasource de
ejemplo y devolver sus datos. WHEN la respuesta sea cualquier otro error, SHALL NOT caer
al ejemplo: SHALL propagar el fallo, porque un error que se disfraza de dato válido hace
creer que la pantalla funciona. Los **POST SHALL NOT caer nunca** al datasource de ejemplo:
un alta que no llega a la base SHALL fallar y decir que falló, en lugar de escribir en un
almacén en memoria. La caída al ejemplo es un atajo deliberado que se borra cuando todas
las pantallas tengan su endpoint.

#### Scenario: Componentes ajenos a la fuente de datos
- **WHEN** se inspecciona un componente de pantalla
- **THEN** no contiene datos de negocio hardcodeados y obtiene lo que muestra a través de la capa de servicios

#### Scenario: Mocks aislados
- **WHEN** se inspecciona el módulo de datos de ejemplo
- **THEN** contiene los datos de ejemplo de las pantallas y es el único lugar donde residen

#### Scenario: Sustitución por la API real
- **WHEN** se cambia la implementación de un servicio para que consuma la API
- **THEN** los componentes que usan ese servicio funcionan sin modificarse

#### Scenario: Solo el login es real
- **WHEN** se revisa qué partes del frontend consumen el backend
- **THEN** ya no es solo el login: las tres altas del catálogo y del padrón de docentes llegan a la base, y el resto de las pantallas sigue resolviendo datos de ejemplo
- **AND** el nombre de este escenario describe lo que era cierto hasta este change y queda acá como registro de la diferencia

#### Scenario: La fuente real es el modo por defecto
- **WHEN** se levanta el entorno con la configuración por omisión
- **THEN** las pantallas consumen la fuente real y el entorno publica el modo real

#### Scenario: Lectura sin endpoint cae al ejemplo
- **WHEN** una pantalla pide datos de un recurso que todavía no tiene endpoint y la respuesta es 404
- **THEN** la pantalla muestra los datos de ejemplo y no informa un error

#### Scenario: Error distinto de ausencia de endpoint
- **WHEN** una lectura falla con un código de error distinto de 404
- **THEN** el fallo se informa y no se muestran datos de ejemplo en su lugar

#### Scenario: Un alta nunca cae al ejemplo
- **WHEN** una pantalla envía un alta y el backend no la registra
- **THEN** la pantalla falla y no muestra ninguna confirmación ficticia. El texto que ve la secretaría es el motivo de la falla —«No pudimos conectar con el servidor.»—, que no llega a decir literalmente que el alta no se guardó; lo que el sistema garantiza es que nunca se confirme un alta que no existe