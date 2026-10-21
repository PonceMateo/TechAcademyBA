# Spec Delta

## MODIFIED Requirements

### Requirement: Padrón de docentes y alumnos

El sistema SHALL almacenar un docente con nombre, apellido, DNI, CUIL, email y teléfono, y
un alumno con nombre, DNI o pasaporte, email y teléfono. El CUIL del docente SHALL ser
**opcional**: el sistema SHALL admitir un docente sin CUIL y no SHALL rechazarlo por eso,
porque en esta fase los docentes no son personas reales y un CUIL inventado es peor que
ninguno. La columna SHALL conservarse y SHALL seguir siendo única cuando tiene valor,
por lo que un índice único sobre el CUIL SHALL permanecer. El sistema SHALL garantizar
que el DNI del docente sea único, que el DNI o pasaporte del alumno sea único y que el
email sea único dentro de cada padrón y además único frente al padrón del otro rol, de
modo que una misma dirección de correo no identifique a dos personas. WHEN se cargue un
email con formato inválido SHALL rechazarse el alta (historias #9 y #13).

El esquema SHALL admitir que `alumno.documento` y `alumno.tipo_documento` sean nulos y que
el tipo de documento sea `PASAPORTE`, porque el instituto inscribe alumnos del exterior. El
alta de esta entrega (HU 13) SHALL aceptar **solo DNI** y SHALL NOT admitir pasaporte ni
documento nulo. El alta con pasaporte y sin DNI queda diferida a la HU 47, que está en
`Won't`, y a la aprobación del equipo. Los datos adicionales que un alumno extranjero
requiere no forman parte de este change: su definición se discute con el cliente.

#### Scenario: Alta de docente con CUIL
- **WHEN** se da de alta un docente con nombre, apellido, DNI, CUIL, email y teléfono cuyos datos no están registrados
- **THEN** el docente se crea con acceso por su email y queda disponible para ser asignado a comisiones. **Este caso es a nivel de modelo**: el contrato del alta no admite `cuil`, así que por la API un docente con CUIL no se puede dar de alta. Lo que se verifica es que el dato se sostenga en el esquema y que el índice único sobre él siga en pie

#### Scenario: Docente sin CUIL
- **WHEN** se intenta guardar un docente sin informar CUIL
- **THEN** el sistema registra el docente y solo exige completar el CUIL cuando haya docentes reales

#### Scenario: Varios docentes sin CUIL conviven
- **WHEN** se registran dos docentes distintos sin CUIL
- **THEN** el sistema los acepta a los dos, porque un índice único admite múltiples valores ausentes

#### Scenario: CUIL repetido
- **WHEN** se intenta registrar un docente con un CUIL ya registrado
- **THEN** el sistema rechaza el alta e informa que el CUIL está repetido. Lo sostiene el índice único sobre `cuil` en la base. **Por la API el caso no se alcanza**, porque el alta no pide CUIL, así que queda verificado a nivel de esquema

#### Scenario: Alta de docente
- **WHEN** se completa nombre, apellido, DNI, email y teléfono de un docente cuyos datos no están registrados
- **THEN** el docente se crea con acceso por su email

#### Scenario: DNI o email de docente duplicado
- **WHEN** se intenta registrar un docente con un DNI o un email ya registrados
- **THEN** el sistema rechaza el alta e informa el dato duplicado

#### Scenario: Alta de alumno
- **WHEN** se completa un DNI, nombre, email y teléfono de un alumno cuyos datos no están registrados
- **THEN** el alumno se crea en el padrón con `tipo_documento = DNI`

#### Scenario: Documento de alumno duplicado
- **WHEN** se intenta registrar un alumno con un DNI ya registrado
- **THEN** el sistema rechaza el alta e informa que el documento está repetido. **La historia pide mostrar el alumno existente**; esta entrega solo nombra el campo repetido, y esa desviación queda pendiente de aprobación

#### Scenario: Alumno del exterior sin DNI
- **WHEN** se intenta dar de alta un alumno con pasaporte y sin DNI, y con un email no registrado
- **THEN** **Diferido a la HU 47.** El esquema admite el pasaporte y el documento nulo, pero el contrato de esta entrega acepta solo DNI, así que el alta no se puede intentar

#### Scenario: Email con formato inválido
- **WHEN** se intenta guardar un docente o un alumno con un email de formato incorrecto
- **THEN** el sistema rechaza el alta e indica el error de formato. La regla del alumno se aplica a través de la capability `padron-alumnos`, que reutiliza la misma validación del alta de docente
