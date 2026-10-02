# CONTEXTUALIZACIÓN DEL PROBLEMA

### “Sistema de Gestión de Alumnos, Pagos y Habilitación de Clases”

**Carrera:** Licenciatura en Sistemas **Materia:** Prácticas Pre-Profesionales 1 **Docentes:** Gustavo Siciliano, Marcelo Wolf, Santiago Cofman **Grupo:** 15 **Integrantes:**

- Santiago Torrens
- Agustín Torres Valenzuela
- Mateo David Ponce
## CONSIGNAS:

**1. Problema del cliente:** Identificación clara y precisa de la necesidad, dolor o fallo operativo que enfrenta la organización en el caso asignado.
**2. Posible solución funcional de sistemas:** Descripción de alto nivel de la solución propuesta desde la perspectiva de sistemas (enfoque 100% funcional, respondiendo a la premisa: "Un sistema que permita/haga...").
**3. Benchmarking (Relevamiento de mercado):** Investigación de soluciones de software existentes en el mercado que resuelvan el problema de forma total o parcial, analizando qué ofrecen actualmente.
**4. Propuesta de proyecto:** Definición del alcance inicial de la solución que desarrollarán, especificando los módulos principales que la compondrán en una primera etapa y identificando el valor agregado o factor diferencial frente a las alternativas relevadas.

## 1. Problema del cliente

TechAcademy BA es un instituto de capacitación profesional online que dicta cursos en vivo (modalidad sincrónica vía Zoom) de programación, diseño, marketing y datos. Toda la administración académica, el registro de admisiones, el seguimiento de pagos y la entrega de enlaces a las clases se gestiona mediante un único archivo de Excel compartido en la secretaría.

El uso de esta planilla como único soporte operativo ha provocado un colapso administrativo originado por las siguientes fallas:

- **Desacople entre el titular del pago y el alumno:** La mayoría de los pagos ingresan por transferencia bancaria o billeteras virtuales. En muchos casos, los comprobantes enviados por WhatsApp corresponden a cuentas de terceros (padres, familiares o cuentas bancarias de empresas) cuyos nombres y números de identificación no coinciden con los datos del alumno. La planilla no vincula la persona que paga con el estudiante que asiste.
- **Ambigüedad en el estado de cobro y de las becas:** Una celda de pago vacía en el Excel no tiene un significado unívoco: no permite distinguir si se trata de un alumno con morosidad exigible o de un estudiante con beca total eximido de pago. Tampoco existe un mecanismo para asentar pagos en cuotas, saldos pendientes o comprobantes observados (ilegibles o pendientes de validación).
- **Confusión estructural en las cuentas corporativas:** Cuando una empresa contrata un paquete cerrado para capacitar a su personal, la secretaría anota a la razón social de la empresa en la fila correspondiente a un alumno. Como resultado, se pierde el registro de la nómina real de empleados que asisten a la videollamada y se confunden los datos fiscales del cliente pagador con las identidades de los alumnos.
- **Falta de normalización en cursos y riesgo en el cupo técnico:** No existe un catálogo unificado de oferta académica. Un mismo curso se registra con múltiples variantes de nombre y código (por ejemplo: “Python Inicial”, “Py 101” y “Curso Python” con códigos CUR-101, CUR101 y 103). Esto imposibilita conocer la cantidad real de alumnos por comisión, impidiendo controlar el cupo disponible y generando el riesgo de superar el límite de capacidad de la sala de Zoom.
- **Control de accesos manual y discrecional:** Antes de cada clase o instancia de entrega de certificados, la secretaría revisa manualmente los movimientos bancarios para decidir a quién enviar el enlace de

acceso. Este método insume horas de trabajo y genera errores constantes: se

- bloquea a alumnos becados o que ya abonaron, y se permite el ingreso a personas con cuotas adeudadas.
TechAcademy BA necesita sustituir la planilla Excel por un sistema centralizado que ordene el catálogo de cursos, registre las inscripciones con sus nóminas correspondientes, asocie los pagos al legajo correcto y proporcione una visualización directa para habilitar o denegar el acceso a las clases sin ambigüedad.

