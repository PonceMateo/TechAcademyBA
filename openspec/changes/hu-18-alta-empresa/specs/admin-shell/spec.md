# Spec Delta

## MODIFIED Requirements

### Requirement: Alumnos, categorías arancelarias y cuentas corporativas

The system SHALL mostrar el bloque `Padrón de Alumnos Regulares` con un campo de búsqueda de placeholder `Buscar por DNI o Nombre…` y una tabla cuyas columnas, con estos rótulos literales y en este orden, son `DNI`, `NOMBRE`, `EMAIL`, `COMISIÓN ASIGNADA`, `CATEGORÍA ARANCELARIA` y `ACCESO PLATAFORMA`. La columna `CATEGORÍA ARANCELARIA` SHALL mostrar `PARTICULAR` en gris, `BECADO PARCIAL` en violeta acompañado del porcentaje de descuento, `BECADO TOTAL` en magenta y `CORPORATIVO` en celeste. La columna `ACCESO PLATAFORMA` SHALL mostrar `HABILITADO` en verde o `BLOQUEADO` en rojo y, cuando el acceso esté bloqueado, SHALL mostrar la causa del bloqueo junto al estado.

Las filas del maquetado son, en este orden: Juan Ignacio Pérez, documento `38.456.789`, `juan.perez@gmail.com`, `CUR-101` Python Inicial, `PARTICULAR` y `HABILITADO`; Camila Rodríguez, documento `40.112.233`, `cami_rod@hotmail.com`, `CUR-102` Desarrollo Web Full Stack, `BECADO PARCIAL` con 50% de descuento y `HABILITADO`; Matías Fernández, documento `39.887.665`, `mati.fdez@yahoo.com.ar`, `CUR-104` Diseño UX/UI Avanzado, `PARTICULAR` y `HABILITADO`; Nicolás Castro, documento `Sin DNI (alumno exterior)`, `nicocastro_uy@gmail.com`, `CUR-106` Machine Learning Aplicado, `PARTICULAR` y `HABILITADO`; Agustina Benítez, documento `41.332.114`, `agus.benitez@gmail.com`, `CUR-101` Python Inicial, `BECADO PARCIAL` con 50% de descuento y `BLOQUEADO` por `comprobante ilegible`; y Valeria Rossi, documento `36.778.990`, `valerossi@gmail.com`, `CUR-104` Diseño UX/UI Avanzado, `PARTICULAR` y `BLOQUEADO` por `debe saldo`. La columna `DNI` SHALL renderizar el documento exactamente como lo registra el cliente, incluido el texto `Sin DNI (alumno exterior)` del alumno de Uruguay. Los dos accesos bloqueados del maquetado son los dos casos que el cliente tiene sin resolver y ninguno se corrige por la interfaz.

La misma pantalla SHALL mostrar el bloque `Cuentas Corporativas Vinculadas` con una tabla cuyas columnas, en este orden literal, son `RAZÓN SOCIAL`, `CUIT`, `PREFERENCIA FACTURA` y `NÓMINA DE EMPLEADOS`, donde la preferencia de factura se renderiza como badge `A` o `B` a partir del indicador de necesidad de Factura A de la empresa. Las filas del maquetado son, en este orden: `Tech Solutions S.A.` con CUIT `30-71665544-9`, preferencia de factura `A` y nómina `Grupo 5 (Data Analytics) y Grupo 2 (Python Inicial), segunda tanda de empleados`; y `Banco Federal (Capacitaciones)` con CUIT `30-50001234-4`, preferencia de factura `A` y nómina `10 personas, falta enviar la nómina`. El alta de cuenta corporativa pertenece a esta misma pantalla y no a una pantalla separada de empresas: la acción `+ Nueva Empresa` SHALL abrir el modal `Nueva Empresa` con los campos `Razón Social`, `CUIT` y la casilla `Requiere Factura A`, con los botones `Cancelar` y `Guardar Empresa`. El modal SHALL NOT pedir nómina de empleados ni contrato: la nómina es la historia #19. Un alta aceptada SHALL agregar la empresa a la tabla; un alta rechazada SHALL dejar el modal abierto con el motivo tal como lo informa la fuente, y un alta duplicada SHALL mostrar la empresa existente que devuelve el backend.

#### Scenario: El usuario abre el padrón de alumnos
- **WHEN** un usuario de Secretaría abre `Alumnos e Inscripciones`
- **THEN** ve el bloque `Padrón de Alumnos Regulares` con el buscador `Buscar por DNI o Nombre…` y la tabla con las columnas `DNI`, `NOMBRE`, `EMAIL`, `COMISIÓN ASIGNADA`, `CATEGORÍA ARANCELARIA` y `ACCESO PLATAFORMA`, con las seis filas del maquetado

#### Scenario: El usuario revisa las categorías
- **WHEN** el usuario recorre la columna `CATEGORÍA ARANCELARIA`
- **THEN** encuentra `PARTICULAR` en gris, `BECADO PARCIAL` en violeta con su porcentaje de descuento visible, `BECADO TOTAL` en magenta y `CORPORATIVO` en celeste

#### Scenario: El usuario revisa los bloqueos reales
- **WHEN** el usuario mira las filas de Agustina Benítez y de Valeria Rossi
- **THEN** ve `BLOQUEADO` en rojo junto a las causas `comprobante ilegible` y `debe saldo`, respectivamente

#### Scenario: El usuario busca al alumno del exterior
- **WHEN** el usuario recorre la columna `DNI`
- **THEN** ve el valor `Sin DNI (alumno exterior)` en la fila de Nicolás Castro, tal como lo registra el cliente, sin un documento numérico inventado

#### Scenario: El usuario revisa las cuentas corporativas
- **WHEN** el usuario baja al bloque `Cuentas Corporativas Vinculadas`
- **THEN** ve las columnas `RAZÓN SOCIAL`, `CUIT`, `PREFERENCIA FACTURA` y `NÓMINA DE EMPLEADOS`, con `Tech Solutions S.A.` y `Banco Federal (Capacitaciones)` y el badge `A` de factura en ambas

#### Scenario: El usuario busca la nómina faltante
- **WHEN** el usuario lee la columna `NÓMINA DE EMPLEADOS`
- **THEN** ve que la fila de Banco Federal aclara que falta enviar la nómina y que la de Tech Solutions S.A. describe la segunda tanda de empleados

#### Scenario: La búsqueda no arroja resultados
- **WHEN** el usuario busca un DNI o un nombre que no existe en el padrón
- **THEN** el maquetado informa que no se encontraron resultados

#### Scenario: El usuario da de alta una empresa
- **WHEN** el usuario pulsa `+ Nueva Empresa`, completa razón social, un CUIT válido, marca o no `Requiere Factura A` y confirma
- **THEN** el modal se cierra y la empresa aparece en la tabla `Cuentas Corporativas Vinculadas` con su badge de preferencia de factura

#### Scenario: Razón social vacía en el alta
- **WHEN** el usuario confirma el alta sin razón social
- **THEN** el formulario no se envía e indica que la razón social es obligatoria

#### Scenario: El backend rechaza el alta
- **WHEN** el backend rechaza el alta, por ejemplo por un CUIT ya registrado o con dígito verificador inválido
- **THEN** el modal permanece abierto y muestra el motivo tal como lo devuelve la fuente, identificando la empresa existente cuando el rechazo es por duplicado
