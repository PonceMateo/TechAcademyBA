# Spec Delta

## Purpose

Definir la consulta y la búsqueda administrativa del padrón de docentes, con sus criterios de
coincidencia, el filtro de docentes activos y las comisiones asignadas que devuelve la respuesta.

## ADDED Requirements

### Requirement: Búsqueda de docentes por nombre, apellido, DNI o email

El sistema SHALL exponer `GET /docentes` con un parámetro opcional `q` para buscar por nombre,
apellido, DNI o email. La búsqueda SHALL usar coincidencia por prefijo y SHALL ignorar mayúsculas,
minúsculas y tildes. WHEN `q` falta, está vacío o solo tiene espacios, SHALL devolver el listado
habitual; WHEN no hay coincidencias, SHALL devolver una lista vacía. No existe un mínimo de
caracteres.

#### Scenario: Prefijo de una palabra del nombre

- **WHEN** el administrador busca `a`
- **THEN** el sistema dispara la consulta con una sola letra, sin exigir un mínimo de caracteres, devuelve los docentes cuyo nombre o apellido tiene una palabra que empieza con `a`, y no los que solo contienen una `a` en el medio

#### Scenario: Coincidencia por prefijo de nombre o apellido

- **WHEN** el administrador busca `mart` o `perez`
- **THEN** el sistema devuelve los docentes cuyo nombre o apellido tiene una palabra que empieza con ese texto, sin exigir el nombre ni el apellido completos

#### Scenario: Orden de las palabras

- **WHEN** el administrador busca `ana gom`
- **THEN** cada palabra coincide con el inicio de una palabra distinta del nombre completo, en el mismo orden, y el sistema devuelve a `Ana Gómez`; WHEN busca `gom ana` SHALL NOT devolverlo

#### Scenario: Coincidencia sin distinguir mayúsculas ni tildes

- **WHEN** el administrador busca `PÉREZ`, `perez` o `Pérez`
- **THEN** el sistema devuelve el mismo docente, porque la comparación ignora mayúsculas y tildes

#### Scenario: Coincidencia por prefijo de DNI

- **WHEN** el administrador busca `30.111.222`, `30 111 222` o `30111`
- **THEN** el sistema devuelve el docente cuyo DNI normalizado empieza con esos dígitos, sin exigir el DNI completo

#### Scenario: Coincidencia por email

- **WHEN** el administrador busca el inicio de un email, como `rita.molina@`
- **THEN** el sistema devuelve los docentes cuyo email empieza con ese texto

#### Scenario: Consulta vacía

- **WHEN** `q` falta, está vacío o solo tiene espacios
- **THEN** el sistema devuelve el listado habitual de docentes activos

#### Scenario: Sin coincidencias

- **WHEN** ningún docente activo coincide con el criterio
- **THEN** el sistema devuelve una lista vacía

### Requirement: Orden de resultados por coincidencia

El sistema SHALL ordenar los resultados por el campo de la coincidencia —nombre, después DNI y al
final email— y, dentro de las coincidencias de nombre, por la posición de la primera palabra que
coincide. SHALL priorizar la primera palabra del nombre sobre las palabras posteriores o el
apellido. WHEN dos docentes coinciden en el mismo campo y la misma posición, SHALL conservar un
orden estable por `id`.

#### Scenario: La primera palabra del nombre gana

- **WHEN** el administrador busca `al` y existen `Rita Alonso` y `Alfonso Pérez`
- **THEN** `Alfonso Pérez` aparece antes que `Rita Alonso`, porque la coincidencia está al inicio de la primera palabra de su nombre

#### Scenario: Coincidencia en el apellido después de la coincidencia en el nombre

- **WHEN** un docente coincide por el inicio de su nombre y otro solo por el inicio de su apellido
- **THEN** el que coincide por el nombre aparece primero

#### Scenario: Desempate estable

- **WHEN** dos docentes coinciden en la misma posición de la misma forma
- **THEN** el sistema los devuelve en orden de `id`

#### Scenario: Una sola letra usa la misma regla de orden

- **WHEN** el administrador busca una sola letra
- **THEN** el sistema aplica el mismo orden por campo y posición que para una consulta más larga

### Requirement: Solo docentes activos

El sistema SHALL incluir en la consulta y en la búsqueda únicamente docentes con `activo = true`.
Los docentes dados de baja SHALL NOT aparecer en el listado habitual ni en los resultados de una
búsqueda.

#### Scenario: Docente dado de baja

- **WHEN** existe un docente con `activo = false`
- **THEN** el sistema no lo devuelve en `GET /docentes`, ni siquiera cuando su nombre, DNI o email coinciden con la consulta

### Requirement: Comisiones asignadas en la respuesta

La respuesta de `GET /docentes` SHALL incluir, para cada docente, la lista `comisiones` con el
`id`, el `codigo` derivado y el nombre del curso de cada comisión asignada. La lista SHALL armarse
desde las relaciones reales de `comision` en PostgreSQL y SHALL quedar vacía cuando el docente no
tenga comisiones. El sistema SHALL NOT inventar comisiones ni datos de comisiones. La respuesta
SHALL conservar `cantidad_comisiones`.

#### Scenario: Docente con comisiones

- **WHEN** el administrador consulta un docente asignado a una o más comisiones
- **THEN** la respuesta incluye cada comisión con su código y el nombre de su curso, tomados de las relaciones reales

#### Scenario: Docente sin comisiones

- **WHEN** el administrador consulta un docente que no está asignado a ninguna comisión
- **THEN** la respuesta devuelve `comisiones: []` y `cantidad_comisiones: 0`

### Requirement: Autorización administrativa

`GET /docentes` SHALL exigir una cuenta con rol `ADMIN`. WHEN falta el token SHALL responder
`401`; WHEN la cuenta tiene otro rol SHALL responder `403` sin ejecutar la consulta.

#### Scenario: Administrador autenticado

- **WHEN** una cuenta con rol `ADMIN` consulta el padrón
- **THEN** el sistema devuelve los docentes activos y sus comisiones

#### Scenario: Otro rol

- **WHEN** una cuenta con rol `DOCENTE` o `ALUMNO` consulta `GET /docentes`
- **THEN** el sistema responde `403` y no devuelve datos del padrón
