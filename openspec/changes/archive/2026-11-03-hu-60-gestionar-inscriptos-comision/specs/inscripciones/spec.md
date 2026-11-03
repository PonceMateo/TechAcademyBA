# Spec Delta

## Purpose

Gestión administrativa de los inscriptos de una comisión: listado con cupo, inscriptos activos y
vacantes, alta con la comisión fijada, y baja lógica que conserva el historial (HU 60).

## ADDED Requirements

### Requirement: Listado de inscriptos de una comisión

El sistema SHALL exponer `GET /inscripciones?comision_id=` solo para Administración. La respuesta
SHALL traer la comisión —`id`, `codigo`, nombre del curso—, su `cupo_maximo`, la cantidad de
inscripciones `ACTIVA`, las vacantes derivadas de esas activas y todas las inscripciones de la
comisión, cada una con su alumno —`id`, nombre y documento—, la categoría y el estado. SHALL
responder `404` si la comisión no existe.

#### Scenario: Comisión con inscriptos

- **WHEN** se consultan las inscripciones de una comisión con cupo 30 y 3 inscripciones activas
- **THEN** la respuesta trae la comisión, cupo 30, 3 inscriptos activos, 27 vacantes y las 3 filas con alumno, DNI, categoría y estado

#### Scenario: Comisión sin inscriptos

- **WHEN** la comisión existe y no tiene ninguna inscripción
- **THEN** la respuesta trae la comisión con 0 inscriptos activos, sus vacantes completas y una lista vacía

#### Scenario: Comisión inexistente

- **WHEN** se consulta un identificador que no corresponde a ninguna comisión
- **THEN** el sistema responde `404` y no devuelve ningún inscripto

#### Scenario: Solo Administración consulta

- **WHEN** un Docente o un Alumno intenta consultar los inscriptos de una comisión
- **THEN** el sistema responde `403`; sin token responde `401`

### Requirement: Habilitación e historial en el listado de la comisión

El listado SHALL incluir el estado de habilitación derivado con las reglas vigentes para cada
inscripción `ACTIVA`, y SHALL ordenar las inscripciones dadas de baja al final como historial, con
su estado de inscripción visible y sin estado de habilitación.

#### Scenario: La baja no ocupa cupo

- **WHEN** la comisión tiene 2 inscripciones activas y 1 dada de baja
- **THEN** el listado informa 2 inscriptos activos, las vacantes del cupo menos 2, y la fila de baja aparece al final con su estado `BAJA`

#### Scenario: Habilitación derivada

- **WHEN** una inscripción activa tiene pagos pendientes
- **THEN** la fila informa el estado de habilitación y su causa según las reglas existentes, sin inventar un estado en el frontend

### Requirement: Inscripción desde la gestión de una comisión

La pantalla de la comisión SHALL reutilizar el alta de inscripción existente con el `comision_id` de
la comisión abierta. El formulario SHALL mostrar la comisión seleccionada y bloqueada y SHALL
conservar las validaciones de categoría, beca parcial, empresa, alumno, duplicado y cupo. Al
confirmar SHALL actualizar el listado y las vacantes.

#### Scenario: Alta dentro de la comisión

- **WHEN** el administrador inscribe un alumno desde la comisión abierta
- **THEN** la inscripción se crea con esa comisión y el listado muestra un inscripto activo más y una vacante menos

#### Scenario: Comisión bloqueada

- **WHEN** el modal de inscripción se abre desde la comisión
- **THEN** la comisión aparece elegida y no se puede cambiar, y el resto del formulario funciona igual que en la pantalla general

#### Scenario: Alumno ya inscripto

- **WHEN** se intenta inscribir un alumno que ya tiene una inscripción activa en esa comisión
- **THEN** el sistema responde `409` y el formulario sigue abierto con el motivo

#### Scenario: Sin vacantes

- **WHEN** la comisión alcanzó su cupo de inscripciones activas
- **THEN** el alta responde `409` y no crea la inscripción

### Requirement: Baja lógica de una inscripción

El sistema SHALL exponer `POST /inscripciones/{id}/baja` solo para Administración, con el
`comision_id` desde el que se pide. SHALL cambiar el estado a `BAJA` sin borrar la fila, sin tocar al
alumno del padrón ni las demás inscripciones, y SHALL registrar el cambio en `audit_log`. SHALL
responder `404` si la inscripción o la comisión no existen o no se corresponden, y `409` si la
inscripción ya no está `ACTIVA`. La baja SHALL liberar una vacante.

#### Scenario: Baja exitosa

- **WHEN** se da de baja una inscripción `ACTIVA` de la comisión desde la que se pide
- **THEN** la inscripción queda en `BAJA`, la comisión informa un inscripto activo menos y una vacante más, y la fila se conserva en el historial

#### Scenario: Otras inscripciones del alumno

- **WHEN** el alumno tiene otra inscripción activa en una comisión distinta
- **THEN** esa otra inscripción conserva su estado y su categoría

#### Scenario: Baja duplicada

- **WHEN** se da de baja una inscripción que ya está en `BAJA`
- **THEN** el sistema responde `409` y no escribe una segunda entrada de auditoría

#### Scenario: Identificador o relación inválida

- **WHEN** la inscripción no existe o pertenece a otra comisión
- **THEN** el sistema responde `404` y no cambia ninguna fila

#### Scenario: Dos bajas simultáneas

- **WHEN** dos peticiones dan de baja la misma inscripción a la vez
- **THEN** una sola cambia el estado y la otra recibe `409`, sin liberar dos vacantes

#### Scenario: Solo Administración da de baja

- **WHEN** un Docente o un Alumno intenta dar de baja una inscripción
- **THEN** el sistema responde `403`; sin token responde `401`

### Requirement: Conservación de pagos e historial en la baja

La baja SHALL conservar las cobranzas, imputaciones, comprobantes e historial asociados a la
inscripción, y SHALL NOT modificar importes ni recalcular aranceles.

#### Scenario: Pagos e historial intactos

- **WHEN** la inscripción dada de baja tenía cobranzas imputadas y comprobantes
- **THEN** las cobranzas, imputaciones y comprobantes siguen apuntando a esa inscripción y no se modifica ningún importe
