# Spec Delta

## MODIFIED Requirements

### Requirement: Cuentas corporativas y nómina de empleados

El sistema SHALL almacenar una empresa con razón social, CUIT e indicador de necesidad de Factura A. El CUIT SHALL ser único y SHALL validarse tanto por formato como por dígito verificador. El sistema SHALL almacenar un contrato corporativo con tipo entre Charla y Curso formal, monto y estado. WHEN el tipo sea Charla, el sistema SHALL NOT generar alumnos ni solicitar la carga de nómina, porque una charla cerrada no genera alumnos (historia #19). WHEN el tipo sea Curso formal, la empresa SHALL poder cargar su nómina de empleados y el sistema SHALL crear una inscripción por empleado en la comisión contratada, clasificando cada inscripción como `CORPORATIVO`, vinculándola a la empresa y sin porcentaje de beca, y SHALL vincular al alumno existente cuando el documento ya esté en el padrón, sin duplicar su registro. WHEN la nómina supere las vacantes disponibles, el sistema SHALL rechazar la carga e informar las vacantes (historias #18, #19, #20).

#### Scenario: Alta de empresa
- **WHEN** se completa razón social, un CUIT válido y se indica si requiere Factura A
- **THEN** la empresa se crea y queda disponible para asociar contratos e inscripciones corporativas

#### Scenario: CUIT duplicado o inválido
- **WHEN** se intenta registrar una empresa con un CUIT ya registrado, o con un CUIT de formato o dígito verificador incorrecto
- **THEN** el sistema rechaza el alta e informa el error

#### Scenario: Charla corporativa cerrada
- **WHEN** la empresa contrata una charla corporativa sin inscripción formal
- **THEN** el sistema no genera alumnos ni solicita la carga de nómina para esa contratación

#### Scenario: Carga de nómina en curso formal
- **WHEN** se carga la nómina de empleados de una empresa con curso formal y una comisión con vacantes suficientes
- **THEN** el sistema crea una inscripción por empleado con categoría `CORPORATIVO`, empresa asociada y sin porcentaje de beca

#### Scenario: Empleado ya registrado en el padrón
- **WHEN** un empleado de la nómina ya existe en el padrón de alumnos
- **THEN** el sistema lo vincula al alumno existente sin duplicar su registro

#### Scenario: Nómina que excede las vacantes
- **WHEN** la cantidad de empleados de la nómina supera las vacantes de la comisión
- **THEN** el sistema rechaza la carga e informa las vacantes disponibles
