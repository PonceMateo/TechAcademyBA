# Spec Delta

## ADDED Requirements

### Requirement: Horarios de cursada por comisión

El sistema SHALL almacenar el horario de cursada de una comisión en filas estructuradas, una por
día de la semana, con el día, la hora de inicio y la hora de fin. Cada comisión SHALL tener como
mucho **una fila por día**, y el horario de cada fila SHALL terminar después de empezar. Los
minutos de inicio y de fin SHALL ser múltiplos de 15, y las horas SHALL estar entre 6:00 y 22:00.

`comision.dias_horarios` SHALL permanecer como columna de texto, pero desde este change su valor
SHALL ser **derivado** de las filas de horarios: la fuente de verdad son las filas, y el texto se
regenera cada vez que se guardan los horarios. Las comisiones cuyo texto la migración no pudo
interpretar SHALL conservar ese texto y SHALL quedar sin filas de horarios, hasta que el operador
cargue sus horarios con el selector de la pantalla de comisión.

La migración que crea la tabla SHALL ser reversible: el downgrade SHALL eliminar las filas de
horarios sin tocar `comision.dias_horarios`, de modo que cada comisión conserve su texto. La
conversión de los textos existentes SHALL ser defensiva: un texto que no se pueda interpretar SHALL
quedar sin filas, conservando su contenido original, y ningún dato del Excel del cliente SHALL
entrar en la conversión.

#### Scenario: Una comisión con sus horarios estructurados
- **WHEN** se guarda una comisión con lunes de 19:00 a 21:00 y miércoles de 19:00 a 21:00
- **THEN** quedan dos filas de horarios y el texto `dias_horarios` de la comisión muestra el resumen derivado de esas filas

#### Scenario: Un solo horario por día
- **WHEN** se intenta guardar dos horarios para el mismo día de la semana
- **THEN** la base rechaza el segundo

#### Scenario: El fin no puede quedar antes del inicio
- **WHEN** se intenta guardar un horario cuyo fin no es estrictamente posterior a su inicio
- **THEN** la base rechaza el valor

#### Scenario: Minutos fuera de los pasos de 15 minutos
- **WHEN** se guarda un inicio o un fin cuyos minutos no son 0, 15, 30 ni 45
- **THEN** la base rechaza el valor

#### Scenario: La migración convierte los textos existentes
- **WHEN** se aplica la migración sobre comisiones cuyo texto de horarios se puede interpretar, por ejemplo «Lunes y miércoles 18:00 a 20:00»
- **THEN** cada texto se convierte en una fila por día con su rango, y el texto original queda sin cambios en `dias_horarios`

#### Scenario: Un texto que no se puede interpretar
- **WHEN** la migración encuentra un texto sin rango horario, por ejemplo «Sábados intensivo»
- **THEN** esa comisión queda sin filas de horarios, conserva su texto y sigue listándose igual que antes

#### Scenario: El downgrade no pierde el texto
- **WHEN** se revierte la migración
- **THEN** desaparecen las filas de horarios y cada comisión conserva su `dias_horarios` original
