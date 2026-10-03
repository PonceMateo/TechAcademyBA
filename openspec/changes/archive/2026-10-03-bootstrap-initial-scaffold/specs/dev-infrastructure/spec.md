# Spec Delta

## Purpose

Definir la base técnica sobre la que el equipo podrá desarrollar y entregar TechAcademy BA: arranque reproducible del entorno completo con Docker Compose, migraciones y carga de datos inicial documentadas, estructura de proyecto en backend y frontend, integración continua en GitHub Actions y documentación de setup y de trabajo del equipo.

## ADDED Requirements

### Requirement: Arranque del entorno completo con Docker Compose

El sistema SHALL proveer un comando único de Docker Compose que levante los tres servicios del proyecto: base de datos PostgreSQL 16, backend y frontend. El servicio de base de datos SHALL persistir el volumen de forma estable entre ejecuciones. El backend y el frontend SHALL ejecutarse en modo desarrollo con recarga automática de cambios. WHEN un compañero nuevo clona el repositorio y ejecuta el comando de arranque SHALL obtener la base de datos, el backend y el frontend operativos sin pasos manuales adicionales.

#### Scenario: Levantar el entorno
- **WHEN** un desarrollador ejecuta el comando de arranque de Docker Compose en una máquina limpia
- **THEN** los servicios de base de datos, backend y frontend quedan ejecutándose

#### Scenario: Persistencia entre ejecuciones
- **WHEN** se detiene y vuelve a levantar el entorno
- **THEN** los datos de la base de datos siguen disponibles

#### Scenario: Recarga automática
- **WHEN** se modifica un archivo del backend o del frontend con el entorno en ejecución
- **THEN** el servicio correspondiente recarga el cambio sin reiniciar el entorno

### Requirement: Endpoint de verificación de salud

El sistema SHALL exponer un endpoint de salud que responda sin requerir autenticación y que indique que el servicio está disponible. WHEN el servicio está operativo SHALL responder con éxito y sin datos sensibles.

#### Scenario: Servicio disponible
- **WHEN** se consulta el endpoint de salud sin credenciales
- **THEN** el sistema responde con éxito indicando que el servicio está disponible

#### Scenario: La salud no requiere sesión
- **WHEN** se consulta el endpoint de salud sin token
- **THEN** el sistema responde de todos modos, y la respuesta no expone información sensible

### Requirement: Migraciones de base de datos

El sistema SHALL administrar el esquema de base de datos mediante migraciones versionadas, con una migración inicial que construya el esquema de dominio completo. El proyecto SHALL documentar el comando que aplica las migraciones. WHEN se aplica la migración inicial sobre una base vacía SHALL completar sin error y con el esquema resultante verificable.

#### Scenario: Aplicar la migración inicial
- **WHEN** un desarrollador ejecuta el comando documentado de migraciones sobre una base vacía
- **THEN** el esquema de dominio completo queda creado

#### Scenario: Migración aplicada sobre una base ya migrada
- **WHEN** se ejecuta el comando de migraciones cuando no hay migraciones pendientes
- **THEN** finaliza correctamente sin volver a aplicar las migraciones ya ejecutadas

### Requirement: Carga de datos inicial reproducible

El sistema SHALL proveer un comando documentado de carga de datos iniciales que sea idempotente y que permita preparar un entorno de desarrollo con las cuentas de demostración. Ejecutarlo reiteradamente SHALL NOT duplicar registros ni producir error. WHEN el entorno se levanta por primera vez SHALL documentarse la secuencia completa de comandos de migraciones y de carga inicial.

#### Scenario: Primera preparación del entorno
- **WHEN** un desarrollador sigue la secuencia documentada de migraciones y carga inicial
- **THEN** el entorno queda listo para iniciar sesión con las cuentas de demostración

#### Scenario: Carga repetida
- **WHEN** se ejecuta la carga inicial más de una vez
- **THEN** finaliza sin error y no duplica registros

### Requirement: Estructura del backend

El backend SHALL organizarse en capas separadas —configuración central, modelos de datos, esquemas de entrada y salida, rutas de API y servicios de negocio— de modo que cada capa tenga una responsabilidad identificable. La configuración SHALL provenir de variables de entorno y el proyecto SHALL incluir un archivo de ejemplo que documente todas las variables requeridas sin contener valores secretos. La aplicación SHALL usar pytest como framework de pruebas y no SHALL usar unittest.

#### Scenario: Capas identificables
- **WHEN** se recorre el árbol del backend
- **THEN** configuración, modelos, esquemas, API y servicios están en directorios separados y con responsabilidad definida

#### Scenario: Configuración por entorno
- **WHEN** se configura la conexión a la base de datos, el secreto de firma y los orígenes permitidos
- **THEN** esos valores provienen de variables de entorno documentadas en el archivo de ejemplo

