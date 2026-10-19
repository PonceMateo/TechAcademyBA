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

La fuente de datos de la aplicación SHALL ser siempre la API real y la aplicación SHALL NOT
ofrecer un modo de datos de ejemplo seleccionable desde su entorno. WHEN una lectura falla
—porque el recurso todavía no tiene endpoint o por cualquier otro error— SHALL propagarse
el fallo y SHALL NOT devolverse datos de ejemplo, porque un error que se disfraza de dato
válido hace creer que la pantalla funciona. Las pantallas que no obtienen datos SHALL
degradar con un estado vacío o un mensaje, sin dejar rechazos sin manejar. Los **POST SHALL
NOT caer nunca** al datasource de ejemplo: un alta que no llega a la base SHALL fallar y
decir que falló, en lugar de escribir en un almacén en memoria.

El módulo de datos de ejemplo y su datasource SHALL conservarse como infraestructura de
pruebas del frontend: la suite SHALL NOT resolver datos de la API real, sino del módulo de
ejemplo. Ningún componente de la aplicación SHALL importar el módulo de datos de ejemplo.

#### Scenario: Componentes ajenos a la fuente de datos
- **WHEN** se inspecciona un componente de pantalla
- **THEN** no contiene datos de negocio hardcodeados y obtiene lo que muestra a través de la capa de servicios

#### Scenario: Mocks aislados
- **WHEN** se inspecciona el módulo de datos de ejemplo
- **THEN** contiene los datos de ejemplo de las pantallas y es el único lugar donde residen
- **AND** ningún componente de la aplicación lo importa

#### Scenario: Sustitución por la API real
- **WHEN** se cambia la implementación de un servicio para que consuma la API
- **THEN** los componentes que usan ese servicio funcionan sin modificarse

#### Scenario: Solo el login es real
- **WHEN** se revisa qué partes del frontend consumen el backend
- **THEN** ya no es solo el login: las tres altas del catálogo y del padrón de docentes llegan a la base, y el resto de las pantallas consulta la API real en lugar de resolver datos de ejemplo
- **AND** el nombre de este escenario describe lo que era cierto antes de este change y queda acá como registro de la diferencia

#### Scenario: La fuente real es el modo por defecto
- **WHEN** se levanta la aplicación con cualquier configuración de entorno
- **THEN** las pantallas consumen la API real y la aplicación no ofrece ningún modo de datos de ejemplo. El nombre del escenario conserva el de la regla anterior: ya no hay un modo de ejemplo entre los que elegir, la fuente real es la única

#### Scenario: Lectura sin endpoint cae al ejemplo
- **WHEN** una pantalla pide datos de un recurso que todavía no tiene endpoint y la respuesta es 404
- **THEN** la lectura falla y la pantalla no muestra datos de ejemplo en su lugar. El nombre del escenario conserva el de la regla anterior: ya no cae al ejemplo, el fallo se propaga como cualquier otro

#### Scenario: Error distinto de ausencia de endpoint
- **WHEN** una lectura falla con un código de error distinto de 404
- **THEN** el fallo se informa y no se muestran datos de ejemplo en su lugar

#### Scenario: Un alta nunca cae al ejemplo
- **WHEN** una pantalla envía un alta y el backend no la registra
- **THEN** la pantalla falla y no muestra ninguna confirmación ficticia. El texto que ve la secretaría es el motivo de la falla —«No pudimos conectar con el servidor.»—, que no llega a decir literalmente que el alta no se guardó; lo que el sistema garantiza es que nunca se confirme un alta que no existe

#### Scenario: La suite de pruebas usa los mocks
- **WHEN** se ejecuta la suite de pruebas del frontend
- **THEN** resuelve los datos desde el módulo de datos de ejemplo y no desde la API real

#### Scenario: Pantalla sin endpoint muestra su estado vacío
- **WHEN** una pantalla consulta un recurso que todavía no tiene endpoint y la lectura falla
- **THEN** la pantalla muestra un estado vacío o un mensaje, sin dejar un rechazo sin manejar