## 2. Posible solución funcional de sistemas

#### Un sistema que permita:

- Mantener un catálogo centralizado y estandarizado de cursos y comisiones, asociando a cada una el docente a cargo, los días y horarios de cursada, el arancel correspondiente y el cupo máximo permitido según la capacidad de la sala virtual de Zoom.
- Controlar las vacantes disponibles en tiempo real por comisión, bloqueando nuevas altas cuando se alcanza el límite establecido.
- Registrar a los alumnos con sus datos de contacto (DNI/Pasaporte, nombre completo, email y teléfono), vinculándolos a una comisión determinada.
- Administrar cuentas corporativas, permitiendo cargar los datos fiscales de la empresa contratante (Razón Social, CUIT, necesidad de Factura A) y asociar la nómina individual de empleados que asistirán al curso.
- Tipificar la condición arancelaria de cada inscripción: *regular* (pago completo o cuotas), *becada parcial*, *becada total* o *corporativa*.
- Asentar comprobantes de pago desacoplando al pagador del beneficiario, permitiendo ingresar los datos del titular de la transferencia/depósito (nombre y CUIT/banco) e imputar el monto al legajo de uno o más alumnos o al paquete de una empresa.
- Registrar el estado de validez de cada pago (Acreditado / Observado) y dejar constancia administrativa de la emisión de Factura A cuando sea requerida.
- Determinar de forma automática la condición de habilitación del alumno mediante una regla de negocio binaria:
- **Habilitado:** alumno con pago acreditado, con cuota al día, becado total formalmente registrado o dependiente corporativo cubierto por paquete empresarial.

- **Bloqueado:** alumno con pago pendiente, cuota vencida, comprobante no válido o pendiente de nómina.
- Disponer de una interfaz administrativa simple que permita buscar a un estudiante por DNI o correo electrónico y visualizar de inmediato su estado mediante un indicador claro (verde / rojo), junto con la posibilidad de copiar la lista de correos habilitados para el envío manual del link de la clase.
## 3. Benchmarking (Relevamiento de mercado)

|Plataforma|Fortalezas|Limitaciones|
|---|---|---|
|Hojas de cálculo colaborativas (Excel / Sheets)|Herramienta accesible, flexible y de bajo costo. Permite carga rápida de texto libre sin requerimientos de instalación especializada.|Carece de integridad referencial. No valida duplicidad de cursos ni consistencia de formatos. No vincula alumnos de forma estructurada y delega la habilitación al control visual humano.|
|Plataformas de gestión escolar formal (Acadeu, Colegium)|Modelos robustos para seguimiento de legajos, cobro de aranceles regulares y comunicación institucional unificada. Cumplen con esquemas fiscales locales.|Concebidas para instituciones educativas formales de ciclo anual (jardín, primaria, secundaria). Su estructura de cursos y matrículas anuales es incompatible con cursos cortos y rotativos, y no contempla la gestión de clientes corporativos ni grupos cerrados de capacitación.|
|LMS con módulo de ventas (Teachable, Hotmart, Kajabi)|Automatizan el alta del usuario y habilitan el contenido una vez procesado el pago con tarjeta a través de sus propias pasarelas integradas.|Enfocadas en capacitaciones asincrónicas (videos pregrabados). Obligan a utilizar pasarelas de cobro con comisiones por venta, impidiendo la conciliación de transferencias bancarias directas de terceros. No permiten manejar nóminas empresariales externas ni becas sin cobro.|
|SGA / ERP para institutos y academias (aGora, CDS Academias)|Gestionan matrículas, cursos y estados de cuenta en academias privadas y centros de oficios. Soportan cobranza y seguimiento de deudores.|Diseñados para modelos administrativos tradicionales o estructuras institucionales medianas a grandes, resultando sobredimensionados en costo y|

#### Plataforma Fortalezas Limitaciones