#### Scenario: Ejemplo sin secretos
- **WHEN** se inspecciona el archivo de ejemplo de variables de entorno
- **THEN** enumera las variables necesarias sin incluir contraseñas, claves ni secretos reales

#### Scenario: Pruebas con pytest
- **WHEN** se ejecutan las pruebas del backend
- **THEN** se ejecutan con pytest

### Requirement: Estructura del frontend y capa de datos intercambiable

El frontend SHALL organizarse con una capa de datos mock, una capa de servicios y componentes de presentación. Los datos de las pantallas SHALL residir en un módulo de mocks separados de los componentes. Los componentes SHALL consumir los datos exclusivamente a través de la capa de servicios, de modo que reemplazarla por llamadas a la API real no requiera modificar los componentes. El login SHALL ser la única parte que consume el backend real. WHEN se reemplaza la implementación de un servicio mock por una implementación remota, los componentes que lo consumen SHALL NOT requerir cambios.

#### Scenario: Componentes ajenos a la fuente de datos
- **WHEN** se inspecciona un componente de pantalla
- **THEN** no contiene datos de negocio hardcodeados y obtiene lo que muestra a través de la capa de servicios

#### Scenario: Mocks aislados
- **WHEN** se inspecciona el módulo de mocks
- **THEN** contiene los datos de ejemplo de las pantallas y es el único lugar donde residen

#### Scenario: Sustitución por la API real
- **WHEN** se cambia la implementación de un servicio para que consuma la API
- **THEN** los componentes que usan ese servicio funcionan sin modificarse

#### Scenario: Solo el login es real
- **WHEN** se revisa qué partes del frontend consumen el backend
- **THEN** únicamente el proceso de login lo hace; el resto opera con datos mock

### Requirement: Componentes de interfaz reutilizables

El frontend SHALL proveer un conjunto de componentes de interfaz reutilizables para los elementos que las pantallas repiten: botón, insignia de estado, tabla, modal, campo de entrada, tarjeta e indicador de estado. Las insignias de estado de habilitación SHALL distinguir visualmente el estado habilitado del bloqueado y SHALL admitir mostrar la causa asociada.

#### Scenario: Elementos reutilizables disponibles
- **WHEN** se construye una pantalla que necesita un botón, una tabla, un modal o una tarjeta
- **THEN** el componente se toma del conjunto compartido en lugar de definirse de nuevo en la pantalla

#### Scenario: Insignia con causa
- **WHEN** se renderiza un estado bloqueado
- **THEN** la insignia lo distingue del habilitado y admite mostrar la causa del bloqueo

### Requirement: Integración continua en GitHub Actions

El proyecto SHALL definir un flujo de integración continua en GitHub Actions que se ejecute en cada push y en cada pull request. El flujo SHALL tener un job de backend que ejecute el linter y la suite de pruebas contra una base PostgreSQL disponible como servicio, y un job de frontend que ejecute el linter, las pruebas y la construcción de producción. WHEN cualquiera de los jobs falla, el flujo SHALL marcar el resultado como fallido.

#### Scenario: Ejecución en push y pull request
- **WHEN** se realiza un push a una rama o se abre un pull request
- **THEN** el flujo se ejecuta en ambos casos

#### Scenario: Job de backend
- **WHEN** se ejecuta el job de backend
- **THEN** el linter y la suite de pruebas se ejecutan contra una base PostgreSQL declarada como servicio

#### Scenario: Job de frontend
- **WHEN** se ejecuta el job de frontend
- **THEN** el linter, las pruebas y la construcción de producción se ejecutan

#### Scenario: Fallo de un job
- **WHEN** el linter o las pruebas fallan en cualquiera de los dos jobs
- **THEN** el flujo queda en estado fallido

### Requirement: Cobertura de pruebas mínima del scaffold

El backend SHALL tener pruebas automatizadas que cubran la verificación de salud, el inicio de sesión exitoso y fallido, la consulta de la sesión actual y el rechazo por rol. Las pruebas de migración SHALL ejecutarse contra PostgreSQL real y no SHALL correr contra un motor emulado. El frontend SHALL tener pruebas automatizadas que cubran la redirección según el rol, el rechazo de una ruta protegida, la renderización del panel lateral, la insignia de estado de habilitación y la condición de deshabilitado de los ítems que llevan la etiqueta "Próximamente".

#### Scenario: Pruebas de backend
- **WHEN** se ejecuta la suite de pruebas del backend
- **THEN** cubre salud, login exitoso, login fallido, sesión actual y autorización por rol

#### Scenario: Migraciones contra PostgreSQL
- **WHEN** se ejecutan las pruebas de migración
- **THEN** se ejecutan contra una base PostgreSQL real

