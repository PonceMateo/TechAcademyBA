# Spec Delta

## MODIFIED Requirements

### Requirement: Inscripciones con categoría arancelaria

El sistema SHALL almacenar una inscripción que vincule un alumno con una comisión, y la combinación alumno y comisión SHALL ser única. Cada inscripción SHALL tener una categoría arancelaria, un estado entre Activa, En espera, Baja y Completada y un importe arancelario calculado. La categoría SHALL tomar un valor entre Particular, Becado parcial, Becado total y Corporativo. WHEN la categoría sea Becado parcial, `porcentaje_beca` SHALL ser obligatorio y SHALL estar entre 1 y 99; en cualquier otra categoría SHALL ser nulo. WHEN la categoría sea Corporativo, la empresa asociada SHALL ser obligatoria y el importe SHALL provenir del contrato corporativo. Para una inscripción Particular o Becado parcial en una comisión con período válido, el importe SHALL calcularse con las clases restantes; en la beca parcial SHALL aplicarse el descuento después del prorrateo. La categoría Becado total SHALL implicar exención de pago (historias #14, #15 y #50).

#### Scenario: Inscripción única
- **WHEN** se inscribe un alumno en una comisión en la que ya está inscripto
- **THEN** el sistema rechaza la operación e informa que ya está inscripto

#### Scenario: Beca parcial con porcentaje válido
- **WHEN** se selecciona Becado parcial y se informa un porcentaje de descuento entre 1 y 99
- **THEN** el sistema guarda la categoría y el porcentaje, y el importe se calcula aplicando el descuento al importe prorrateado

#### Scenario: Porcentaje de beca fuera de rango
- **WHEN** la categoría es Becado parcial y el porcentaje está fuera del rango o no es numérico
- **THEN** el sistema rechaza el valor e informa el error

#### Scenario: Corporativo sin empresa
- **WHEN** se selecciona la categoría Corporativo sin asociar una empresa registrada
- **THEN** el sistema rechaza el guardado y solicita seleccionar la empresa

#### Scenario: Beca total exenta
- **WHEN** una inscripción tiene categoría Becado total
- **THEN** el sistema la registra como exenta de pago sin requerir imputación de cobros

#### Scenario: Alta antes del inicio
- **WHEN** se crea una inscripción Particular o Becado parcial en la fecha de inicio o antes
- **THEN** el importe base corresponde al arancel completo de la comisión antes de aplicar una eventual beca

#### Scenario: Alta tardía prorrateada
- **WHEN** se crea una inscripción Particular en una comisión iniciada, con período válido y clases restantes
- **THEN** el importe persistido es el arancel multiplicado por clases restantes y dividido por clases totales, redondeado a centavos

#### Scenario: Beca parcial tardía
- **WHEN** se crea una inscripción Becado parcial en una comisión iniciada
- **THEN** el sistema prorratea el arancel base por clases restantes y luego aplica el porcentaje de beca

#### Scenario: Comisión sin período prorrateable
- **WHEN** se intenta una inscripción que requiere prorrateo y la comisión no tiene período válido o no tiene clases computables
- **THEN** el sistema rechaza la operación con un mensaje que informa que no se pudo calcular el importe
