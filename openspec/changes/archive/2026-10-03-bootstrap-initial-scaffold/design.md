# Design

## Context

El repositorio tenía un único commit con documentación y ningún código. No había `.opencode/`, ni `AGENTS.md`, ni tooling de proyecto. OpenSpec se inicializó en este change con `openspec init --tools opencode --language es`, que creó `openspec/`, `openspec/config.yaml` y los comandos `/opsx-*`. El comando de propuesta de este proyecto es **`/opsx-propose`**.

Fuentes revisadas, **en orden de autoridad**:

1. **CSV de historias de usuario** — fuente de verdad de restricciones y del modelo. Las cuentas cierran: 18 Must = 44 PHU, 12 Should = 43 PHU, Must+Should = 30 HU / 87 PHU, + 8 Could = 19 PHU → 106, + 9 Won't = 46 PHU → 152. Las tres historias #45, #46 y #47 las agregó el equipo en la revisión de este change; todavía no tienen issue en GitHub.
2. **`Contextualizacion del problema.md`** — define el modelo de negocio que el sistema debe resolver.
3. **Maqueta PPTX** — define el alcance negociado y los dos caminos de MVP.
4. **Figma** — estructura de pantallas, jerarquía y estilo. Aporta cero datos.
5. **Excel del cliente (`Caso 6 Academia_Cursos_Datos_Alumnos.xlsx`)** — **es el problema, no la solución.** Ver abajo.

**Sobre el Excel.** Es el primer contacto del cliente y está mal hecho a propósito. Sirve para dos cosas únicamente: mostrar el tipo de dato que el sistema tiene que sostener, y mostrar el tipo de ambigüedad que hay que resolver. **Un objetivo del proyecto es deshacerse de ese Excel**, así que no puede ser la fuente de verdad del modelo: si el modelo copiara su forma, estaríamos construyendo el mismo problema con más filas. Por eso los campos que las historias exigen y el Excel no tiene (el CUIL del docente, el motivo de un comprobante) se agregan igual, y los que el Excel tiene y las historias no piden no se modelan.

Los datos que muestra el maquetado son **placeholders**. No son datos de negocio: la secretaría carga los reales cuando el sistema esté funcional. Se usan valores reconocibles para que el cliente se ubique, y donde la planilla aporta un caso que vale la pena mostrar, se conserva.

- **Backlog en GitHub:** `gh` está instalado y autenticado con los scopes `project` y `repo`. Los 44 issues de las historias originales existen, titulados `H/U N · Título`, y sus etiquetas de épica coinciden con las 8 épicas del CSV. Se leyó; **no se recreó ni reimportó ningún issue**. Las historias #45 a #47 quedaron solo en el CSV.
- **Enunciado del TP integrador:** es la consigna del caso de estudio y describe la operatoria desde la voz del cliente.
- **Enunciado general de PPP 1:** consigna común a todos los grupos de la materia; no todo lo que pide aplica. Ver abajo.
- **Stack:** Python 3.12, PostgreSQL 16, React sin TypeScript. Fijos por decisión del equipo.

Dos aclaraciones de alcance que vienen del equipo y evitan malas lecturas:

1. El **enunciado general de PPP 1 es una consigna común a todos los grupos** de la materia, así que no todo lo que pide aplica a este proyecto. En particular la exigencia de migrar y limpiar los datos históricos **se puede postergar y hacer a mano una vez terminado el MVP**: el equipo decidió que no es prioridad ahora. Queda anotada acá para que nadie la lea como pendiente de este change.
2. El **equipo son 3 personas**. La planificación temporal de la maqueta PPTX la maneja el equipo y no es criterio de este diseño.

Restricción que condiciona todo: **el camino de alcance todavía no está decidido**. El scaffold debe servir para el MVP 1 original (Must+Should, 28 HU) y para el alternativo (solo Must, 18 HU) sin cambios de estructura.

Los requisitos normativos están en los specs. Este documento explica el **cómo** y el **por qué**.

## Goals / Non-Goals

**Goals:**

- Que el repositorio sea levantable con un solo comando y que un compañero nuevo lo tenga funcionando en menos de diez minutos (requisito del Hito 0 académico).
- Que el login sea real de punta a punta y que los tres shells sean navegables con datos de ejemplo.
- Que el modelo de datos tolere las HU Must y Should completos aunque la lógica llegue después, y que no haya que rediseñar nada cuando llegue `Cuota`.
- Que la separación mock/API del frontend sea una frontera real, no una convención: cambiar la fuente de datos no debe tocar componentes.
- Dejar escrito el flujo de trabajo del equipo antes de que empiece el desarrollo.

**Non-Goals:**

- No se implementa ninguna HU. Las historias se maquetan y se soportan en el modelo, nada más.
- No se construye la regla automática de habilitación, ni CRUD de dominio, ni pasarela de pago, ni certificados, ni notas, ni liquidación de docentes.
- No se elige proveedor de correo ni se envía correo real.
- No se importa ni sanea el Excel histórico: el equipo decidió hacerlo a mano al final del MVP.
- No se define el esquema de cuotas ni el de cobro.
- No se define el modelo de cuentas corporativas más allá de lo que las historias #18, #19 y #20 necesitan: el equipo va a hablarlo con el cliente antes de cerrarlo.
- No se despliega. No hay i18n: la UI es es-AR y la base de strings no se extrae.

## Decisions

### D1 — Backend por capas, con una responsabilidad por directorio

`app/core` (configuración, seguridad, dependencias), `app/models` (SQLAlchemy), `app/schemas` (Pydantic v2), `app/api` (rutas) y `app/services` (reglas de negocio). La lógica de negocio vive en `services`, nunca en las rutas.

*Por qué:* las historias #23 (imputar un pago repartido) y #27 (regla de habilitación) son reglas con criterios de aceptación densos. Si viven en los routers, van a terminar duplicadas cuando lleguen las HU que las consumen.