#### Scenario: Pruebas de frontend
- **WHEN** se ejecuta la suite de pruebas del frontend
- **THEN** cubre redirección por rol, ruta protegida, panel lateral, insignia de estado e ítems deshabilitados

### Requirement: Documentación de setup

El repositorio SHALL incluir un README con los pasos para levantar el proyecto, los comandos disponibles, la estructura de carpetas y las decisiones de convención relevantes. El README SHALL permitir que un compañero nuevo levante el proyecto en menos de diez minutos siguiendo los pasos documentados. El README SHALL incluir una sección de herramientas opcionales que recomiende instalar GitHub CLI para automatizar la consulta del backlog, indicando cómo autenticarse y que no es obligatorio para desarrollar.

#### Scenario: Levantar el proyecto desde cero
- **WHEN** un desarrollador nuevo sigue los pasos del README
- **THEN** puede dejar el proyecto funcionando sin consultar a otro miembro del equipo

#### Scenario: Herramientas opcionales
- **WHEN** un desarrollador lee la sección de herramientas opcionales
- **THEN** encuentra la recomendación de instalar GitHub CLI con su comando de autenticación y la aclaración de que no es obligatorio para desarrollar

### Requirement: Convenciones de trabajo del equipo

El repositorio SHALL definir por escrito el flujo de trabajo del equipo en `AGENTS.md`, preservando el bloque gestionado por OpenSpec y agregando el contenido del equipo fuera de ese bloque. `AGENTS.md` SHALL indicar cuándo aplicar un cambio directo sin OpenSpec y cuándo usar el flujo de propuesta, y SHALL establecer que ante la duda se consulta a una persona del equipo en lugar de iniciar una propuesta completa por cuenta propia. El repositorio SHALL incluir una plantilla de pull request que pida qué cambió, por qué, el issue o change relacionado y cómo se probó, y SHALL incluir un registro de decisiones técnicas no funcionales con fecha y autor. El repositorio SHALL mantener un glosario con la terminología del negocio.

#### Scenario: Bloque de OpenSpec preservado
- **WHEN** se lee `AGENTS.md`
- **THEN** el bloque gestionado por OpenSpec está intacto y el contenido del equipo está fuera de ese bloque

#### Scenario: Criterio de uso de OpenSpec
- **WHEN** un miembro del equipo debe decidir si un cambio lleva propuesta o no
- **THEN** encuentra en `AGENTS.md` el criterio para cambios directos y para cambios que requieren propuesta, y la instrucción de consultar ante la duda

#### Scenario: Plantilla de pull request
- **WHEN** se abre un pull request
- **THEN** la plantilla pide qué cambió, por qué, el issue o change relacionado y cómo se probó

#### Scenario: Trazabilidad con el backlog
- **WHEN** un change implementa una historia de usuario
- **THEN** su propuesta referencia el issue del backlog, y el pull request lo cierra solo cuando la historia cumple todos sus criterios de aceptación

#### Scenario: Decisiones técnicas registradas
- **WHEN** se adopta una decisión técnica no funcional, o se corrige la causa raíz de un error
- **THEN** queda registrada en el documento de decisiones con fecha y autor

#### Scenario: Glosario disponible
- **WHEN** un miembro del equipo consulta la terminología del negocio
- **THEN** encuentra el glosario con las definiciones del cliente

### Requirement: Configuración del asistente de código

El repositorio SHALL incluir un archivo de configuración del asistente de código que declare un servidor MCP remoto de documentación de librerías, para poder consultar documentación actualizada al trabajar con las dependencias del proyecto. La configuración SHALL obtenerse sin intervención manual y su formato SHALL ser el vigente soportado por la herramienta.

#### Scenario: Documentación de librerías disponible
- **WHEN** un miembro del equipo consulta la documentación de una librería del proyecto desde el asistente
- **THEN** la configuración expone un servidor MCP remoto que provee esa documentación

### Requirement: Archivos de higiene del repositorio

El repositorio SHALL incluir un archivo de exclusiones de control de versiones que omita los artefactos generados, las dependencias instaladas, los secretos y los archivos de entorno reales, y SHALL incluir un archivo de configuración de editores que defina de forma uniforme el final de línea, la codificación y la indentación.

#### Scenario: Secretos y entornos excluidos
- **WHEN** se inspecciona el archivo de exclusiones
- **THEN** omite el archivo de entorno real y cualquier secreto, y conserva el archivo de ejemplo

#### Scenario: Formato uniforme entre editores
- **WHEN** se abre un archivo del proyecto en editores distintos
- **THEN** el final de línea, la codificación y la indentación son los definidos por la configuración del repositorio