complejidad burocrática para una secretaría reducida. Sus flujos de facturación y cobro son rígidos y no contemplan la conciliación ágil de transferencias bancarias de terceros informadas por mensajería, ni articulan de forma simple la venta de paquetes corporativos B2B asociados a nóminas de empleados para clases en vivo.

Las alternativas existentes en el mercado presentan una polarización que no resuelve la operatoria del cliente: o son plataformas cerradas de e-learning que obligan a usar pasarelas de pago transaccionales automáticas con altas comisiones, o son sistemas de gestión escolar/ERP sobredimensionados en complejidad y costo, orientados a la educación formal obligatoria.

Ninguna provee una interfaz ligera que resuelva en simultáneo la imputación de comprobantes manuales de terceros, la diferenciación entre empresa y empleado, y el control visual inmediato de habilitación para clases por videoconferencia.

## 4. Propuesta de proyecto

### Módulos de la primera etapa

1. **Módulo de Cursos y Comisiones:**
- ABM de cursos y apertura de comisiones con codificación y denominación unificadas.
- Asignación de docente, cronograma de días/horarios y valor del arancel.
- Definición de cupo máximo por comisión y cálculo automático de vacantes restantes según inscriptos confirmados, resguardando el límite de la sala de Zoom.
2. **Módulo de Alumnos e Inscripciones:**
- Padrón único de alumnos con validación de identificador (DNI/Pasaporte) y datos de contacto.
- Registro de Cuentas Corporativas: alta de la empresa (Razón Social, CUIT, contacto, solicitud de Factura A) y carga de la lista de empleados que conforman la nómina del curso.

- Inscripción a comisiones con asignación explícita de categoría: ■ Particular (arancel completo). ■ Becado parcial (porcentaje de descuento). ■ Becado total (exento de pago). ■ Corporativo (asociado al paquete de una empresa dada de alta).
3. **Módulo de Cobranzas:**
- Formulario de carga manual de pagos: fecha, importe, medio de pago y datos del comprobante.
- Campos diferenciados para identificar la cuenta de origen: permite registrar el nombre y CUIT del titular que transfirió (tercero, padre o empresa) e imputarlo al legajo del alumno correspondiente o a la cuenta de la empresa contratante.
- Estado de la transacción: marcado administrativo como *Acreditado* o *Rechazado/Ilegible*.
- Marca de control administrativo para registrar si la Factura A requerida por una empresa ya fue confeccionada.
4. **Módulo de Consulta y Habilitación de Accesos:**
- Panel unificado de búsqueda rápida por DNI, correo electrónico del alumno o CUIT de la empresa.
- Ficha resumen del estudiante que expone curso asignado, condición arancelaria y un indicador visual binario: ■ **Botón Verde (Habilitado):** Alumno particular con pago acreditado,
becado total con convenio registrado, o empleado corporativo

- perteneciente a una empresa con paquete cancelado.
■ **Botón Rojo (Bloqueado):** Alumno con pago ausente, comprobante

- rechazado o cuenta corporativa impaga.
- Herramienta para listar y copiar los correos de los alumnos habilitados de una comisión para el envío del link de Zoom.
### Valor agregado y factor diferencial

El valor diferencial de la propuesta radica en:

- **Resolución relacional del pago por terceros:** Permite a la secretaría asociar transferencias bancarias de cualquier pagador al alumno real en un único paso, sin requerir pasarelas de pago intermedias ni conciliaciones bancarias complejas.
- **Separación de la cuenta corporativa respecto del alumno:** Modela correctamente la venta de paquetes cerrados al exigir la nómina de empleados, asegurando que

cada persona que ingrese al Zoom tenga identidad y correo propios, mientras la

- facturación y cobranza quedan en la empresa.
- **Certeza operativa en el acceso:** Reemplaza la deducción manual sobre la planilla por una regla de habilitación determinística en pantalla, eliminando la ambigüedad entre morosidad y becas y garantizando que solo los alumnos regulares reciban el enlace.