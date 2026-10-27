# validacion-formularios Specification

## Purpose

Definir las reglas de validación compartidas de los formularios administrativos y su revalidación en
la API, para que la pantalla y el backend acepten y rechacen los mismos datos.

## Requirements

### Requirement: Teléfono E.164 en los formularios administrativos

El sistema SHALL ofrecer un control de teléfono con selector de país en el alta y la edición de
docentes y de alumnos. El selector SHALL incluir todos los países y SHALL iniciar en Argentina. El
valor que se envía a la API SHALL ser E.164 —un `+`, el código de país y los dígitos— o `null`
cuando el campo está vacío. El front SHALL rechazar antes de enviar cualquier valor que no sea
E.164 y SHALL mostrar el error en el campo. La API SHALL rechazar con `422` un teléfono que no sea
E.164.

Los valores existentes que se puedan interpretar como un teléfono SHALL normalizarse a E.164 al
abrir la edición. Los que no se puedan interpretar SHALL conservarse tal cual, sin aviso al cargar,
y SHALL exigir que se reingresen antes de guardar. No hay migración de los teléfonos guardados y el
perfil del alumno queda fuera de esta regla.

#### Scenario: Teléfono válido

- **WHEN** se ingresa un teléfono como `+54 9 11 1234-5678` en el alta o la edición de un docente o de un alumno
- **THEN** el formulario envía `+5491112345678`, la API lo acepta y lo guarda en E.164

#### Scenario: Teléfono vacío

- **WHEN** se guarda un formulario con el teléfono vacío
- **THEN** el formulario envía `null` y la API lo acepta como teléfono ausente

#### Scenario: Teléfono inválido en el formulario

- **WHEN** se ingresa un valor que no se puede interpretar como un teléfono, como `particular` o `000`
- **THEN** el formulario muestra el error en el campo y no envía la solicitud

#### Scenario: La API rechaza un teléfono que no es E.164

- **WHEN** llega a la API un teléfono que no tiene la forma E.164
- **THEN** la API responde `422` y no guarda el dato

#### Scenario: Teléfono legacy parseable

- **WHEN** se abre la edición de un docente o de un alumno cuyo teléfono guardado se puede interpretar, como `+54 11 4000-0001`
- **THEN** el control lo muestra normalizado y, si no se cambia, se guarda en E.164

#### Scenario: Teléfono legacy no parseable

- **WHEN** se abre la edición de un docente o de un alumno cuyo teléfono guardado no se puede interpretar
- **THEN** el control conserva el valor tal cual, no muestra un aviso al cargar y, si se intenta guardar sin reingresarlo, el formulario rechaza el envío y pide corregir el teléfono

#### Scenario: El selector de países

- **WHEN** se abre el control de teléfono
- **THEN** ofrece todos los países y arranca con Argentina seleccionada

### Requirement: Email compartido entre docentes y alumnos

El alta y la edición de docentes SHALL validar el email con la misma regla que el alta y la edición
de alumnos: algo antes de la arroba, una arroba y un dominio con al menos un punto que no termine en
punto. La regla SHALL aplicarse tanto en el front como en la API. Un email válido para un padrón
SHALL ser válido para el otro y uno inválido SHALL rechazarse igual en ambos.

#### Scenario: Email válido en ambos padrones

- **WHEN** se envía un email como `juan.perez@example.com` en un alta o edición de docente o de alumno
- **THEN** el formulario y la API lo aceptan y guardan tal como se informó

#### Scenario: Email inválido en ambos padrones

- **WHEN** se envía un email como `juan@`, `juan.perez`, `@example.com` o `juan@example.` en un alta o edición de docente o de alumno
- **THEN** el formulario muestra el error de formato y la API responde `422` si el valor llega

#### Scenario: Email vacío

- **WHEN** se envía un alta o una edición sin email o con el email vacío
- **THEN** el formulario y la API rechazan el dato e indican que el email es obligatorio

### Requirement: DNI compartido entre docentes y alumnos

El DNI del docente SHALL validarse con la misma regla que el DNI del alumno: 7 u 8 dígitos después de
quitar puntos, espacios y guiones, y SHALL NOT aceptar otros caracteres. La regla SHALL aplicarse
tanto en el front como en la API, y la API SHALL responder `422` cuando el DNI no cumpla.

#### Scenario: DNI con separadores

