# Spec Delta

## MODIFIED Requirements

### Requirement: Alumnos, categorías arancelarias y cuentas corporativas

The system SHALL mostrar el bloque `Padrón de Alumnos Regulares` con una acción
`+ Nuevo Alumno`, un campo de búsqueda de placeholder `Buscar por DNI o Nombre…`
**deshabilitado** con la leyenda `Próximamente`, y una tabla cuyas columnas, con estos
rótulos literales y en este orden, son `DNI`, `NOMBRE`, `EMAIL`, `COMISIÓN ASIGNADA`,
`CATEGORÍA ARANCELARIA` y `ACCESO PLATAFORMA`. La columna `CATEGORÍA ARANCELARIA` SHALL
mostrar `PARTICULAR` en gris, `BECADO PARCIAL` en violeta acompañado del porcentaje de
descuento, `BECADO TOTAL` en magenta y `CORPORATIVO` en celeste. La columna `ACCESO
PLATAFORMA` SHALL mostrar `HABILITADO` en verde o `BLOQUEADO` en rojo y, cuando el acceso
esté bloqueado, SHALL mostrar la causa del bloqueo junto al estado.

La acción `+ Nuevo Alumno` SHALL abrir un modal titulado `Nuevo Alumno` con los campos
`DNI`, `Nombre`, `Email` y `Teléfono`, en ese orden, y los botones `Cancelar` y `Guardar
Alumno`. El modal SHALL reutilizar el diseño y los componentes del modal de Docentes y
SHALL NOT modificar colores, tipografías, navegación ni estilos globales. El formulario
SHALL NOT pedir `tipo_documento`: esta entrega registra solo DNI.

WHEN el alta es exitosa, la pantalla SHALL cerrar el modal, mostrar un aviso con el nombre
del alumno e incorporar al padrón el alumno que devuelve la fuente. El aviso SHALL aclarar
que la cuenta de acceso se creó pero que las credenciales no se enviaron. WHEN el alta es rechazada, la
pantalla SHALL mantener el formulario abierto con lo que el operador completó y SHALL
mostrar el motivo que devuelve la fuente, sin confirmar el alta. WHEN la fuente no puede
registrar el alta, la pantalla SHALL fallar y SHALL NOT mostrar una confirmación.

Las filas del maquetado son, en este orden: Juan Ignacio Pérez, documento `38.456.789`,
`juan.perez@gmail.com`, `CUR-101` Python Inicial, `PARTICULAR` y `HABILITADO`; Camila
Rodríguez, documento `40.112.233`, `cami_rod@hotmail.com`, `CUR-102` Desarrollo Web Full
Stack, `BECADO PARCIAL` con 50% de descuento y `HABILITADO`; Matías Fernández, documento
`39.887.665`, `mati.fdez@yahoo.com.ar`, `CUR-104` Diseño UX/UI Avanzado, `PARTICULAR` y
`HABILITADO`; Nicolás Castro, documento `Sin DNI (alumno exterior)`,
`nicocastro_uy@gmail.com`, `CUR-106` Machine Learning Aplicado, `PARTICULAR` y `HABILITADO`;
Agustina Benítez, documento `41.332.114`, `agus.benitez@gmail.com`, `CUR-101` Python
Inicial, `BECADO PARCIAL` con 50% de descuento y `BLOQUEADO` por `comprobante ilegible`; y
Valeria Rossi, documento `36.778.990`, `valerossi@gmail.com`, `CUR-104` Diseño UX/UI
Avanzado, `PARTICULAR` y `BLOQUEADO` por `debe saldo`. La columna `DNI` SHALL renderizar el
documento exactamente como lo registra el cliente, incluido el texto `Sin DNI (alumno
exterior)` del alumno de Uruguay. Los dos accesos bloqueados del maquetado son los dos casos
que el cliente tiene sin resolver y ninguno se corrige por la interfaz.

En el modo por omisión, las filas SHALL ser las que devuelve `GET /alumnos`. WHEN un alumno
todavía no tiene inscripción, la fila SHALL mostrar `Sin comisión` en `COMISIÓN ASIGNADA`,
`—` en `CATEGORÍA ARANCELARIA` y `—` en `ACCESO PLATAFORMA`. La pantalla SHALL NOT inventar
una comisión, una categoría ni un estado de habilitación para completar la fila.

La misma pantalla SHALL mostrar el bloque `Cuentas Corporativas Vinculadas` con una tabla
cuyas columnas, en este orden literal, son `RAZÓN SOCIAL`, `CUIT`, `PREFERENCIA FACTURA` y
`NÓMINA DE EMPLEADOS`, donde la preferencia de factura se renderiza como badge `A` o `B`.
Las filas del maquetado son, en este orden: `Tech Solutions S.A.` con CUIT
`30-71665544-9`, preferencia de factura `A` y nómina `Grupo 5 (Data Analytics) y Grupo 2
(Python Inicial), segunda tanda de empleados`; y `Banco Federal (Capacitaciones)` con CUIT
`30-50001234-4`, preferencia de factura `A` y nómina `10 personas, falta enviar la nómina`.
El alta de cuenta corporativa pertenece a esta misma pantalla y no a una pantalla separada
de empresas.