*Alternativas consideradas:* arquitectura por feature vertical, un directorio por HU. Se descartó porque con un equipo de tres genera gran cantidad de archivos pequeños y hace más difícil ver el dominio de un vistazo.

### D2 — JWT stateless y dependencias de autorización reutilizables

Login por email y contraseña contra hash bcrypt, JWT con el `rol` como claim, y una dependencia tipo `require_roles(ADMIN, DOCENTE)` reutilizable. Sin estado de sesión en servidor.

*Por qué:* el token tiene que viajar al frontend, y el estado de sesión no aporta nada acá: no hay logout global, no hay revocación por token, y `must_change_password` se lee de la base en cada login.

*Alternativas consideradas:* sesiones con cookie. Se descartó porque obligaría a configurar CORS con credenciales y manejo de cookies desde Vite en desarrollo, sin ganancia en esta etapa. Si más adelante hace falta revocar tokens, el cambio es agregar una lista de revocación o pasar a cookies; la dependencia de autorización no cambia.

### D3 — Tres roles: Administración, Docente, Alumno

Un rol por sección de la aplicación, sin más. Administración y Secretaría son **un mismo rol**, `ADMIN`, que la UI etiqueta "Secretaría". El prototipo lo refuerza: el pie del shell de administración dice `Secretaria BA`.

*Resuelto con el cliente:* en la entrevista quedan tres secciones (alumnos, profesores, secretaría). No hay un cuarto rol para el personal administrativo y contable que la transcripción menciona al pasar.

### D4 — `Usuario` como identidad única, con vínculos opcionales

`usuario` tiene `rol`, `email` único, `password_hash`, `must_change_password`, `is_active` y dos FKs nulas: `docente_id` y `alumno_id`. Un CHECK valida la correspondencia: `ADMIN` no tiene ninguno; `DOCENTE` tiene docente y no alumno; `ALUMNO` tiene alumno y no docente.