- **WHEN** se informa un DNI como `30.111.222`, `30 111 222` o `30-111-222` en un alta o edición de docente o de alumno
- **THEN** el formulario y la API lo aceptan y la API lo normaliza a sus dígitos

#### Scenario: DNI con letras

- **WHEN** se informa un DNI con letras
- **THEN** el formulario muestra el error y la API responde `422` si el valor llega

#### Scenario: DNI con longitud inválida

- **WHEN** se informa un DNI con menos de 7 dígitos o con más de 8
- **THEN** el formulario muestra que el DNI debe tener 7 u 8 dígitos y la API responde `422` si el valor llega

### Requirement: Cupo entero positivo en el alta de comisión

El alta de comisión SHALL rechazar un cupo máximo que no sea un entero positivo. El front SHALL
validar antes de enviar y SHALL mostrar «El cupo debe ser un entero positivo» cuando el valor sea
`1.1`, `5.3`, cero, negativo o vacío. La API SHALL responder `422` si un cupo no entero llega de
todos modos. La edición de comisión conserva la validación de entero positivo que ya tiene.

#### Scenario: Cupo decimal

- **WHEN** se ingresa `1.1` o `5.3` como cupo máximo en el alta de comisión
- **THEN** el formulario muestra «El cupo debe ser un entero positivo» y no envía la solicitud

#### Scenario: Cupo cero, negativo o vacío

- **WHEN** se ingresa un cupo máximo cero, negativo o vacío en el alta de comisión
- **THEN** el formulario muestra «El cupo debe ser un entero positivo» y no envía la solicitud

#### Scenario: Cupo entero válido

- **WHEN** se ingresa un cupo máximo entero y mayor que cero
- **THEN** el formulario envía la solicitud y la API acepta el alta

#### Scenario: La API rechaza un cupo no entero

- **WHEN** llega a la API un alta de comisión con un cupo máximo que no es un entero positivo
- **THEN** la API responde `422` y no crea la comisión

### Requirement: CUIL opcional en el contrato del docente

El alta y la edición de docente SHALL aceptar un `cuil` opcional. El CUIL SHALL tener 11 dígitos
después de quitar guiones. La API SHALL aceptar el prefijo `20`, `23`, `24` o `27` y SHALL exigir que
los 8 dígitos del medio coincidan con el DNI del docente, completado con ceros a la izquierda hasta
8 dígitos cuando el DNI tenga 7. La API SHALL NOT calcular ni validar el dígito verificador. El CUIL
SHALL guardarse en 11 dígitos y la respuesta SHALL devolverlo en ese formato; la tabla lo muestra
como `XX-XXXXXXXX-X`.

Un CUIL parcial SHALL rechazarse: si se informa el prefijo, el DNI o el verificador, SHALL exigirse
el CUIL completo. En `PUT /docentes/{id}`, omitir `cuil` SHALL conservar el CUIL actual y un `null`
explícito SHALL borrarlo. El alta sin CUIL SHALL guardar `null`.

#### Scenario: Alta sin CUIL

- **WHEN** se da de alta un docente sin informar `cuil`
- **THEN** la API crea el docente con `cuil` en `null` y la respuesta lo devuelve en `null`

#### Scenario: Alta con CUIL válido

- **WHEN** se da de alta un docente con un CUIL de 11 dígitos, con o sin guiones
- **THEN** la API lo acepta, lo guarda en 11 dígitos y lo devuelve en ese formato

#### Scenario: CUIL con dígito verificador incorrecto

- **WHEN** se informa un CUIL cuyos 11 dígitos tienen el prefijo permitido y los 8 dígitos del medio coinciden con el DNI, pero el dígito verificador no cierra el módulo 11
- **THEN** la API lo acepta y guarda el verificador informado, porque no calcula ni valida ese dígito

#### Scenario: El caso borde 10 no aplica

- **WHEN** el verificador informado es tal que un cálculo de módulo 11 daría 10
- **THEN** el sistema guarda el dígito informado; el caso 10 no se produce porque no hay cálculo automático

#### Scenario: CUIL parcial

- **WHEN** se informa solo el prefijo, solo el DNI o solo el verificador de un CUIL
- **THEN** el formulario muestra el error de CUIL incompleto y la API responde `422` si el valor llega

#### Scenario: Prefijo de CUIL no permitido

- **WHEN** se informa un CUIL con un prefijo distinto de `20`, `23`, `24` o `27`
- **THEN** la API responde `422` y no guarda el CUIL

#### Scenario: CUIL que no coincide con el DNI