#### Scenario: El usuario abre el padrón de alumnos
- **WHEN** un usuario de Secretaría abre `Alumnos e Inscripciones`
- **THEN** ve el bloque `Padrón de Alumnos Regulares` con la acción `+ Nuevo Alumno`, el buscador deshabilitado con `Próximamente`, y la tabla con las columnas `DNI`, `NOMBRE`, `EMAIL`, `COMISIÓN ASIGNADA`, `CATEGORÍA ARANCELARIA` y `ACCESO PLATAFORMA`

#### Scenario: El usuario abre el modal de alta
- **WHEN** el usuario pulsa `+ Nuevo Alumno`
- **THEN** se abre el modal `Nuevo Alumno` con los campos `DNI`, `Nombre`, `Email` y `Teléfono`, los botones `Cancelar` y `Guardar Alumno`, y ningún campo de tipo de documento

#### Scenario: Alta de alumno correcta
- **WHEN** el usuario completa DNI, nombre, email y teléfono de un alumno no registrado y pulsa `Guardar Alumno`
- **THEN** el modal se cierra, la pantalla muestra el aviso con el nombre del alumno y el padrón incorpora el alumno creado, y el aviso aclara que las credenciales no se enviaron

#### Scenario: Alta rechazada por dato duplicado
- **WHEN** la fuente rechaza el alta porque el DNI o el email ya están registrados
- **THEN** el modal sigue abierto con lo que el operador completó, muestra el motivo que devuelve la fuente y no confirma el alta

#### Scenario: Alta que no llega a la base
- **WHEN** la fuente no puede registrar el alta
- **THEN** la pantalla no muestra ninguna confirmación y muestra el motivo de la falla

#### Scenario: El formulario valida antes de enviar
- **WHEN** el usuario deja vacío el DNI, el nombre o el email, o informa un DNI que no tiene 7 u 8 dígitos o un email con formato inválido
- **THEN** el formulario muestra el error en el campo correspondiente y no envía el alta

#### Scenario: Alumno sin inscripción en la tabla
- **WHEN** el padrón devuelve un alumno que todavía no tiene inscripción
- **THEN** la fila muestra `Sin comisión` en `COMISIÓN ASIGNADA`, `—` en `CATEGORÍA ARANCELARIA` y `—` en `ACCESO PLATAFORMA`, sin inventar datos

#### Scenario: El buscador está deshabilitado
- **WHEN** el usuario intenta escribir en `Buscar por DNI o Nombre…`
- **THEN** el campo no filtra ni navega y muestra la leyenda `Próximamente`, porque la búsqueda es la historia #16

#### Scenario: La búsqueda no arroja resultados
- **WHEN** el usuario intenta buscar un DNI o un nombre que no existe en el padrón
- **THEN** el campo está deshabilitado, no filtra ni informa resultados y muestra la leyenda `Próximamente`. El escenario conserva el nombre de la regla anterior, que ya no aplica porque la búsqueda es la historia #16

#### Scenario: El usuario revisa las categorías
- **WHEN** el usuario recorre la columna `CATEGORÍA ARANCELARIA` con los datos de ejemplo
- **THEN** encuentra `PARTICULAR` en gris, `BECADO PARCIAL` en violeta con su porcentaje de descuento visible, `BECADO TOTAL` en magenta y `CORPORATIVO` en celeste

#### Scenario: El usuario revisa los bloqueos reales
- **WHEN** el usuario mira las filas de Agustina Benítez y de Valeria Rossi en los datos de ejemplo
- **THEN** ve `BLOQUEADO` en rojo junto a las causas `comprobante ilegible` y `debe saldo`, respectivamente

#### Scenario: El usuario busca al alumno del exterior
- **WHEN** el usuario recorre la columna `DNI` con los datos de ejemplo
- **THEN** ve el valor `Sin DNI (alumno exterior)` en la fila de Nicolás Castro, tal como lo registra el cliente, sin un documento numérico inventado

#### Scenario: El usuario revisa las cuentas corporativas
- **WHEN** el usuario baja al bloque `Cuentas Corporativas Vinculadas`
- **THEN** ve las columnas `RAZÓN SOCIAL`, `CUIT`, `PREFERENCIA FACTURA` y `NÓMINA DE EMPLEADOS`, con `Tech Solutions S.A.` y `Banco Federal (Capacitaciones)` y el badge `A` de factura en ambas

#### Scenario: El usuario busca la nómina faltante
- **WHEN** el usuario lee la columna `NÓMINA DE EMPLEADOS`
- **THEN** ve que la fila de Banco Federal aclara que falta enviar la nómina y que la de Tech Solutions S.A. describe la segunda tanda de empleados
