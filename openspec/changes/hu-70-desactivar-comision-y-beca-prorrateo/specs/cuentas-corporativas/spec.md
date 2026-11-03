# Spec Delta

## MODIFIED Requirements

### Requirement: Carga de nómina corporativa

WHEN una empresa contrata un curso formal y carga empleados, el sistema SHALL crear una
inscripción por empleado con categoría arancelaria `CORPORATIVO`, asociada a la empresa y a la
comisión contratada. La carga SHALL NOT solicitar ni aceptar una categoría de beca ni un porcentaje
de beca. WHEN la comisión esté `Finalizada` según su `fecha_fin`, el sistema SHALL rechazar la carga
con `422` e informar que la comisión ya finalizó, sin crear ninguna inscripción.

#### Scenario: Empleados clasificados como corporativos
- **WHEN** una administración carga una nómina para una empresa y una comisión de curso formal
- **THEN** cada inscripción creada tiene categoría `CORPORATIVO`, referencia a la empresa y porcentaje de beca nulo

#### Scenario: La interfaz no ofrece becas
- **WHEN** se abre el formulario de carga de nómina
- **THEN** el formulario solicita los datos del empleado, pero no muestra selector de beca ni porcentaje de descuento

#### Scenario: Rechazo de datos de beca
- **WHEN** una solicitud de carga de nómina intenta informar una categoría o porcentaje de beca
- **THEN** el sistema rechaza la solicitud por no corresponder al flujo corporativo

#### Scenario: Nómina sobre una comisión finalizada
- **WHEN** se carga una nómina para una comisión cuya `fecha_fin` es anterior a hoy en `America/Argentina/Buenos_Aires`
- **THEN** el sistema responde `422`, informa que la comisión ya finalizó y no crea ninguna inscripción ni modifica la nómina existente