*Por qué:* el login es por email, y tanto el alta de docente (#9) como la de alumno (#13) generan credenciales. Con dos tablas de identidad separadas habría que duplicar el login o agregar una tabla puente igual de compleja.

*Alternativas consideradas:* una tabla de credenciales por rol. Se descartó porque obligaría a tres tablas de identidad y tres flujos de alta.

### D5 — Unicidad de email global, unicidad de documento por padrón

`usuario.email`, `docente.email` y `alumno.email` son únicos cada uno, lo que garantiza unicidad global de email entre los tres padrones. `docente.dni` es único dentro del padrón de docentes y `alumno.documento` dentro del padrón de alumnos; los documentos **no** son únicos de forma cruzada entre padrones.

*Por qué:* el login es por email, así que la identidad debe ser globalmente única. En cambio, un mismo DNI puede aparecer como docente y como alumno (un profesor que cursa), y las historias #9 y #13 hablan de unicidad "del docente" y "del alumno", no del sistema.

*Consecuencia:* si el cliente confirma que nadie puede ser docente y alumno a la vez, hay que agregar unicidad cruzada. Es una migración de una línea.

### D6 — Columnas normalizadas para las unicidades tolerantes a formato

Para `curso` se guardan `codigo` y `nombre` (valor mostrado) más `codigo_norm` y `nombre_norm` con índice único. La normalización es mayúsculas, sin acentos y solo alfanuméricos. Igual para `empresa.cuit_norm` y para los documentos, que se almacenan solo con dígitos y se formatean al presentar.

*Por qué:* la historia #1 exige que `CUR-101` y `CUR101` colisionen, y el Excel tiene exactamente ese caso duplicado. Un índice único sobre la columna cruda no lo logra. Guardar solo el valor normalizado resolvería, pero se perdería el valor tal como lo escribe el operador, que es lo que hay que mostrar.

*Alternativas consideradas:* índice único funcional sobre `upper(regexp_replace(...))`. Funciona en PostgreSQL, pero es opaco, no se reutiliza entre tablas y no se consulta desde el ORM con facilidad. Se eligió la columna normalizada mantenida por la capa de servicio, que además es testeable en aislamiento.

### D7 — `Imputacion` con destino único, preparada para `Cuota`

`imputacion` tiene `cobranza_id`, `monto` y dos FKs nulas: `inscripcion_id` y `empresa_id`. CHECK `num_nonnulls(inscripcion_id, empresa_id) = 1`.

*Por qué:* una cobranza se reparte entre varios alumnos y también puede imputarse a una empresa (#23). Cuando llegue `Cuota`, se agrega `cuota_id` nula y se relaja el CHECK a `num_nonnulls(inscripcion_id, empresa_id, cuota_id) = 1`. Ambas son migraciones aditivas que no rompen datos ni referencias.

*Alternativas consideradas:* tabla por tipo de imputación. Rechazada: tres tablas y tres rutas de escritura para un caso con dos destinos. Polimorfismo con `destino_tipo` y `destino_id` sin FK: rechazada porque pierde la integridad referencial, que es lo que hace confiable el modelo.

### D8 — El saldo de una cobranza se valida en servicio, no en base

La regla "la suma de imputaciones no supera el importe" no puede expresarse como CHECK en PostgreSQL porque abarca filas de otra tabla.

*Por qué igual no se relaja:* se implementa en el servicio, dentro de una transacción, tomando la cobranza con `SELECT ... FOR UPDATE` antes de calcular el saldo. El lock de fila serializa las imputaciones concurrentes de la misma cobranza.

*Riesgo asumido:* si alguien escribe imputaciones por SQL directo o desde un proceso externo, la garantía no aplica. Se acepta: la regla se cubre con test y el acceso directo a la base es del equipo.

### D9 — El estado de habilitación se calcula, nunca se guarda

`inscripcion` **no** tiene columna de estado de habilitación. Lo que se guarda es `override_habilitacion`: estado forzado, motivo, usuario, fecha y un indicador de vigencia.

*Por qué:* la historia #27 exige recálculo automático sin intervención manual, y la #30 exige que quitar el forzado devuelva el estado al cálculo. Un estado persistido obliga a resincronizar sin parar y produce estados mentirosos. Ver D24: es exactamente el problema que el Excel ya sufre.

*Consecuencia para el maquetado:* como no hay endpoint que calcule, el estado y la causa viajan literales en los datos de ejemplo. El maquetado **no calcula** nada.

### D10 — Cantidades derivadas, no columnas

No se persisten `vacantes`, el saldo no imputado de una cobranza ni los totales de asistencia. Se derivan por consulta.

*Por qué:* las historias #6 y #23 exigen explícitamente que no exista recálculo manual. Una columna persistida se desincroniza apenas alguien inscribe.

*Trade-off:* recomputar en cada listado. A la escala declarada (8 alumnos, 10 comisiones) es irrelevante, y cuando no lo sea se agrega un índice o una vista materializada sin cambiar el contrato.

### D11 — `Cuota` queda fuera de la migración inicial

No se crea `cuota` ni ninguna tabla de esquema de cobro. Se registra como decisión pendiente.

*Por qué:* el equipo debe definir el esquema de cobro con el cliente antes de implementar la historia #27. Fijarlo ahora sería adivinar, y desarmar una migración aplicada es más caro que esperar.

*Consecuencias, y hay que ser honesto con esto:*

- La historia #27 **no es implementable** hasta que `Cuota` exista: su regla habla de "cuota vigente" y "cuota vencida".
- Las causas "cuota vencida" y "saldo pendiente" del maquetado son **texto de ejemplo**, no reglas.
- Queda abierta la definición del monto a cubrir por inscripción. Hoy se derivaría de `comision.arancel` e `inscripcion.porcentaje_beca`, pero si el arancel se edita (#4) cambia lo que "al día" significa.
- **Dato relevante:** el Excel ya usa el concepto. El cobro de Matías Fernández dice "Cuota 1 de 3 abonada" y su importe de $17.333 es exactamente un tercio de los $52.000 del arancel. El cliente ya razona en cuotas aunque el sistema todavía no las tenga.

### D12 — `Cobranza` con tres estados

`ACREDITADO`, `OBSERVADO`, `RECHAZADO`.

*Por qué:* la historia #24 solo ensaya dos estados, pero la #27 y la #40 nombran los tres. Un modelo de dos obligaría a mapear `RECHAZADO` sobre `OBSERVADO` y perderíamos una distinción que el cliente ya usa en su planilla ("pendiente de acreditación", "en duda").

*Trade-off:* la transición `OBSERVADO → ACREDITADO` no tiene historia propia. Se registra el estado actual con usuario y fecha; el historial completo queda en `audit_log`.

### D13 — La capa `src/services/` es la única frontera de datos del frontend

`src/services/` expone funciones asíncronas (`listarComisiones(): Promise<Comision[]>`). Los datos viven en `src/mocks/`. Una fábrica resuelve implementación mock o real según variable de entorno. Los componentes no importan mocks ni conocen la fuente.

*Por qué:* la diferencia entre un maquete que se tira y uno que se conserva está en esto. Si los componentes leen mocks de forma síncrona, el día que haya API hay que reescribir cada componente. Con esta frontera, cambiar la fábrica cambia **un** archivo.

*Trade-off:* un poco de ceremonia asíncrona en un maquetado sin backend. Se acepta: es el costo que compra la reutilización.

### D14 — Solo el login es real; el resto usa datos de ejemplo

El frontend hace exactamente una llamada de red: autenticar y leer la sesión.

*Consecuencias:* el cliente HTTP de la API queda deliberadamente mínimo; no se valida todavía la configuración de CORS para el resto de las rutas; y la tabla de ruteo ya queda en la forma final.

*Mitigación:* el servidor de desarrollo de Vite hace proxy de `/api` hacia el backend, de modo que más adelante no haya que cambiar de origen.

### D15 — Pruebas contra PostgreSQL real, nunca SQLite

`pytest` corre contra la base de `docker compose` o contra el service de GitHub Actions. Fixtures con motor a nivel de sesión y rollback por test.

*Por qué:* el modelo usa `num_nonnulls`, índices únicos sobre columnas normalizadas, CHECKs con `CURRENT_DATE` y columnas con zona horaria. SQLite no tiene nada de eso, así que una suite en SQLite pasaría y la migración fallaría después.

*Alternativas consideradas:* SQLite para tests rápidos. Rechazada explícitamente.

### D16 — Una migración inicial de Alembic, revisada a mano

Se autogenera desde los modelos y después se edita: Alembic **no emite** CHECK constraints ni índices sobre columnas normalizadas, así que hay que escribirlos a mano.

*Por qué dejarlo explícito:* es el paso donde más se cuelan errores silenciosos. Un autogenerate en verde no significa que la restricción de la historia #15 exista.

### D17 — `EmailService` con resultado explícito en lugar de excepción

Interfaz con una implementación de desarrollo que loguea. El envío devuelve un resultado con éxito o fallo y **no** lanza excepción, para que la operación de negocio que lo originó no se revierta.

*Por qué:* la historia #13 dice que si el alta se completó pero el mail falló, el alumno queda registrado y el administrador debe ser informado. Con excepciones, el `except` tendría que distinguir "falló el alta" de "falló el mail", que es exactamente la confusión que el criterio de aceptación quiere evitar.

*Decisión diferida:* el proveedor se elige por configuración en el change siguiente. La interfaz no cambia.

### D18 — El seed deja las tres cuentas demo sin cambio de contraseña pendiente

El modelo dice que las cuentas de docente y alumno nacen con `must_change_password = true`. El seed **excepción**: deja en `false` las tres cuentas de demostración.

*Por qué:* este change no implementa el cambio de contraseña. Si el seed marcara la cuenta como pendiente, el usuario caería en un flujo inexistente y no llegaría al shell, rompiendo el punto 2 de la Definition of Done. Es una concesión del entorno de demostración, no del modelo.

*Consecuencia:* la regla "nace con pendiente" queda sin probar de punta a punta acá. Se cubre con las historias #11 o #13.

### D19 — Cambios de código en el mismo idioma que el código

Reglas de nombres, UI en es-AR, entidades de dominio en español sin tildes.

*Por qué:* `Comision`, `Inscripcion` y `Cobranza` son el lenguaje del cliente, no una traducción. Forzar nombres en inglés obliga a un diccionario mental permanente entre el código y la HU que lo origina, en un proyecto cuya fuente de verdad son 44 historias en español. El glosario traduce hacia afuera.

### D20 — Los ítems Won't se muestran, no se esconden

Cada historia Won't tiene un ítem de navegación deshabilitado con la etiqueta "Próximamente", sin contenido detrás.

*Por qué:* el cliente necesita ver el alcance completo para decidir entre los dos caminos de MVP. Mostrar el hueco es más honesto que ocultarlo.

*Alternativas consideradas:* no renderizar el ítem. Se descartó porque el prototipo y el backlog no coinciden al 100% y el ítem deshabilitado documenta la diferencia.

### D21 — Trazabilidad por referencia, no por cierre

Cada HU maquetada se referencia con `Refs #N`. El PR usa `Closes #N` solo cuando la HU cumple **todos** sus criterios de aceptación.

*Por qué:* este change maqueta. Si cerráramos issues, el backlog mentiría sobre el estado real del producto.

### D22 — Los datos del maquetado son placeholders, no datos de negocio

El maquetado se muestra con valores de ejemplo. No son datos reales y no se los trata como tales: la secretaría carga los reales cuando el sistema esté funcional.

*Por qué:* el objetivo del proyecto es reemplazar el Excel del cliente, así que ningún conjunto de datos debería implica que ya se migró la información real. Al mismo tiempo, valores reconocibles ayudan a que el cliente se ubique y a detectar errores de criterio.

*Consecuencia:* un campo que las historias piden pero el Excel no tiene **se agrega igual**, con valor de ejemplo. El CUIL del docente es el caso: la historia #9 lo exige y por lo tanto va. Y un bloque que una historia pide no se elimina por falta de datos de ejemplo: el cronograma del alumno lo pide la historia #38, así que se muestra.

### D23 — El enum del dominio es la autoridad, no los rótulos del Excel

`Estado_Pago` en el Excel es texto libre: `Pagado total transferencia`, `Pagó 50% por beca`, `Abonó 100% transferencia`, `Cuota 1 de 3 abonada`, `Becada 100%`, `Cheque a 30 días`, `Pendiente de acreditacion`, `Pagado por Paypal`, `No pago`, `Transferencia ok`, `En duda (debe la mitad)`. Ninguno es un estado del dominio.

El modelo define `ACREDITADO`, `OBSERVADO` y `RECHAZADO`, y el Excel se lee contra esa definición. `Pendiente de acreditacion` y `En duda` mapean a `OBSERVADO`.

*Por qué:* el enum es lo que las historias necesitan para que la regla de habilitación sea decidible. Si el modelo copiara los rótulos del Excel, la historia #27 no se podría escribir. Y copiar el texto libre sería construir el mismo problema con más filas.

*Consecuencia:* el mapeo Excel → dominio es parte del trabajo de carga posterior, no de este change.

### D24 — El Excel persiste el estado de habilitación, y por eso D9 no es opcional

`Habilitado_Link_Clase` en el Excel guarda `SI`, `NO - No pago`, `Pendiente de acreditacion` y `En duda (debe la mitad)`.

El dato más elocuente del archivo es la fila de Agustina Benítez: el estado dice "NO - No pago", cuando el motivo real es que mandó un comprobante borroso que no se lee. Con solo el estado guardado, nadie distinguiría "no pagó" de "no se pudo leer el comprobante". Es la misma celda vacía que el cliente describe en su primer mail.

*Por qué esto refuerza D9:* el problema que el cliente reporta no es que falte el estado, es que **el estado guardado miente**. Derivar el estado de la situación arancelaria, con la causa explícita, es lo que separa los dos casos.

### D25 — El Excel mezcla monedas; el modelo asume ARS

Hay un arancel en dólares (`U$S 50`) en la hoja de cursos y un pago en dólares (`U$S 75`, la transferencia internacional de Nicolás Castro) en la de cobros. El modelo usa pesos argentinos con precisión decimal, sin columna de moneda.

*Por qué:* agregar columna de moneda y tipo de cambio ahora es sellar una decisión de negocio que el cliente no tomó. El resto de los pagos siempre está en pesos.

*Riesgo:* si un pago en dólares queda registrado en pesos, la diferencia se pierde. Queda en *Decisiones pendientes*; no bloquea el MVP.

### D26 — `nomina_empleado` se ancla en el contrato, no en la empresa

El Excel muestra a Tech Solutions S.A. dos veces en el padrón de alumnos: "Grupo 5" para `Data Analytics con SQL` y "Grupo 2" para `Python Inicial`, con el mismo CUIT `30-71665544-9` escrito una vez con guiones y otra sin ellos. Son dos contrataciones distintas de la misma empresa, sobre cursos distintos.

*Por qué:* la empresa es una, los contratos son varios y cada contrato tiene su nómina. Anclar la nómina a la empresa mezclaría las dos tandas. Anclarla al contrato las separa, que es lo que la planilla muestra.

### D27 — El docente tiene CUIL, y es obligatorio

La historia #9 da de alta al docente con nombre, apellido, DNI, mail y teléfono. El CUIL no está en la historia, pero el instituto lo necesita para las liquidaciones (el DNI del enunciado menciona el "liquidador externo"), así que el modelo lo incluye como obligatorio.

*Por qué no en la historia y sí en el modelo:* el modelo es la oportunidad de agregar lo que el dominio necesita sin romper las historias. Un docente sin CUIL no se puede liquidar, y la historia #12 existe justamente para controlar los jornales. Agregarlo ahora cuesta una columna; agregarlo después significa una migración sobre una tabla que ya tiene datos.

*Consecuencia:* la pantalla `Docentes` muestra DNI, CUIL, email y teléfono. El CUIL tiene su propio escenario, porque es el campo que un usuario busca cuando necesita localizar a un docente para una gestión administrativa.

### D28 — La causa del comprobante no acreditado es obligatoria

Una cobranza Observada o Rechazada SHALL registrar por qué lo está, y la causa es obligatoria. La historia #24 marca el estado pero no pide el motivo, así que el equipo agregó la historia #45 para cubrirlo.

*Por qué igual va en el modelo:* sin la causa, un comprobante ilegible y una mora de tres meses producen el mismo estado, y la causa del bloqueo no se puede diferenciar. Ese es el problema central que el cliente describe en su primer mail, y con el campo se resuelve en la capa de datos en lugar de dejarlo para la historia #27.

*Consecuencia:* el equipo aprobó convertirlo en la historia **#45 Registrar causa del comprobante no acreditado** (Should, 3 PHU), que ya está en el CSV. Con esa historia, la #27 tiene la causa que mostrar.

### D29 — Se registra la factura B, además de la A

La factura B es la de consumidor final, o sea la del alumno particular. Se registra.

*Por qué:* la historia #25 y la HU #40 muestran la factura asociada al comprobante, y la mayoría de los comprobantes del instituto son de alumnos particulares. Registrar solo la A dejaría fuera el comprobante del caso más común. El costo es un valor más en un enum que ya existe.

*Alcance:* la historia #25 es Should y trata el seguimiento de la factura A de la empresa. Registrar la B es una extensión de esa historia, no una historia nueva.

### D30 — El alumno del exterior entra con pasaporte y sin DNI

El padrón admite alumnos sin DNI, con pasaporte. Los datos adicionales que requiere un alumno extranjero **no** se definen en este change: el equipo los va a discutir con el cliente, y la idea preliminar es que la administración de extranjeros no entra en el alcance.

*Por qué el resto sí:* el padrón tiene que poder alojar a un alumno que no tiene DNI porque el instituto lo inscribe. Negarse a admitirlos por un campo de identificación es peor que admitir el hueco.

*Consecuencia:* el modelo no hace obligatoria la presencia de documento, y el equipo aprobó la historia **#47 Alta de alumno del exterior** (Won't, 3 PHU), que ya está en el CSV. Su alcance se completa cuando el cliente defina los datos que exige un extranjero.

## Datos de ejemplo

Salen del Excel del cliente. Estos son los casos que el maquetado tiene que mostrar bien, porque son los que el cliente reconoce como sus problemas:

**La celda vacía (fila 8008).** Agustina Benítez, becada parcial 50% en Python Inicial, no tiene importe registrado y su detalle dice que mandó un comprobante borroso que no se lee. Es exactamente el dolor del cliente: no saber si la celda vacía significa que es becado o que es moroso. En el maquetado queda `BLOQUEADO` con causa `comprobante ilegible`, no `BLOQUEADO` sin causa ni "no pagó".

**El pagador que no es el alumno (fila 8008).** El titular es un familiar y el beneficiario es Agustina Benítez. El maquetado separa los dos roles en la pantalla de cobranzas.

**El pago dividido (fila 8002).** Camila Rodríguez es becada parcial 50% y abona $31.000 sobre un arancel de $62.000: la mitad, y aun así queda `ACREDITADO`.

**La empresa que paga (fila REC-8003).** Tech Solutions S.A. abonó $240.000 y se le emitió Factura A. El comprobante va a nombre de la empresa, no de un alumno.

**El cheque que no acreditó (fila 8006).** Banco Federal abonó $390.000 con cheque a 30 días, figura pendiente de acreditación, y además falta enviar la nómina de empleados. Queda `OBSERVADO` con causa `cheque pendiente de acreditación`.

**El saldo (fila 8010).** Valeria Rossi dejó una seña de $26.000 sobre un arancel de $52.000 y debe la mitad. Queda `OBSERVADO` con causa `debe saldo`.

**La empresa en el padrón de alumnos (filas 4, 7 y 11).** Dos empresas están cargadas como si fueran alumnos, con CUIT y email de RRHH. Es el problema que resuelven las historias #18 y #19.

**El alumno sin DNI (fila ALU-08).** Nicolás Castro no tiene DNI, es de Uruguay y paga por PayPal. Existe de verdad, así que el padrón tiene que tolerar la ausencia de documento, aunque la historia #13 pida DNI o pasaporte.

**Los becados.** El Excel distingue `Beca 50%`, `Beca Total 100%` y `Beca Estímulo 50%`. Las dos primeras son `BECADO PARCIAL` y `BECADO TOTAL` del modelo. `Beca Estímulo 50%` no es una categoría nueva: es un becado parcial con un motivo. El modelo no tiene campo de motivo de beca, y `docs/decisions.md` lo registra como pendiente.

## Riesgos / Trade-offs

- **El maquete se lee como producto terminado** → El badge "Próximamente", la ausencia de lógica y el `Refs #N` sin `Closes` son las señales. El README y el PR template lo dicen de forma explícita.
- **El modelo se diseña para 28 HU y se implementan 18** → Riesgo bajo: cada restricción de la tabla de entidades marca la historia que la origina. Si el camino alternativo se elige, lo que sobra son columnas y CHECKs de historias Should, no estructura.
- **Ajustar el modelo cuando llegue `Cuota`** → Mitigado por D7 y D11: la adición es una columna nula más un CHECK relajado. Si al definir `Cuota` aparece un concepto que no cabe en el destino único de `imputacion` — por ejemplo, un pago que cubre varias cuotas de varias inscripciones — ahí sí hay que revisar D7. Es el punto de mayor riesgo de rediseño de todo el change.
- **`arancel` editable cambia el histórico** → Con `Cuota` ausente, "al día" se derivaría del arancel vigente. Se resuelve junto con la definición de `Cuota`.
- **CI lenta por usar PostgreSQL real** → Mitigado con motor a nivel de sesión y rollback por test, sin recrear el esquema por test.
- **Acoplamiento del frontend a la forma del ejemplo** → Mitigado por D13: los datos de ejemplo se exponen con la misma forma que devolverá la API. Si un campo del ejemplo no va a existir en la API, el error aparece en el primer endpoint real, no después.
- **Bcrypt es lento por diseño** → En tests se usa el hash más barato permitido por la configuración, para no inflar la suite. Queda documentado en el `conftest.py`.
- **El README promete menos de 10 minutos** → Riesgo real si la primera corrida incluye `pip install` y `npm install` fríos. Se mide de verdad en la Definition of Done y no se da por cumplido hasta medirlo.

## Migration Plan

No hay despliegue en este change, así que la migración es solo de entorno de desarrollo.

1. `docker compose up -d` levanta PostgreSQL 16, backend y frontend.
2. Se aplica la migración inicial de Alembic sobre la base vacía.
3. Se ejecuta el seed idempotente.
4. Se inicia sesión con las tres cuentas demo.

**Rollback:** como el esquema se genera desde cero y no hay datos que preservar, el rollback es `docker compose down -v`, que descarta el volumen.

**Sobre el Excel histórico:** el equipo decidió cargarlo a mano una vez terminado el MVP, no antes. Este change no lo procesa. Cuando se haga, el trabajo real es el mapeo descrito en D23 y la limpieza de duplicados, y el modelo de este change está pensado para recibirlos (D6, D22, D26).

## Modelo de dominio

Derivado de los criterios de aceptación de las 47 HU. La columna de historia indica qué criterio obliga a cada restricción.

| Entidad | Campos clave | Restricciones | HU |
|---|---|---|---|
| `curso` | `codigo`, `codigo_norm`, `nombre`, `nombre_norm`, `descripcion`, `activo` | `UNIQUE(codigo_norm)`, `UNIQUE(nombre_norm)` | #1, #3 |
| `comision` | `curso_id`, `docente_id`, `codigo`, `dias_horarios`, `cupo_maximo`, `arancel`, `modalidad`, `sede_id`, `estado` | `UNIQUE(codigo)`; `CHECK cupo_maximo > 0`; `CHECK arancel > 0`; `CHECK (modalidad <> 'VIRTUAL' → sede_id IS NOT NULL)` | #2, #4, #5, #8 |
| `sede` | `nombre`, `direccion` | `UNIQUE(nombre)` | #8 |
| `docente` | `nombre`, `apellido`, `dni_norm`, `cuil`, `email`, `telefono` | `UNIQUE(dni_norm)`, `UNIQUE(cuil)`, `UNIQUE(email)`; `cuil` obligatorio (D27) | #9, #10, #11 |
| `alumno` | `nombre`, `documento_norm`, `tipo_documento`, `email`, `telefono` | `UNIQUE(documento_norm)`, `UNIQUE(email)`; documento puede ser nulo (D30) | #13, #16, #17 |
| `usuario` | `email`, `password_hash`, `rol`, `must_change_password`, `is_active`, `docente_id`, `alumno_id` | `UNIQUE(email)`; CHECK de correspondencia rol ↔ vínculo (D4) | #9, #13 |
| `empresa` | `razon_social`, `cuit_norm`, `requiere_factura_a` | `UNIQUE(cuit_norm)`, CUIT con formato y dígito verificador | #18, #20 |
| `contrato_corporativo` | `empresa_id`, `tipo`, `monto`, `estado` | `tipo ∈ {CHARLA, CURSO_FORMAL}` | #19 |
| `nomina_empleado` | `contrato_id`, `alumno_id` | `UNIQUE(contrato_id, alumno_id)` | #19 |
| `inscripcion` | `alumno_id`, `comision_id`, `categoria`, `porcentaje_beca`, `empresa_id`, `estado` | `UNIQUE(alumno_id, comision_id)`; `CHECK categoria = 'BECADO_PARCIAL' → porcentaje_beca BETWEEN 1 AND 99`; `CHECK categoria = 'CORPORATIVO' → empresa_id IS NOT NULL`; `porcentaje_beca IS NULL` si la categoría no es becado parcial | #14, #15 |
| `pagador` | `nombre`, `documento_norm` | Fuera del padrón de alumnos | #22 |
| `cobranza` | `fecha`, `importe`, `medio`, `origen`, `estado`, `causa`, `pagador_id`, `estado_cambiado_por`, `estado_cambiado_at` | `CHECK importe > 0`; fecha no futura; `causa` obligatoria si el estado no es acreditado (D28) | #21, #22, #24 |
| `imputacion` | `cobranza_id`, `inscripcion_id`, `empresa_id`, `monto` | `CHECK num_nonnulls(inscripcion_id, empresa_id) = 1`; `CHECK monto > 0`; suma ≤ importe validada en servicio (D8) | #23 |
| `factura` | `alumno_id`, `empresa_id`, `tipo`, `requerida`, `emitida`, `numero` | `tipo ∈ {A, B}`; sin seguimiento si `requerida = false` (D29) | #25 |
| `clase` | `comision_id`, `fecha`, `tema`, `link_virtual` | `link_virtual` nulo o URL válida | #33 |
| `asistencia` | `clase_id`, `alumno_id`, `estado` | `UNIQUE(clase_id, alumno_id)`; `estado ∈ {PRESENTE, AUSENTE}` | #34 |
| `override_habilitacion` | `inscripcion_id`, `estado_forzado`, `motivo`, `usuario_id`, `fecha`, `activo` | `CHECK motivo <> ''` | #30 |
| `audit_log` | `usuario_id`, `accion`, `entidad`, `entidad_id`, `detalle`, `created_at` | Solo agregado, inmutable | — |

Todas las entidades llevan `created_at` y `updated_at`. Los montos son `NUMERIC` en pesos argentinos. Las fechas y horas usan zona horaria `America/Argentina/Buenos_Aires`. `Cuota` no aparece, por D11.

**Lo que el Excel no tiene y el modelo sí exige:** el CUIL del docente (D27), el motivo de un comprobante no acreditado (D28), la factura B (D29) y el alumno sin DNI (D30). Van igual porque las historias o el dominio los piden, y el objetivo del proyecto es reemplazar esa planilla, no copiarla.

## Historias nuevas

El equipo pidió historias nuevas cuando aparecieran huecos reales. Se propusieron seis; el equipo revisó y **aprobó tres**, que ya están en el CSV como #45, #46 y #47. Las tres quedan **solo en el CSV**: todavía no tienen issue en GitHub.

| HU | Título | Épica | Prioridad | PHU | Por qué existe |
|---|---|---|---|---|---|
| **#45** | Registrar causa del comprobante no acreditado | 5- Cobranzas y Pagos | Should | 3 | La #24 marca el estado pero no pide el motivo. Sin causa, un comprobante ilegible y una mora son indistinguibles, que es el problema central del cliente. Es D28. |
| **#46** | Administrar sedes | 1- Catálogo de Cursos y Comisiones | Should | 2 | La #8 obliga a elegir una sede pero no hay historia para crearlas ni listarlas. Sin esta, la #8 no tiene de dónde sacar el valor. |
| **#47** | Alta de alumno del exterior | 3- Alumnos e Inscripciones | Won't | 3 | El padrón ya admite pasaporte sin DNI (D30), pero los datos que exige un extranjero no están definidos. Queda en Won't hasta que el cliente defina el alcance. |

### Historias descartadas

| Propuesta | Por qué no entró |
|---|---|
| Consultar la morosidad y el saldo por alumno | El equipo la descartó porque la #16 (Buscar alumno) ya muestra la ficha del alumno. |
| Administrar el ciclo de vida de una comisión | El equipo la descartó porque el #4 (Editar comisión) ya cubre los datos de la comisión. |
| Registrar el motivo o tipo de beca | El equipo la descartó porque cabe dentro de la #15 (Asignar categoría de cobro), que ya define las categorías y el porcentaje. |

**Nota sobre el saldo.** La #16 muestra la ficha con datos de contacto, comisión, categoría y estado de habilitación, pero **no el monto adeudado**. Si más adelante el equipo quiere que la ficha muestre el saldo, es una modificación de la #16, no una historia nueva.

**Nota sobre el estado de la comisión.** Ninguna historia Must ni Should necesita el estado de la comisión: la #7 bloquea inscripciones por cupo y la #2 la abre. Los siete estados que tiene la planilla del cliente no se modelan. Si aparece una historia que los necesite, se abre junto con ella.

## Desviaciones registradas respecto del prototipo

Resueltas a favor de las historias, anotadas acá y en los specs correspondientes.

| # | El prototipo | Lo que se hace | Por qué |
|---|---|---|---|
| 1 | El modal `Crear Nueva Comisión` no tiene modalidad ni sede | Se agregan `Modalidad` y `Sede`, con sede obligatoria solo para Presencial e Híbrido | Historia #8, Must |
| 2 | El detalle de comisión del docente no tiene dónde cargar el link | Se agrega `Link de la clase` con validación de URL, y deja de ser de solo lectura para ese campo | Historia #33, Must |
| 3 | El menú de administración no tiene `Docentes` | Se agrega la pantalla `Docentes` al `MENÚ OPERATIVO` | Historia #9, Must |
| 4 | La lista de espera aparece como texto en una alerta del Dashboard | Se deja como texto de ejemplo dentro de esa alerta, sin pantalla ni columna | Es una función real del cliente, **fuera de alcance** por decisión del equipo |
| 5 | `Periodo Lectivo 2025` | `Período Lectivo 2026` | Contexto del proyecto |
| 6 | El Dashboard no tiene HU | Datos de ejemplo estáticos, sin lógica ni agregación | No existe HU |
| 7 | `BLOQUEADO` nunca muestra la causa | La causa se muestra siempre que el estado es bloqueado | Historias #28 y #42 |
| 8 | `Forzar Bloqueo Manual` sin campo de motivo | Se agrega `Motivo` obligatorio | Historia #30 |
| 9 | La tarjeta de alumno bloqueado no ofrece ninguna acción | Se agrega la causa y una ruta a `Mis Pagos` | Historia #42 |
| 10 | `Medio de Pago` rotulado distinto en el select y en la tabla | Un solo juego de rótulos, tomado del enum del dominio | Consistencia |
| 11 | Columna `RESTRICCIONES` con contenido de conteos de acceso | Se renombra `ACCESO` | Corrección de inconsistencia |
| 12 | Botón de login full-width en una variante y compacto en otra | Un solo patrón de login | Consistencia |
| 13 | Nombres, códigos y fechas de ejemplo inventados | Reemplazados por valores derivados de la planilla del cliente, para que se ubique al verlos. **Todos siguen siendo placeholders** | D22 |
| 14 | Bloque `Próximos encuentros` con temas de clase | **Restaurado** como contenido de referencia | La historia #38 lo pide; la secretaría carga los reales después |
| 15 | `Clase 12 de 24` como avance de cursada | **Eliminado**: el cliente nunca declaró cuántas clases tiene el curso | No afirmar un avance que no está confirmado |

## Gaps detectados

### Resueltos con el equipo

1. **Roles.** Resuelto: son tres (alumnos, profesores, secretaría). Administración y Secretaría son el mismo rol.
2. **Lista de espera.** Es una función real, asociada al estado de la lista de espera. Fuera de alcance por ahora. Queda el texto de ejemplo en el Dashboard y nada más.
3. **Nota mínima de aprobación.** Pertenece a la historia #35, que es Won't. Fuera de alcance. A futuro, la idea es que cada profesor configure **su** nota de aprobación, no una global.
4. **Empresas que pagan una parte.** La entrevista lo resuelve: la empresa paga el 50%, el alumno la otra mitad, y se carga como becado parcial. Lo pendiente es **cómo se verifica que la empresa cubrió su parte**, que es la regla de la historia #27 y se resuelve cuando esa HU se implemente.
5. **Alumnos del exterior.** El padrón los admite con pasaporte y sin DNI (D30). Los datos adicionales que requiere un extranjero **no** se definen ahora: el equipo lo discute con el cliente y la idea preliminar es que la administración de extranjeros no entra en el alcance. Queda como historia propuesta F, en Won't.
6. **Migración del Excel histórico.** Se hace a mano al terminar el MVP. No es prioridad ahora.
7. **Planificación temporal.** Es del equipo y no es criterio de este diseño.
8. **COM-105 con dos docentes.** Era dato de relleno del Figma. Descartado.
9. **Enunciado de PPP 1.** Es consigna general de la materia; no todo lo que pide aplica.
10. **Factura B.** **Resuelto: se registra**, además de la A (D29). Es una extensión de la historia #25, que es Should.
11. **Datos de contacto de los docentes.** El Excel no los tiene, pero el modelo exige DNI, CUIL, email y teléfono (D27), y la pantalla `Docentes` los muestra. Los valores del maquetado son de ejemplo.
12. **Prioridad de las fuentes.** El Excel es el problema a resolver, no la fuente de verdad del modelo. Las fuentes autoritativas son el CSV de historias, la contextualización y el PPTX.

### Abiertos

13. **Moneda mixta.** Hay un arancel y un pago en dólares. El modelo asume pesos. **A definir con el cliente.**
14. **Los estados de comisión del Excel son siete y distintos entre sí:** `Abierta`, `En curso`, `Por iniciar`, `Cerrada por cupo`, `En dictado`, `Confirmada`, `Pocos cupos`. **No se modelan**: ninguna historia Must ni Should los necesita. Si aparecen, se abren junto con la historia que los exija.
15. **Motivo de la beca.** El cliente distingue una beca de convenio de una beca estímulo. **No se agrega historia**: el equipo lo encaja dentro de la #15, que ya define las categorías de cobro y el porcentaje.
16. **No hay columna de sede y la modalidad está fusionada con el horario.** La historia #8 exige modalidad y sede separadas. **Resuelto con la historia #46 (Administrar sedes)**, ya en el CSV.
17. **Cronograma y temas de clase.** La historia #38 los pide para el alumno, así que el maquetado los muestra como contenido de referencia. Pero no hay historia que los cargue: la historia #34 solo toma asistencia. **A definir.**
18. **La historia #36** (`Consultar seguimiento de clases dictadas`, Won't) no tiene pantalla ni lugar en el mapa pantalla→HU. Este change la agrupa en el ítem deshabilitado de `Notas y Certificación`.
19. **La historia #26** (acreditación automática, Won't) depende de la #44 (pasarela, Won't).
20. **La entrevista** dice que los empleados de una empresa "no son alumnos registrados nuestros", pero la historia #19 crea una inscripción por empleado. Manda la #19, porque es la especificación. El modelo sigue ambos caminos con el caso *charla corporativa* de la #19.
21. **La maqueta PPTX** rotula "44 Historias de Usuario / Total Relevadas" y "44 Puntos de Historia de usuario" sobre la misma cifra. La lectura correcta, confirmada contra el CSV, es **18 HU Must = 44 PHU**.

## Decisiones pendientes

Ninguna bloquea el scaffold. Las tres primeras cambian el comportamiento de una HU futura, no el esqueleto.

1. **Esquema de cuotas y de cobro.** Se define con el cliente antes de la historia #27. Bloquea la regla automática y la definición del monto a cubrir por inscripción.
2. **Proveedor de correo.** Se elige en el sprint siguiente. La interfaz de D17 no cambia.
3. **Camino de alcance** (Must+Should o solo Must). No cambia el scaffold.
4. **Moneda.** Hoy todo en pesos, pero el cliente tiene al menos un cobro en dólares. A definir con el cliente.
5. **Cronograma y temas de clase.** La #38 los muestra al alumno pero ninguna historia los carga. A definir.
6. **Datos que exige un alumno del exterior.** La #47 entra solo con pasaporte; los campos de residencia, visa y condición de migración se definen con el cliente.
7. **Digito verificador del CUIL.** El modelo exige el dato y lo hace único, pero no valida el dígito porque el equipo no lo pidió.

Resueltos en esta ronda y sacados de esta lista: la causa del comprobante (historia #45), las sedes (historia #46), el alumno del exterior (historia #47), el enum de estado de comisión y el motivo de la beca (ambos descartados por el equipo).

Resueltos en esta ronda y sacados de esta lista: los datos de contacto del docente (D27) y la factura B (D29).

## Open Questions

Se pueden responder más adelante sin cambiar los specs, el enfoque ni el breakdown de tareas.

- ¿`Comision.cupo_maximo` es editable una vez que la comisión tiene inscripciones activas? Si el cliente confirma que no, se puede agregar el CHECK en base y cerrar por el lado del cupo la regla de D8.
- ¿`estado` de `contrato_corporativo` es enum o tabla de estados con transición? Con enum es simple; tabla solo si el cliente necesita transiciones auditadas.
- ¿El `Pagador` se deduplica por documento o se crea un registro por cobranza? El prototipo sugiere que se busca por nombre, y la historia #22 no lo restringe.
- ¿`link_virtual` se valida solo como URL o además contra el dominio de la plataforma de videoconferencia? El prototipo menciona Zoom, pero el cliente también usa otras aulas.
- ¿El `usuario` de Administración lleva datos de contacto, o alcanza con email y nombre? El modelo solo exige email y nombre; el CUIL es del docente.
- ¿El CUIL se valida con su dígito verificador? El modelo lo exige como dato obligatorio y único, pero no valida el dígito porque el equipo no lo pidió. Si el cliente lo quiere validado, es un `@validar` en la entidad.