- **WHEN** los 8 dígitos del medio del CUIL no coinciden con el DNI del docente
- **THEN** la API responde `422` y no guarda el CUIL

#### Scenario: DNI de 7 dígitos en el CUIL

- **WHEN** el DNI del docente tiene 7 dígitos y se informa un CUIL
- **THEN** la API completa el DNI con un cero a la izquierda para comparar los 8 dígitos del medio y acepta el CUIL si coincide

#### Scenario: Edición sin CUIL conserva el actual

- **WHEN** se envía un `PUT /docentes/{id}` sin el campo `cuil`
- **THEN** la API conserva el CUIL que el docente ya tenía

#### Scenario: Edición con CUIL en null lo borra

- **WHEN** se envía un `PUT /docentes/{id}` con `cuil` en `null`
- **THEN** la API borra el CUIL del docente

#### Scenario: Edición con CUIL nuevo

- **WHEN** se envía un `PUT /docentes/{id}` con un CUIL completo y válido
- **THEN** la API reemplaza el CUIL anterior por el nuevo

#### Scenario: La tabla muestra el CUIL con guiones

- **WHEN** la pantalla muestra un docente con CUIL guardado en 11 dígitos
- **THEN** lo muestra con la forma `XX-XXXXXXXX-X`

#### Scenario: El seed del docente queda coherente

- **WHEN** se carga el dato de ejemplo de Rita
- **THEN** su CUIL coincide con su DNI y no queda un CUIL fabricado que la edición vaya a rechazar

### Requirement: Controles del CUIL en el formulario del docente

El formulario de alta y edición de docente SHALL armar el CUIL con tres controles: un select de
prefijo con `20`, `23`, `24` y `27`; el DNI de solo lectura, completado con ceros a la izquierda
hasta 8 dígitos; y un verificador manual de un dígito. El select de prefijo SHALL arrancar vacío para
que el CUIL sea opcional. El verificador SHALL ser editable y SHALL aceptar un solo dígito. El
formulario SHALL enviar el CUIL completo en 11 dígitos o `null`, y SHALL rechazar un CUIL parcial.
Cambiar el DNI o el prefijo SHALL limpiar el verificador.

#### Scenario: Formulario sin CUIL

- **WHEN** se abre el alta de docente y no se elige prefijo ni se escribe verificador
- **THEN** el formulario envía `cuil` en `null`

#### Scenario: Formulario con CUIL completo

- **WHEN** se elige un prefijo, el DNI tiene 7 u 8 dígitos y se escribe un verificador de un dígito
- **THEN** el formulario envía el CUIL completo en 11 dígitos

#### Scenario: El DNI del CUIL es de solo lectura

- **WHEN** se escribe o se corrige el DNI del docente
- **THEN** la parte del DNI en el CUIL se actualiza sola y no se puede editar por separado

#### Scenario: El DNI de 7 dígitos se completa con cero

- **WHEN** el DNI del docente tiene 7 dígitos
- **THEN** la parte del DNI en el CUIL muestra 8 dígitos, con un cero a la izquierda

#### Scenario: Cambiar el DNI limpia el verificador

- **WHEN** se cambia el DNI de un formulario que ya tenía un verificador escrito
- **THEN** el verificador queda vacío

#### Scenario: Cambiar el prefijo limpia el verificador

- **WHEN** se cambia el prefijo de un formulario que ya tenía un verificador escrito
- **THEN** el verificador queda vacío

#### Scenario: CUIL parcial en el formulario

- **WHEN** se elige un prefijo pero no se escribe el verificador, o se escribe el verificador sin elegir el prefijo
- **THEN** el formulario muestra el error de CUIL incompleto y no envía la solicitud

#### Scenario: Abrir la edición de un docente con CUIL

- **WHEN** se abre la edición de un docente que tiene un CUIL guardado
- **THEN** el formulario toma el prefijo y el verificador del CUIL guardado y arma los 8 dígitos del medio con el DNI actual

#### Scenario: El CUIL guardado no coincide con el DNI actual

- **WHEN** el CUIL guardado tiene 8 dígitos del medio distintos de los del DNI actual
- **THEN** el formulario arma el CUIL con el DNI actual y, al guardar, la API recibe un CUIL coincidente y lo corrige

#### Scenario: Abrir la edición de un docente sin CUIL

- **WHEN** se abre la edición de un docente con `cuil` en `null`
- **THEN** el select de prefijo y el verificador arrancan vacíos
