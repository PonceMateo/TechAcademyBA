# Decisiones técnicas

Registro de las decisiones técnicas **no funcionales** del proyecto. Cada
entrada tiene **fecha y autor**. Cuando la decisión es además una decisión de
OpenSpec —alcance, contrato, modelo— el detalle largo queda en el change y acá
va el índice.

El razonamiento completo está en
`openspec/changes/bootstrap-initial-scaffold/design.md`; este archivo es el
índice de **por qué**, no el lugar donde se discuten las alternativas.

**Cómo se agrega una entrada:** se registra **antes** de aplicar el cambio, no
después. Si además se corrige la causa raíz de un error, la corrección se
registra acá con su entrada propia.

---

## Bootstrap inicial (change `bootstrap-initial-scaffold`)

Las decisiones D1 a D21 son decisiones de diseño de este change, tomadas por el
equipo antes de escribir código. Los identificadores `D1`..`D21` son los mismos
que usa `design.md`, para poder citarlos desde cualquier lado sin ambigüedad.

### D1 — Backend por capas, con una responsabilidad por directorio

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `app/core` (configuración, seguridad, dependencias), `app/models`
  (SQLAlchemy), `app/schemas` (Pydantic v2), `app/api` (rutas) y `app/services`
  (reglas de negocio). La lógica de negocio vive en `services`, nunca en las
  rutas.
- **Por qué:** las historias #23 y #27 son reglas con criterios de aceptación
  densos. En los routers terminarían duplicadas cuando lleguen las HU que las
  consumen.
- **Alternativa descartada:** arquitectura por feature vertical, un directorio
  por HU. Con un equipo de tres genera muchos archivos chicos y esconde el
  dominio.

### D2 — JWT stateless y dependencias de autorización reutilizables

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** login por email y contraseña contra hash bcrypt, JWT con el `rol`
  como claim y una dependencia `require_roles(...)` reutilizable. Sin estado de
  sesión en servidor.
- **Por qué:** el token tiene que viajar al frontend. Acá no hay logout global,
  no hay revocación por token, y `must_change_password` se lee de la base en
  cada login.
- **Alternativa descartada:** sesiones con cookie, que obligarían a configurar
  CORS con credenciales y a manejar cookies desde Vite sin ganancia.

### D3 — Tres roles: Administración, Docente, Alumno

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** un rol por sección. Administración y Secretaría son **un mismo
  rol**, `ADMIN`, que la UI etiqueta "Secretaría".
- **Por qué:** en la entrevista quedan tres secciones (alumnos, profesores,
  secretaría). No hay un cuarto rol para el personal contable que la
  transcripción menciona al pasar. El prototipo lo refuerza con el pie
  `Secretaria BA`.

### D4 — `Usuario` como identidad única, con vínculos opcionales

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `usuario` tiene `rol`, `email` único, `password_hash`,
  `must_change_password`, `is_active` y dos FKs nulas: `docente_id` y
  `alumno_id`. Un CHECK valida la correspondencia: `ADMIN` no tiene ninguno;
  `DOCENTE` tiene docente y no alumno; `ALUMNO` tiene alumno y no docente.
- **Por qué:** el login es por email y tanto el alta de docente (#9) como la de
  alumno (#13) generan credenciales. Dos tablas de identidad obligarían a
  duplicar el login o a agregar una tabla puente igual de compleja.

### D5 — Unicidad de email global, unicidad de documento por padrón

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `usuario.email`, `docente.email` y `alumno.email` son únicos
  cada uno, lo que da unicidad global de email. `docente.dni` es único en el
  padrón de docentes y `alumno.documento` en el de alumnos; los documentos **no**
  son únicos de forma cruzada.
- **Por qué:** un mismo DNI puede aparecer como docente y como alumno (un
  profesor que cursa), y las historias #9 y #13 hablan de unicidad "del
  docente" y "del alumno", no del sistema.
- **Consecuencia:** si el cliente confirma que nadie puede ser docente y alumno
  a la vez, es una migración de una línea.

### D6 — Columnas normalizadas para las unicidades tolerantes a formato

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `curso` guarda `codigo` y `nombre` (lo que se muestra) más
  `codigo_norm` y `nombre_norm` con índice único. La normalización es
  mayúsculas, sin acentos y solo alfanuméricos. Igual para `empresa.cuit_norm`
  y para los documentos, que se guardan solo con dígitos y se formatean al
  presentar.
- **Por qué:** la historia #1 exige que `CUR-101` y `CUR101` colisionen, y el
  Excel tiene exactamente ese duplicado. Un índice único sobre la columna cruda
  no lo logra, y guardar solo el valor normalizado haría perder lo que el
  operador escribe, que es lo que hay que mostrar.
- **Alternativa descartada:** índice único funcional sobre
  `upper(regexp_replace(...))`. Funciona en PostgreSQL pero es opaco, no se
  reutiliza entre tablas y no se consulta desde el ORM con facilidad.

### D7 — `Imputacion` con destino único, preparada para `Cuota`

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `imputacion` tiene `cobranza_id`, `monto` y dos FKs nulas:
  `inscripcion_id` y `empresa_id`, con CHECK
  `num_nonnulls(inscripcion_id, empresa_id) = 1`.
- **Por qué:** una cobranza se reparte entre varios alumnos y también puede
  imputarse a una empresa (#23). Cuando llegue `Cuota` se agrega `cuota_id` nula
  y se relaja el CHECK: la adición no rompe datos ni referencias.
- **Alternativas descartadas:** una tabla por tipo de imputación (tres tablas y
  tres rutas de escritura para dos destinos) y polimorfismo
  `destino_tipo`/`destino_id` sin FK (pierde la integridad referencial).

### D8 — El saldo de una cobranza se valida en servicio, no en base

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** la regla "la suma de imputaciones no supera el importe" se
  implementa en el servicio, dentro de una transacción, tomando la cobranza con
  `SELECT ... FOR UPDATE` antes de calcular el saldo.
- **Por qué:** no se puede expresar como CHECK en PostgreSQL porque abarca filas
  de otra tabla. El lock de fila serializa las imputaciones concurrentes de la
  misma cobranza.
- **Riesgo asumido:** si alguien escribe imputaciones por SQL directo, la
  garantía no aplica. Se cubre con test y el acceso a la base es del equipo.

### D9 — El estado de habilitación se calcula, nunca se guarda

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `inscripcion` **no** tiene columna de estado de habilitación. Lo
  que se guarda es `override_habilitacion`: estado forzado, motivo, usuario,
  fecha e indicador de vigencia.
- **Por qué:** la historia #27 exige recálculo automático y la #30 que quitar el
  forzado devuelva el estado al cálculo. Un estado persistido obliga a
  resincronizar sin parar y produce estados mentirosos: es exactamente el
  problema que ya sufre el Excel del cliente.
- **Consecuencia para el maquetado:** como no hay endpoint que calcule, el
  estado y la causa viajan literales en los datos de ejemplo. El maquetado **no
  calcula** nada.

### D10 — Cantidades derivadas, no columnas

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** no se persisten `vacantes`, ni el saldo no imputado de una
  cobranza, ni los totales de asistencia. Se derivan por consulta.
- **Por qué:** las historias #6 y #23 exigen explícitamente que no exista
  recálculo manual. Una columna persistida se desincroniza apenas alguien
  inscribe.
- **Trade-off:** recomputar en cada listado. A la escala declarada (8 alumnos,
  10 comisiones) es irrelevante; cuando no lo sea se agrega un índice o una
  vista materializada sin cambiar el contrato.

### D11 — `Cuota` queda fuera de la migración inicial

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** no se crea `cuota` ni ninguna tabla de esquema de cobro. Se
  registra como decisión pendiente.
- **Por qué:** el esquema de cobro se define con el cliente antes de implementar
  la historia #27. Fijarlo ahora sería adivinar, y desarmar una migración
  aplicada es más caro que esperar.
- **Consecuencias, y hay que ser honesto con esto:** la historia #27 **no es
  implementable** hasta que `Cuota` exista, porque su regla habla de "cuota
  vigente" y "cuota vencida"; y las causas "cuota vencida" y "saldo pendiente"
  del maquetado son **texto de ejemplo**, no reglas.

### D12 — `Cobranza` con tres estados

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** los estados de `cobranza` son `ACREDITADO`, `OBSERVADO` y
  `RECHAZADO`.
- **Por qué:** la historia #24 solo ensaya dos estados, pero la #27 y la #40
  nombran los tres. Con dos, habría que mapear `RECHAZADO` sobre `OBSERVADO` y
  se perdería una distinción que el cliente ya usa en su planilla.
- **Trade-off:** la transición `OBSERVADO → ACREDITADO` no tiene historia propia.
  Se registra el estado actual con usuario y fecha; el historial queda en
  `audit_log`.

### D13 — La capa `src/services/` es la única frontera de datos del frontend

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `src/services/` expone funciones asíncronas. Los datos viven en
  `src/mocks/`. Una fábrica resuelve implementación mock o real según variable
  de entorno. Los componentes no importan mocks ni conocen la fuente.
- **Por qué:** la diferencia entre un maquete que se tira y uno que se conserva
  está acá. Si los componentes leen mocks de forma síncrona, el día que haya API
  hay que reescribir cada componente. Con esta frontera, cambiar la fábrica
  cambia **un** archivo.
- **Trade-off:** ceremonia asíncrona en un maquetado sin backend. Es el costo
  que compra la reutilización.

### D14 — Solo el login es real; el resto usa datos de ejemplo

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** el frontend hace exactamente una llamada de red: autenticar y
  leer la sesión.
- **Consecuencias:** el cliente HTTP de la API queda deliberadamente mínimo, no
  se valida todavía la configuración de CORS para el resto de las rutas, y la
  tabla de ruteo ya queda en su forma final.
- **Mitigación:** el servidor de desarrollo de Vite hace proxy de `/api` hacia
  el backend, de modo que más adelante no haya que cambiar de origen.

### D15 — Pruebas contra PostgreSQL real, nunca SQLite

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `pytest` corre contra la base de `docker compose` o contra el
  service de GitHub Actions. Fixtures con motor a nivel de sesión y rollback por
  test.
- **Por qué:** el modelo usa `num_nonnulls`, índices únicos sobre columnas
  normalizadas, CHECKs con `CURRENT_DATE` y columnas con zona horaria. SQLite no
  tiene nada de eso: una suite en SQLite pasaría y la migración fallaría
  después.
- **Alternativa descartada:** SQLite para tests rápidos. Rechazada explícitamente.

### D16 — Una migración inicial de Alembic, revisada a mano

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** la migración inicial se autogenera desde los modelos y después se
  edita a mano, porque Alembic **no emite** CHECK constraints ni índices sobre
  columnas normalizadas.
- **Por qué dejarlo explícito:** es el paso donde más se cuelan errores
  silenciosos. Un `autogenerate` en verde no significa que la restricción de la
  historia #15 exista.

### D17 — `EmailService` con resultado explícito en lugar de excepción

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** interfaz con una implementación de desarrollo que loguea. El
  envío devuelve un resultado con éxito o fallo y **no** lanza excepción, para
  que la operación de negocio que lo originó no se revierta.
- **Por qué:** la historia #13 dice que si el alta se completó pero el mail
  falló, el alumno queda registrado y el administrador debe ser informado. Con
  excepciones, el `except` tendría que distinguir "falló el alta" de "falló el
  mail".
- **Decisión diferida:** el proveedor se elige por configuración en el change
  siguiente. La interfaz no cambia.

### D18 — El seed deja las tres cuentas demo sin cambio de contraseña pendiente

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** el modelo dice que las cuentas de docente y alumno nacen con
  `must_change_password = true`. El seed **excepción**: deja en `false` las tres
  cuentas de demostración.
- **Por qué:** este change no implementa el cambio de contraseña. Si el seed
  marcara la cuenta como pendiente, el usuario caería en un flujo inexistente y
  no llegaría al shell. Es una concesión del entorno de demostración, no del
  modelo.
- **Consecuencia:** la regla "nace con pendiente" queda sin probar de punta a
  punta acá. Se cubre con las historias #11 o #13.

### D19 — Cambios de código en el mismo idioma que el código

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** reglas de nombres, UI en es-AR y entidades de dominio en español
  sin tildes (`Comision`, `Inscripcion`, `Cobranza`).
- **Por qué:** esos nombres son el lenguaje del cliente, no una traducción.
  Forzar nombres en inglés obliga a un diccionario mental permanente entre el
  código y la HU que lo origina, en un proyecto cuya fuente de verdad son 47
  historias en español. El glosario traduce hacia afuera.

### D20 — Los ítems Won't se muestran, no se esconden

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** cada historia Won't tiene un ítem de navegación deshabilitado con
  la etiqueta "Próximamente", sin contenido detrás.
- **Por qué:** el cliente necesita ver el alcance completo para decidir entre
  los dos caminos de MVP. Mostrar el hueco es más honesto que ocultarlo.
- **Alternativa descartada:** no renderizar el ítem, porque el prototipo y el
  backlog no coinciden al 100% y el ítem deshabilitado documenta la diferencia.

### D21 — Trazabilidad por referencia, no por cierre

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** cada HU maquetada se referencia con `Refs #N`. `Closes #N` se
  usa solo cuando la HU cumple **todos** sus criterios de aceptación.
- **Por qué:** este change maqueta. Si cerráramos issues, el backlog mentiría
  sobre el estado real del producto.

---

## Altas de catálogo y docentes (change `altas-catalogo-docentes`)

D32 a D36 son decisiones del change `altas-catalogo-docentes`, que rompe tres contratos
de `domain-schema`: el código del curso pasa a generarlo la base, el de la comisión pasa a
ser derivado y el CUIL del docente deja de ser obligatorio.

**Los identificadores D22 a D31 están citados en el código y en el `design.md` del bootstrap,
pero nunca llegaron a tener entrada acá.** El hueco queda a propósito: los números están
reservados para que las decisiones que los citan no cambien de dirección. Cuando esas
entradas se escriban, van en su lugar y no se renumeran las de acá.

### D32 — El código del curso lo genera el sistema, y los del Excel se descartan

- **Fecha:** 2026-10-06
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `curso.codigo` pasa a ser una **columna generada y almacenada por la base**,
  `GENERATED ALWAYS AS ('CUR' || lpad(id::text, greatest(3, length(id::text)), '0')) STORED`,
  y el número sale del **identificador de la fila**, que ya es autoincremental y nunca se
  reutiliza. El operador **no lo carga**: el alta de un curso admite solo el nombre y una
  descripción opcional, y un `INSERT` que informe `codigo` es rechazado por PostgreSQL. Se
  elimina `curso.codigo_norm` y el índice único pasa a `uq_curso_codigo`.
- **Por qué:** había dos verdadades —el `DEFAULT` de la migración y la lógica del servicio—
  que se desincronizaban sin que nada avisara. Con la columna generada, el valor es el de la
  fila por definición.
- **Los códigos que trae el Excel del cliente (`CUR101`, `CUR-101`, `103`, etc.) se
  descartan a propósito** y no se intenta preservarlos. Las variantes sucias del nombre
  (`"Curso Python"`, `"curso  de  python"`, `"Py 101"`) se resuelven con `nombre_norm`
  durante la migración del Excel, que todavía no está escrita. **El Excel es el problema, no
  la solución:** un código que el sistema genera no se preserva para acomodarse a una planilla
  que el proyecto quiere reemplazar.
- **Consecuencia anotada:** cuando se importe el Excel, **los códigos de las comisiones
  también se regeneran**, porque sus `curso_id` se resuelven por `nombre_norm` y su número
  sale del orden de aparición en la planilla. Si la planilla cruza comisiones con cursos por
  código, ese casamiento lo resuelve el importador, no el esquema.
- **`greatest` no es cosmético:** `lpad(texto, largo, relleno)` **trunca** cuando el texto ya
  es más largo que el largo pedido, así que `lpad('1000', 3, '0')` devuelve `'100'`. Sin
  `greatest`, el curso 1000 recibiría `CUR100`, que ya es del curso 100, y su alta fallaría
  por una colisión de código con un error que no señala la causa.
- **El CHECK `curso_codigo_obligatorio` se conserva** aunque la expresión no pueda producir
  una cadena vacía: forma parte del conjunto de obligatorios de M4 y `test_migration.py` lo
  verifica uno por uno. Sobrar no cuesta nada; faltaría, alguien lo sacaría de la lista sin
  darse cuenta de que estaba dejando la regla coja.
- **Dónde:** `app/models/catalogo.py` (`Curso.codigo`, `EXPRESION_CODIGO_CURSO`),
  `alembic/versions/0002_altas_catalogo.py`, `app/tests/test_codigo_curso.py`.

### D33 — El CUIL del docente pasa a ser opcional, y eso revierte D27

- **Fecha:** 2026-10-06
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `docente.cuil` deja de ser `NOT NULL` y se elimina el CHECK
  `docente_cuil_obligatorio`. **Alcance del revert, explícito: se revierte la
  obligatoriedad; no se borra la columna ni el índice**, y la fila de Rita Molina conserva su
  CUIL en `CUENTAS_DEMO`.
- **Por qué:** en esta fase los docentes **no son personas reales**, así que un CUIL
  inventado es peor que ningún CUIL. Un `27-34567890-7` fabricado no identifica a nadie para
  liquidar y después hay que ir a corregirlo. La columna queda porque el instituto liquida
  con el CUIL y va a hacer falta apenas haya docentes reales.
- **Alcance del revert respecto de D27:** D27 decía que el CUIL era obligatorio porque es el
  identificador con el que el instituto liquida. Ese razonamiento sigue siendo cierto y la
  columna no se borra; lo que cambia es que **esta fase no tiene docentes reales**, y el
  requisito lo satisfacen el DNI y el correo, que sí obligatorios.
- **`uq_docente_cuil` sobrevive a los nulos:** PostgreSQL admite varios nulos en un índice
  único, así que el índice no estorba mientras los docentes no tengan CUIL y sigue sosteniendo
  la unicidad en cuanto empiecen a tenerlo.
- **Consecuencia en el seed:** `_upsert_docente` buscaba al docente por `cuil`, que era único
  y obligatorio. Una columna que admite nulos no puede ser la clave natural del upsert, así que
  pasa a buscar por `dni_norm`, que sigue siendo única, obligatoria y la tiene la fila de
  ejemplo.
- **Origen del requisito:** el CUIL lo pidió **el equipo** al derivar el modelo, no el cliente:
  el CSV de historias nunca lo menciona. Por eso esto es una corrección de una decisión propia
  y no una negociación de alcance.
- **Dónde:** `app/models/padron.py` (`Docente.cuil`), `app/services/seed.py`
  (`_upsert_docente`), `alembic/versions/0002_altas_catalogo.py`.

### D34 — El código de la comisión es derivado, y lo único real es `(curso_id, numero)`

- **Fecha:** 2026-10-06
- **Autor:** Equipo TechAcademy BA
- **Decisión:** se elimina la columna `comision.codigo` con su índice único y su CHECK de
  obligatorio. Entra `numero: Integer NOT NULL` con `ck_comision_numero_positivo` y
  `uq_comision_curso_numero`, incremental **por curso**: el máximo de los números de ese curso
  más uno. El código pasa a ser un **valor derivado**, `{curso.codigo}-{numero}`
  (`CUR001-1`), armado en una propiedad del ORM y en el serializador de la API.
- **Por qué:** no es una columna porque no hay nada que el operador escriba ni nada que pueda
  quedar viejo —si el curso cambiara de código, el derivado cambiaría solo—. Y la numeración
  es una derivación por consulta, que es el criterio de D10: un contador persistido se
  desincroniza apenas alguien borre o migre una fila.
- **La carrera entre dos altas simultáneas la corta el índice único**, y la API la traduce a
  un 409. **Techo asumido:** a la escala declarada del proyecto (10 comisiones, D10) **no hace
  falta una secuencia por curso ni un lock**. Si el volumen de altas simultáneas llegara a
  importar, el arreglo es un `SELECT ... MAX(numero) ... FOR UPDATE` sobre el curso, y no toca
  el contrato. Atajo deliberado, no arquitectura.
- **Por qué `(curso_id, numero)` y no un único global:** el código derivado ya incluye el
  curso, así que dos cursos distintos pueden tener ambos el número 1 sin colisionar.
- **Por qué `numero` como columna y no una secuencia por curso:** una secuencia por curso es un
  objeto del esquema que hay que mantener alineado y que además no sobrevive bien a un
  borrado. El máximo por consulta es una consulta.
- **Dónde:** `app/models/catalogo.py` (`Comision.numero`, `Comision.codigo`),
  `alembic/versions/0002_altas_catalogo.py`.

### M33 — Las formas reales del primer contrato de API, y el fin de la provisoidad de M17

- **Fecha:** 2026-10-06
- **Autor:** Equipo TechAcademy BA
- **Decisión:** el change `altas-catalogo-docentes` escribió los primeros endpoints reales y
  **confirma** los cuatro caminos de M17 sin cambios: `GET`/`POST /cursos`, `GET`/`POST
  /comisiones`, `GET`/`POST /docentes` y `GET /sedes`. Las formas de entrada y de salida
  quedan fijadas acá.
- **Por qué:** M17 dejó los caminos como provisionales y puso la condición de que el primer
  endpoint real los confirmara o los corrigiera. Confirmó: los nombres por recurso y por verbo
  que ya estaban escritos en `PATHS` son los correctos, así que el mapa no se tocó.
- **Formas de entrada.** El alta de curso admite **solo** `nombre` y `descripcion` opcional; el
  alta de docente admite `nombre`, `apellido`, `dni`, `email` y `telefono` opcional; el alta de
  comisión admite `curso_id`, `docente_id`, `dias_horarios`, `arancel`, `cupo_maximo`,
  `modalidad` y `sede_id` opcional. Los tres esquemas son `extra="forbid"`, así que un campo
  que no está en la lista —un `codigo` en el curso, un `cuil` en el docente— es un **422** y no
  un campo que se ignora en silencio.
- **Formas de salida.** El curso sale con `id`, `codigo`, `nombre`, `descripcion`. La comisión
  sale con `id`, `codigo` (el **derivado**, D34), `curso` anidado, `docente_id`,
  `docente_nombre`, `dias_horarios`, `cupo_maximo`, `arancel`, `modalidad`, `sede_id`,
  `sede_nombre` y `vacantes`. El docente sale con `id`, `nombre`, `apellido`, `dni`, `cuil`
  (puede venir `None`, D33), `email`, `telefono`, `activo` y `cantidad_comisiones`.
- **Códigos de error.** 401 sin token o con token inválido; 403 con un rol que no sea `ADMIN`;
  404 si el curso, el docente o la sede de un alta de comisión no existen; **409** si el nombre
  del curso, el DNI o el email ya están registrados, y también 409 en la carrera entre dos
  altas simultáneas, con un mensaje que en un caso pide corregir el formulario y en el otro
  reintentar; 422 si falta un campo obligatorio, si el cupo o el arancel no son positivos, si
  la comisión es virtual y trae sede, o si el email no tiene forma. El `sede_id` del alta de
  comisión es opcional en toda modalidad (M35).
- **`vacantes` en la respuesta de la comisión, y por qué no cierra la historia #6.** La tabla de
  Administración ya tenía esa columna, y dejarla en blanco sería una regresión visible, así que
  la respuesta la trae **derivada** por consulta, que es lo que D10 ya decidió. La #6 sigue
  abierta porque además necesita el caso de extremo a punta con una inscripción real.
- **Pendiente que queda:** los caminos de alumnos, empresas, cobranzas, habilitaciones, clases y
  los shells de docente y de alumno siguen sin endpoint y siguen siendo provisionales.
- **Dónde:** `backend/app/api/catalogo.py`, `backend/app/api/padron.py`,
  `backend/app/schemas/catalogo.py`, `backend/app/schemas/padron.py`,
  `backend/app/services/catalogo.py`, `backend/app/services/padron.py`.

### M34 — `get_db` no confirma, así que el primer servicio que escribe confirma

- **Fecha:** 2026-10-06
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `get_db` cierra la sesión sin confirmar, y lo hizo así porque hasta ahora la
  única ruta que escribía era el seed, que confirma por su cuenta. Los servicios de alta
  confirman: `flush()` para obtener el identificador y el valor generado, `commit()`, y después
  `refresh()`.
- **Por qué:** poner el `commit` en la ruta se lee como un detalle de transporte en una capa que
  no debería saber de transacciones (D1), y ponerlo en una dependencia obligaría a todos los
  endpoints a escribir, aunque leer no necesita confirmar nada. En el servicio, un
  `crear_curso` que se use desde un script o desde una tarea programada confirma igual.
- **El `refresh` posterior al `commit` no es opcional:** un `INSERT` no devuelve el valor de una
  columna generada, así que sin él la respuesta de `POST /cursos` devolvería `codigo = None`.
- **Dónde:** `backend/app/core/database.py`, `backend/app/services/catalogo.py`,
  `backend/app/services/padron.py`.

### M35 — La sede es opcional en toda modalidad, y el CHECK invierte su dirección

- **Fecha:** 2026-10-07
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `comision.sede_id` es **opcional en toda modalidad**. El CHECK
  `modalidad_presencial_requiere_sede` (`modalidad = 'VIRTUAL' OR sede_id IS NOT NULL`) se
  reemplaza por `modalidad_virtual_sin_sede` (`modalidad <> 'VIRTUAL' OR sede_id IS NULL`): deja de
  exigir sede y pasa a **prohibirla** en Virtual.
- **Por qué invierte y no desaparece.** "Dejar de exigir" y "no exigir nunca" no son lo mismo. De
  las cuatro combinaciones de modalidad por `sede_id`, el viejo rechazaba `(PRESENCIAL, NULL)` y el
  nuevo rechaza `(VIRTUAL, con sede)`: no son la negación el uno del otro, y por eso la migración no
  puede ser un `drop` y nada más. Se prohíbe en lugar de permitirla porque una comisión virtual con
  `sede_id` es el dato incoherente que el formulario no renderiza.
- **La regla vive en un solo lugar.** No hay `model_validator` en `ComisionCreate` ni validación en
  el frontend: son CHECK de la base, y una regla que se sostiene en dos lugares es una regla que se
  desincroniza (el docstring de `crear_comision` ya lo decía). El 422 de virtual con sede sale del
  `IntegrityError` que traduce `_regla_de_alta_rota`, igual que el del cupo y el del arancel, y su
  texto sigue siendo el crudo de PostgreSQL.
- **La migración `0003_sede_opcional_comision` pone en `NULL` la sede de las virtuales.** El CHECK
  anterior **permitía** virtual con sede, así que sobre cualquier base poblada el
  `create_check_constraint` a secas falla. Lo que se pierde con ese `UPDATE` es exactamente el dato
  que el CHECK nuevo prohíbe: no se destruye nada con significado. Es una migración que **reescribe
  filas**, así que se aplica antes de desplegar el backend nuevo.
- **El `downgrade` no repara los datos, falla.** Restaura el CHECK viejo y deja que la base lo
  rechace si quedan comisiones presenciales sin sede, con el mismo criterio que el `downgrade` del
  CUIL en `0002_altas_catalogo`: rellenar sedes inventadas mentiría sobre el estado del esquema.
- **Dónde:** `backend/app/models/catalogo.py`, `backend/alembic/versions/0003_sede_opcional_comision.py`,
  `backend/app/api/catalogo.py`, `backend/app/services/catalogo.py`, `backend/app/schemas/catalogo.py`,
  `frontend/src/admin/CoursesPage.jsx`.

### D35 — Todos los montos quedan en pesos argentinos

- **Fecha:** 2026-10-06
- **Autor:** Equipo TechAcademy BA
- **Decisión:** el arancel de la comisión y todos los montos de cobranza están en **pesos
  argentinos**. No hay columna de moneda, no hay tipo que la admita y no hay conversión en el
  código: un monto es un `Numeric(14, 2)` y se muestra con el formato de es-AR.
- **Por qué:** cierra **P4**. El pendiente se abrió porque el Excel del cliente tenía al menos un
  cobro en dólares y el modelo asumía pesos, así que había que saber cuál de las dos cosas
  cambia. Cambia la suposición: los dólares del Excel son un dato de la planilla, no una
 exigencia del sistema.
- **No hay cambio de código por moneda.** `Comision.arancel` y `Cobranza.importe` ya usan
  `Numeric(14, 2)` —el alias `MONEY` de `models/catalogo.py`—, y el saldo no imputado ni siquiera
  es una columna porque se deriva (D10). La spec `domain-schema` ya decía que los montos son
  pesos. D35 escribe la decisión que el modelo y la spec ya asumían; no los cambia.
- **Consecuencia:** si algún día entra una cobranza en otra moneda, es **otro change**: o una
  columna de moneda con su tipo de cambio y su fecha, o una conversión explícita antes de
  escribir. Agregar la columna más adelante es barato; que dos montos de distinta moneda terminen
  restados en el mismo saldo sin que nadie lo note, no.
- **Dónde:** `docs/decisions.md` (P4), `backend/app/models/catalogo.py`,
  `backend/app/models/cobranza.py`.

### D36 — El modo por defecto de los datos pasa a ser la API, y lo que falta cae al ejemplo

- **Fecha:** 2026-10-06
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `resolveApiMode()` devuelve `api` salvo que la variable de entorno diga `mock`
  explícitamente. Esto **modifica D14**, que dejaba la pantalla sin datos reales detrás.
- **Por qué:** con el modo de ejemplo por omisión, el botón de "guardar curso" no guardaba nada y
  la secretaría se enteraba de eso el día que le sobraba una tarea. El problema no es que el
  ejemplo exista: es que fuera el camino por defecto de lo que sí se guarda.
- **Cómo se reparte lo que todavía no existe.** Las **lecturas** caen al ejemplo **solo con un
  404**. Un 404 es la ausencia de endpoint, que es el único caso en que el ejemplo es una
  respuesta honesta: no hay dato que mostrar. Un 500 o un error de red **no** caen, porque un
  ejemplo mostrado como si fuera un dato hace creer que la pantalla funciona.
- **Los POST nunca caen.** Es lo más importante de la decisión. Un alta que no llega a la base
  tiene que fallar y decir que no se guardó; si cayera, escribiría en un arreglo de memoria, la
  pantalla confirmaría un curso que no existe y el equipo se iría creyendo que el sistema guarda.
  La lista de métodos que escriben es explícita, y no un patrón de nombre, porque equivocarse
  ahí no da un test rojo: da una demo que miente.
- **Techo, y es el punto flojo de esta decisión.** La caída al ejemplo se borra cuando el shell
  tenga todos sus endpoints. Es un atajo deliberado para no dejar media pantalla vacía mientras
  faltan los endpoints de alumnos, empresas, cobranzas, habilitaciones y clases; no es una
  arquitectura. Un día que haya que depurar por qué una pantalla muestra datos de ejemplo, la
  primera pregunta es si ya llegó la hora de borrar `conEjemploEnAusencia`.
- **Dónde:** `frontend/src/services/dataSourceFactory.js`,
  `frontend/src/services/apiDataSource.js`, `docker-compose.yml`, `frontend/src/test/setup.js`.

---

## Correcciones al modelo de dominio

### M1 — La unicidad global de email se sostiene en base y en servicio, no solo en base

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** D5 declara que `usuario.email`, `docente.email` y `alumno.email`
  son únicos cada uno, "lo que garantiza unicidad global de email entre los tres
  padrones". **Eso no es cierto a nivel de base de datos**: un índice único es por
  tabla, así que tres índices únicos no impiden que una dirección esté en dos
  padrones a la vez. Lo que sí se sostiene:
  - cada padrón es único contra sí mismo, por índice único en base;
  - `usuario.email` es único de forma global, y es la tabla de identidad;
  - la unicidad **cruzada** entre `docente` y `alumno` la verifica
    `app/services/emails.py`, dentro de la transacción de alta, y lanza
    `EmailAlreadyRegistered`.
- **Por qué:** no se eligió una tabla `email_reservado` ni una clave foránea
  cruzada entre `docente` y `alumno` porque las dos cosas agregan estructura para
  sostener una restricción que además depende de una regla de negocio ("¿una persona
  puede ser docente y alumna a la vez?"), y esa pregunta sigue abierta en el
  diseño. Si el cliente la confirma, la función de servicio alcanza y la base no
  cambia.
- **Efecto colateral aceptado:** un `INSERT` directo a `docente` o a `alumno` con un
  email que ya existe en el otro padrón entra sin quejarse. El acceso directo a la
  base es del equipo, igual que el riesgo que ya asume D8 con el saldo de una
  cobranza.
- **Dónde:** `app/models/padron.py`, `app/services/emails.py`.

### M2 — `comision` no tiene columna `estado`

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** la tabla de entidades de `design.md` lista `estado` en `comision`, pero
  el mismo documento, en *Gaps abiertos* #14, deja constancia de que los siete estados
  de comisión que tiene la planilla del cliente **no se modelan** porque ninguna
  historia Must ni Should los necesita. Modelar una columna de estado sin conjunto de
  valores definido sería dejar un enum libre, que es exactamente el problema del Excel
  que el proyecto quiere reemplazar. La baja lógica va con `activo`.
- **Por qué:** la lectura que respeta las dos afirmaciones es que `estado` no se
  modela. Si aparece una historia que lo necesite, se abre junto con ella.
- **Dónde:** `app/models/catalogo.py`.

### M3 — `nomina_empleado.tipo_contrato` existe para sostener una restricción

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `nomina_empleado` tiene una columna desnormalizada `tipo_contrato`, con
  clave foránea compuesta contra `contrato_corporativo(id, tipo)` y un CHECK
  `tipo_contrato = 'CURSO_FORMAL'`. La regla "una charla cerrada no genera nómina"
  (historia #19) queda así en la base y no solo en el servicio: un `INSERT` directo no
  la puede esquivar.
- **Por qué:** la alternativa era validar la regla en el servicio, que es lo que hace
  D8 con el saldo de una cobranza, pero ahí el riesgo asumido es acotado a "nadie
  escribe por SQL directo". Acá la alternativa era dejar el único rastro de la charla
  en el propio `audit_log`. Cuesta una columna.
- **Costo:** `contrato_corporativo` necesita `UNIQUE (id, tipo)`, que es redundante
  contra la clave primaria pero es lo que permite la clave foránea compuesta.
- **Dónde:** `app/models/inscripciones.py`.

### M4 — "Obligatorio" incluye la cadena vacía

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** los campos que la spec declara obligatorios llevan, además de
  `NOT NULL`, un CHECK `columna ~ '[^[:space:]]'`: `curso.codigo`, `curso.nombre`,
  `sede.nombre`, `comision.codigo`, `comision.dias_horarios`, `docente.cuil`,
  `docente.email`, `docente.nombre`, `docente.apellido`, `alumno.nombre`,
  `alumno.email`, `usuario.email`, `usuario.nombre`. De esa lista, `docente.cuil` ya no está:
  D33 lo volvió opcional y le sacó el CHECK.
- **Por qué:** `NOT NULL` solo rechaza la ausencia de valor. Una cadena vacía o de
  espacios es un campo obligatorio no informado, y la historia #1 pide que el sistema
  lo indique. La expresión es una clase de carácter y no `length(btrim(...))` porque
  `btrim` solo recorta espacios: un valor que sea un tabulador también está vacío.
- **Dónde:** `app/models/base.py` (`no_vacio`), y las tablas que las usan.

### M5 — La dependencia de autorización por rol vive en `app/api/deps.py`

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** D1 reserva `app/core` para configuración, seguridad y dependencias. La parte
  criptográfica de la autenticación —hash de contraseñas y firma del token— quedó en
  `app/core/security.py`, que es la base de la pirámide. Las dependencias de FastAPI que
  resuelven la **cuenta** (`get_current_user` y `require_roles(...)`) quedaron en
  `app/api/deps.py`, junto a las rutas que las usan.
- **Por qué:** `get_current_user` necesita `app.models.Usuario`, y `app/core` no puede
  importar `app.models`: la prueba de capas del work unit 3
  (`test_layers.py::test_las_capas_no_se_importan_entre_si_de_modo_inesperado`) lo verifica
  y lo considera un invariante, no una preferencia. La lectura que respeta D1 y ese
  invariante a la vez es que `core` aloja la seguridad y las dependencias que no dependen del
  dominio —`get_db` ya es una— y la capa de API aloja las que sí.
- **Alternativa descartada:** aflojar la prueba de capas para meter `require_roles` en
  `app/core`. Habría sido cambiar una decisión del work unit 3 para acomodar un archivo
  nuevo, y la prueba existe justo para que nadie lo haga por comodidad.
- **Consecuencia:** `require_roles` sigue siendo reutilizable por cualquier endpoint, que es
  lo que exige la spec: todas las rutas viven en `app/api`.
- **Dónde:** `app/core/security.py`, `app/api/deps.py`, `app/services/auth.py`.

### M6 — El correo de acceso de una cuenta es el mismo que su correo de padrón

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** la carga inicial crea el `docente` y su `usuario` (o el `alumno` y su
  `usuario`) con **la misma dirección de correo**, y al validar la unicidad cruzada de M1
  excluye los registros de la propia persona con `exclude_docente_id` /
  `exclude_alumno_id` / `exclude_usuario_id`.
- **Por qué:** D4 hace de `usuario` la identidad única y el login es por correo, así que la
  misma persona tiene que tener la misma dirección en los dos lados. Los `exclude_*` ya
  existen para esto —están pensados para que "un docente pueda guardar su propio perfil sin
  que su propia fila lo bloquee"— y son el mecanismo correcto, no un parche. Además, la
  cuenta se busca **antes** de validar la unicidad: si se validara después, la segunda
  corrida de la carga encontraría su propia cuenta y se declararía en conflicto consigo misma,
  y la idempotencia de 6.2 se rompería.
- **Efecto aceptado:** la dirección de una persona queda escrita en dos tablas. Es
  intencional: es la misma persona y el índice único de cada padrón sigue sosteniendo la
  unicidad dentro de cada uno. La unicidad **cruzada** entre `docente` y `alumno` la sigue
  verificando el servicio, como en M1.
- **Dónde:** `app/services/seed.py`.

### M7 — El token afirma la identidad; la base manda sobre la cuenta

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `get_current_user` resuelve el `sub` del token contra `usuario` en **cada**
  request. El claim `rol` se lee pero no decide: el rol que manda es el de la fila. Una
  cuenta con `is_active = false`, o que ya no existe, produce el mismo `401` genérico que un
  token roto.
- **Por qué:** el token es stateless (D2), pero "sin estado de sesión" no significa "sin
  fuente de verdad". Con el claim solamente, una cuenta dada de baja seguiría operando
  hasta que venciera el token —hasta ocho horas— y `must_change_password` sería una foto del
  momento del login en lugar del valor vigente. El costo es una consulta por request sobre
  una tabla de identidad con índice por clave primaria.
- **Alternativa descartada:** confiar en el claim `rol` y no consultar la base. Es más rápido,
  y es exactamente el diseño que hace que revocar un acceso tarde horas.
- **Consecuencia:** un token falsificado con `rol: ADMIN` sobre una cuenta `ALUMNO` sigue
  siendo rechazado con 403 por la ruta de administración. Hay una prueba que lo comprueba.
- **Dónde:** `app/api/deps.py`.

### M8 — El costo de bcrypt es configurable, y la suite lo baja

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `BCRYPT_ROUNDS` (12 por defecto, mínimo 4) determina el costo de cómputo de
  bcrypt. `app/tests/__init__.py` lo baja a 4 antes de que se importe nada de la aplicación.
- **Por qué:** `design.md` lo anticipa en *Riesgos*: bcrypt es lento **por diseño** y con el
  costo de producción la suite de autenticación casi se duplica sin ganar nada. La mitigación
  es de la suite, no del entorno: la variable no está en `docker-compose.yml` ni en `.env`, así
  que el contenedor y la máquina del equipo siguen usando 12.
- **Pendiente:** `BCRYPT_ROUNDS` todavía no está documentado en `.env.example`, que es de la
  tarea 2.4 y está fuera del alcance de este work unit. Hay que agregarlo cuando alguien
  toque ese archivo.
- **Guardia:** `test_security.py::test_la_suite_no_paga_el_costo_de_produccion` falla si el
  ajuste de `app/tests/__init__.py` deja de aplicarse, en vez de dejar que la suite se ponga
  lenta en silencio.
- **Dónde:** `app/core/config.py`, `app/core/security.py`, `app/tests/__init__.py`.

### M9 — `POST /auth/login` acepta `email` y `password`, en inglés

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** el cuerpo del login es `{"email": "...", "password": "..."}`. La spec de
  `auth-and-roles` escribe "acepte `email` y `contraseña`" en una oración en español; el
  nombre del campo del contrato se resolvió en inglés.
- **Por qué:** la convención del equipo es que los identificadores, el código y los paths van
  en inglés, y que solo las entidades de dominio van en español sin tildes (D19). `password`
  no es una entidad de dominio: es un campo del contrato de la API, del mismo lado que
  `access_token` o `must_change_password`, que la propia spec escribe en inglés.
- **Consecuencia:** el texto de la interfaz sigue siendo es-AR. Lo que el usuario lee en un
  422 de FastAPI es "Field required", que es el texto del framework, no del producto.
- **Dónde:** `app/schemas/auth.py`, `app/api/auth.py`.

## Frontend (work unit 5, grupo 7)

### M10 — La tabla de ruteo tiene una raíz por rol

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** las tres secciones cuelgan de `/admin`, `/docente` y `/alumno`. `/` redirige a
  la sección del rol que entra o al login, `/login` es la pantalla de acceso, `/403` es el
  rechazo por rol y `*` es el 404. El destino de entrada de cada rol vive en una tabla,
  `ROLE_HOME_PATHS` en `src/auth/roleRoutes.js`, y la usan la redirección de entrada, el
  logout y los enlaces de las pantallas de error.
- **Por qué:** D14 afirma que "la tabla de ruteo ya queda en su forma final", pero `design.md`
  **nunca la escribió**. Es un hueco de `design.md`, no una decisión que el documento tomara y
  omitiera. Sin una raíz acordada por rol, los grupos 9, 10 y 11 no tenían un prefijo donde
  colgar sus pantallas y cada uno iba a inventar el suyo. El prefijo identifica quién entra,
  no cómo se llama la sección: `ADMIN` se muestra como `Secretaría` (D3).
- **Alternativa descartada:** una raíz común (`/panel`) con la sección deducida del rol.
  Deja la URL igual para los tres roles y vuelve ambiguo cualquier enlace a una pantalla.
- **Consecuencia:** los grupos 9, 10 y 11 agregan rutas **debajo** de estas tres, sin mover la
  raíz. `/403` y `*` son públicas a propósito: una ruta inexistente tiene que poder responder
  404 sin sesión.
- **Dónde:** `frontend/src/App.jsx`, `frontend/src/auth/roleRoutes.js`.

### M11 — El token se guarda en `sessionStorage`

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** el token que devuelve `POST /auth/login` se guarda en `sessionStorage`, con la
  clave `techacademy.token`. No se usa `localStorage`.
- **Por qué:** el token alcanza para actuar como la cuenta (D2) y la secretaría comparte la
  máquina —el pie del prototipo dice `Terminal Interna 04`. Con `sessionStorage`, recargar la
  página no cierra la sesión, pero cerrar el navegador sí, y el token no queda en disco para
  el próximo que use el equipo. Con `localStorage`, una cuenta abierta seguiría viva al día
  siguiente en una máquina compartida.
- **Lo que esto NO es:** una sesión confiable. El backend resuelve el token contra la base en
  cada request (M7), así que uno alterado, vencido o de una cuenta dada de baja no abre nada.
  Guardarlo es para no perder la sesión al recargar, no para decidir permisos.
- **Riesgo asumido:** con dos pestañas abiertas, cerrar sesión en una no cierra la otra. Es el
  comportamiento conocido de `sessionStorage` y es aceptable en un scaffold; si molesta, se
  pasa a una cookie de sesión y se revisa CORS.
- **Dónde:** `frontend/src/auth/tokenStorage.js`.

### M12 — El cliente de autenticación vive en `src/auth/`, no en `src/services/`

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** el cliente HTTP del backend —las dos rutas de D14— vive en
  `src/auth/authClient.js`, junto con el contexto de sesión, la tabla de ruteo y la protección
  por rol. `src/services/` queda para los datos de las pantallas, que es lo que D13 describe.
- **Por qué:** D13 habla de la frontera de datos de **las pantallas**; D14 deja una sola
  llamada de red, el login, y dice que el cliente HTTP queda "deliberadamente mínimo". Meter
  el login en la fábrica de `src/services/` obligaría a que esa fábrica fuera real siempre, y
  `VITE_API_MODE` dejaría de describir lo que la aplicación hace.
- **Consecuencia:** el grupo 8 no toca `src/auth/`. La verificación de que ningún componente
  importa mocks sigue valiendo: los componentes leen del contexto, no de una capa de datos.
- **Dónde:** `frontend/src/auth/authClient.js`, `frontend/src/config/api.js`.

### M13 — El contexto de sesión es el dueño de la redirección

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `SessionProvider` navega: `signIn` lleva a la sección del rol y `signOut` al
  login. `RequireRole` manda al login a quien no tiene sesión y a `/403` al rol que no
  corresponde. El contexto queda **dentro** del router, así que los tests lo montan con
  `MemoryRouter`.
- **Por qué:** la redirección por rol es una regla del proyecto, no una decisión de cada
  pantalla. Si el contexto no la aplica, los tres shells de los grupos 9, 10 y 11 pueden
  cerrarse sin volver al login y ningún test lo nota hasta que alguien lo prueba a mano.
- **Alternativa descartada:** que `signIn` devuelva la ruta y la navegue cada pantalla. Es más
  puro y deja el mismo bug esperando en tres archivos.
- **Dónde:** `frontend/src/auth/SessionContext.jsx`, `frontend/src/auth/RequireRole.jsx`.

### M14 — Versiones del stack de frontend, y `npm ci` en la imagen

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** Node 22, React 19, React Router 8, Vite 8, Tailwind CSS 4 (por plugin de Vite,
  sin `tailwind.config.js`), ESLint 10 en configuración plana, Prettier 3, Vitest 5 y React
  Testing Library. Se versiona `package-lock.json` y `frontend/Dockerfile` instala con
  `npm ci` en lugar de `npm install`.
- **Por qué:** `design.md` fija Python y PostgreSQL pero **no** fija Node ni ninguna
  biblioteca del frontend, así que las versiones son una elección de este work unit y hay
  que confirmarlas. Tailwind 4 se conecta por plugin de Vite: menos configuración que la
  cadena de PostCSS de la versión 3. `npm ci` instala exactamente el árbol resuelto, así que
  la imagen de hoy y la de dentro de un mes instalan lo mismo; el `npm install` anterior
  movía el árbol en silencio. El propio `frontend/Dockerfile` anticipaba este cambio para
  cuando existiera el lockfile.
- **Pendiente:** Node 22 sigue sin confirmación del equipo, que es lo que el comentario del
  `frontend/Dockerfile` ya decía. Si el equipo fija otra versión, cambian la imagen base y la
  lista de dependencias.
- **Dónde:** `frontend/package.json`, `frontend/Dockerfile`, `frontend/vite.config.js`,
  `frontend/eslint.config.js`.

---

## Capa de datos y componentes (work unit 6, grupo 8)

### M15 — Cada registro de ejemplo viaja sellado con `_ejemplo`

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** todas las colecciones de `src/mocks/` se construyen con `markAsExample()`, que
  congela cada registro y le agrega `_ejemplo: true`. El sello viaja a través de la capa de
  servicios. Además, `src/domain/` replica los enums del backend y las funciones de
  normalización de D6, y `src/utils/formato.js` concentrates el formato de moneda y fecha.
- **Por qué:** D22 exige que los datos del maquetado se identifiquen como tales, y un comentario
  no sobrevive a que alguien copie una fila. El sello es lo que hace verificable el "están
  marcados como tal" de 8.1 sin depender de la confianza. Congelar evita que una pantalla ensucie
  el módulo de datos de ejemplo por accidente.
- **Alternativa descartada:** un banner de "datos de ejemplo" arriba de cada pantalla. Es visible,
  pero no distingue un registro de ejemplo de uno real si mañana conviven, que es exactamente lo
  que D22 quiere evitar.
- **Consecuencia:** el frontend tiene su propia copia de los enums del dominio. Es una fuente que
  puede desincronizarse, así que el riesgo es real: se acepta mientras la única fuente de datos
  sea el mock, y desaparece cuando las respuestas sean las de la API.
- **Dónde:** `frontend/src/mocks/`, `frontend/src/domain/enums.js`,
  `frontend/src/domain/normalize.js`, `frontend/src/utils/formato.js`.

### M16 — El importe del comprobante ilegible es `null` en el ejemplo, y el modelo exige número

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** la cobranza del 19/05/2026 se registra con `importe: null` y causa
  `comprobante ilegible`. El modelo exige `importe > 0` con el CHECK `cobranza_importe_positivo`,
  así que esa fila **no podría crearse** contra la base real.
- **Cómo lo rechaza, exactamente:** el `null` lo rechaza el `NOT NULL` de la columna, no el CHECK.
  El CHECK solo caza el cero y los negativos. Las dos cosas están probadas:
  `test_importe_menor_o_igual_a_cero_es_rechazado` y `test_importe_nulo_es_rechazado` en
  `backend/app/tests/test_cobranza.py`.
- **Por qué:** es lo que el cliente tiene. La celda de la planilla está vacía porque el número
  nunca pudo leerse, y el caso vale justamente por eso: es la diferencia entre "no pagó" y "no se
  pudo leer". Ocultar el hueco con un cero convertiría el ejemplo en un cobro de $0. La interfaz
  tampoco inventa nada: `formatMoneda(null)` devuelve cadena vacía y la celda queda en blanco.
- **Pendiente:** qué hace la historia de alta de cobranza con un comprobante ilegible: si se
  rechaza hasta poder leer el importe, si se registra con el importe en `null` y se saca el
  `NOT NULL` de la columna (relajar el CHECK no alcanza: no es lo que rechaza el `null`), o si
  hay un estado más. Es una decisión de la historia #21 con la #45, no de este change.
- **Dónde:** `frontend/src/mocks/cobranzas.js`, `backend/app/models/cobranza.py`.

### M17 — Las rutas de la implementación real son provisionales y viven en un solo mapa

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `src/services/apiDataSource.js` llama a endpoints que **todavía no existen**
  (`/comisiones`, `/docentes`, `/alumnos`, `/empresas`, `/sedes`, `/cobranzas`,
  `/habilitaciones/consulta`, `/habilitaciones/override`). Los caminos están en una constante
  `PATHS` y se corrigen en un solo lugar cuando exista el endpoint real.
- **Por qué:** D13 pide que cambiar de implementación no obligue a tocar las pantallas, y eso solo
  se demuestra si existe una implementación alternativa. Los caminos son los que corresponde por
  recurso y verbo, pero **definir un contrato de API es una propuesta de OpenSpec**, no una
  decisión de este work unit: si se fijaran acá, el primer endpoint real los confirmaría o los
  contradiría.
- **Pendiente:** cuando se escriba el primer endpoint del padrón, los caminos y las formas de
  respuesta se confirman o se corrigen, y ahí corresponde una entrada con la forma real. El riesgo
  que `design.md` avisa —que un campo del ejemplo no exista en la API— aparece en ese momento y
  no después.
- **Dónde:** `frontend/src/services/apiDataSource.js`, `frontend/src/services/dataSourceFactory.js`.

### M18 — La frontera de datos se verifica sobre el código, y los componentes compartidos se marcan

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** dos verificaciones que no son de render. `src/mocks/mocksBoundary.test.js` lee el
  código de `src/**` y falla si algún archivo fuera de `src/services/` importa de `src/mocks/`
  (8.4). Y cada componente de `src/components/ui/` lleva `data-ui="<nombre>"` en su raíz, que es lo
  que permite afirmar en 9.8 que los tres shells dibujan con los mismos componentes.
- **Por qué:** ninguna prueba de render detecta una importación colada. El día que aparezca la
  API, una pantalla que importara mocks directamente seguiría funcionando en verde y habría que
  reescribirla, que es la pérdida de trabajo exacta que D13 vino a evitar. Y en el DOM, un `<table>`
  escrito a mano es indistinguible de uno que viene de `Table`, así que el atributo es lo único que
  hace verificable la mitad de 9.8.
- **Alternativa descartada:** forbidding por regla de ESLint. Da un mensaje en el editor y nada en
  la CI si alguien la desactiva; el test falla siempre.
- **Dónde:** `frontend/src/mocks/mocksBoundary.test.js`, `frontend/src/components/ui/paleta.js`.

---

## Shell de Administración (work unit 7, grupo 9)

### M19 — Los rótulos del spec mandan sobre el encargo y sobre el prototipo

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** la barra superior muestra el chip `Sede Constituciones` y el pie la etiqueta
  `Terminal Interna 04`. El encargo del work unit pedía `Sede Central` en la barra superior.
- **Por qué:** el spec de `admin-shell` fija los rótulos literales y es la fuente de verdad del
  alcance. La línea temporal del período lectivo ya tiene su propia corrección anotada en el spec
  (`Período Lectivo 2026` en vez del `Periodo Lectivo 2025` del prototipo), y el mismo criterio
  aplica para la sede y la terminal: si el spec dice otra cosa que el prototipo, gana el spec.
- **Pendiente:** si `Sede Constituciones` no es el nombre real de la sede del instituto, se cambia
  en un solo lugar, `src/admin/navegacion.js`. Es un dato de ejemplo (D22).
- **Dónde:** `frontend/src/admin/navegacion.js`.

### M20 — El alta de docente se muestra sin formulario detrás

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** la pantalla `Docentes` muestra la acción `+ Nuevo Docente` sin ningún formulario
  detrás. La tarea 9.4 pedía "alta"; el escenario del spec dice lo contrario y exige que la acción
  esté presente sin formulario, sin control de edición y con el control de clases dictadas
  deshabilitado con `Próximamente`.
- **Por qué:** el spec es la obligación literal. El maqueteo no implementa la historia #9 y mostrar
  un formulario que no guarda nada sería peor que mostrar el hueco: el cliente tiene que ver el
  alcance completo para decidir entre los dos caminos de MVP (D20).
- **Dónde:** `frontend/src/admin/TeachersPage.jsx`.

### M21 — `Modalidad` y `Sede` se completan con valor de ejemplo, y el docente va desnormalizado

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** las cinco comisiones de ejemplo llevan `modalidad` y `sede` con valores inventados
  —presenciales en la sede del chip de la barra superior—, aunque la planilla del cliente no tiene
  esas columnas. Y la comisión guarda `docente_nombre` desnormalizado, con `docente_id` nulo para
  `CUR-104` y `CUR-110`, cuyos docentes el cliente nombra en la hoja de cursos pero no están en el
  padrón de cinco filas que el spec obliga a mostrar.
- **Por qué:** el modelo exige `modalidad` y la sede cuando corresponde (historia #8), así que el
  ejemplo tiene que tenerlos o la fila no sería representativa. El nombre del docente va
  desnormalizado porque es lo que la planilla muestra en esa columna, y `docente_id` puede ser nulo
  porque el modelo lo admite: inventar una sexta fila en el padrón para que el nombre calce sería
  agregar un dato que el cliente no registró.
- **Consecuencia:** ninguna de las dos columnas se renderiza en la tabla, porque el spec fija las
  columnas literales de esa pantalla y no incluye ninguna de las dos.
- **Dónde:** `frontend/src/mocks/comisiones.js`, `frontend/src/admin/CoursesPage.jsx`.

### M22 — La causa del comprobante aparece solo cuando el estado inicial no es acreditado

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** el formulario de cobranza muestra los ocho campos que fija el spec, en ese orden, y
  agrega un noveno campo, `Causa del comprobante no acreditado`, que aparece únicamente cuando el
  `Estado Inicial` no es `ACREDITADO` y que es obligatorio en ese caso.
- **Por qué:** D28 y la historia #45 hacen obligatoria la causa de una cobranza que no está
  acreditada, con el CHECK `causa_obligatoria_si_no_acreditado` en el modelo. Un formulario que
  deja registrar un cobro observado sin causa produciría una fila que la base real rechaza.
  Condicional, el formulario por defecto tiene exactamente los campos del spec.
- **Dónde:** `frontend/src/admin/PaymentsPage.jsx`.

### M23 — Los elementos de sesión son componentes compartidos por los tres shells

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `AvisoCambioContrasena` y `BotonCerrarSesion` salen de la pantalla de marcador de
  posición y viven en `src/components/session/`. El shell de Administración y el de las otras dos
  secciones los usan igual.
- **Por qué:** el aviso de contraseña pendiente responde a un requisito de `auth-and-roles` y la
  sesión es del contexto, no de una sección (M13). Con el aviso duplicado en tres pantallas, la
  primera que se actualice deja a las otras dos diciendo que el flujo de cambio existe.
- **Dónde:** `frontend/src/components/session/`, `frontend/src/pages/LandingPage.jsx`,
  `frontend/src/admin/AdminLayout.jsx`.

---

## Shell de Docente (work unit 8, grupo 10)

### M24 — El armazón de los tres shells es un componente compartido, no tres copias

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `src/components/shell/ShellFrame.jsx` dibuja panel lateral, barra superior,
  contenido y pie de las tres secciones. `AdminLayout`, `TeacherLayout` y `StudentLayout` solo
  pasan rótulos, ítems de menú y acento; el acento es un nombre por shell (`secretaria`, `docente`,
  `alumno`) que `ACENTOS` traduce a la vez al tono del chip y a las clases del panel. El ítem
  deshabilitado se dibuja en el armazón como texto con la insignia `Próximamente` y sin ruta.
  `Avatar` llega como componente compartido nuevo, porque el pie y la ficha de perfil muestran las
  iniciales en las tres secciones.
- **Por qué:** 8.3 y 9.8 dicen que las tres secciones dibujan con los mismos componentes, y eso no
  era verificable: cada shell iba a tener su propio archivo de layout y "comparten componentes" iba
  a quedar como una afirmación sobre `Table` y `Badge` solamente. Con un armazón solo, la prueba de
  9.8 puede afirmar sobre el armazón que los tres usan —lo verifica leyendo que los tres importan
  `ShellFrame`— y un ítem Won't deshabilitado tiene una sola implementación en todo el proyecto.
  El acento además no puede quedar a medias: un solo nombre decide los dos colores.
- **Alternativa descartada:** dejar `AdminLayout` como estaba y escribir `TeacherLayout` y
  `StudentLayout` copiándolo. Es el camino corto y produce tres archivos que divergen: el primero
  que agregue un ítem deshabilitado, un aviso de contraseña o un pie nuevo deja a los otros dos
  diciendo que la función no existe.
- **Consecuencia:** `SECCIONES_ADMIN` gana `exacta: true` en la entrada raíz, porque el `end` del
  enlace raíz era una regla escrita en el layout y ahora es un dato de la sección.
- **Dónde:** `frontend/src/components/shell/ShellFrame.jsx`,
  `frontend/src/components/ui/Avatar.jsx`, `frontend/src/components/ui/paleta.js`,
  `frontend/src/admin/AdminLayout.jsx`, `frontend/src/docente/TeacherLayout.jsx`,
  `frontend/src/alumno/StudentLayout.jsx`.

### M25 — En los shells de docente y de alumno conviven el nombre de la sesión y el del maqueteado

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** el pie de los shells de docente y de alumno muestra las iniciales y el nombre que
  fija el spec —`PM` / `Profe Martín` y `CR` / `Camila Rodríguez`—, y la barra superior de las tres
  secciones muestra `session.nombre`, como ya hacía el shell de Administración. Los dos nombres
  conviven en pantalla y no se oculta ninguno.
- **Por qué:** los specs fijan el pie como literal, y el nombre de la sesión es lo único que le dice
  a la persona cuál de las tres cuentas está abierta. Que sean dos textos distintos no es una
  decisión de diseño: es que las cuentas de demostración del backend son `Rita Molina` para el rol
  docente y `Agustina Benítez` para el alumno, mientras que el prototype trabaja con `Profe Martín`
  y `Camila Rodríguez`. Se consideró sacar el nombre de la barra y se descartó: `SessionContext`
  comprueba la restauración de sesión verificando que el nombre de `GET /auth/me` aparezca en
  pantalla, y `src/auth/` no se toca en este change (M12). Adonde una prueba limita el diseño, el
  diseño cede; lo que no corresponde es romper una prueba de un directorio ajeno.
- **Supuesto asumido:** hasta que exista el endpoint que resuelve la cuenta al padrón (M17), el shell
  muestra la persona de referencia en el pie y la cuenta en la barra. Es una concesión de entorno de
  demostración, como la de D18 con la contraseña.
- **Pendiente:** cuando exista el endpoint, el pie sale de la sesión y no de una constante de
  navegación, y los dos nombres pasan a ser uno. Si el cliente quiere que las cuentas de
  demostración sean las mismas personas del maqueteado, es un cambio del seed del backend y no del
  frontend.
- **Dónde:** `frontend/src/docente/navegacion.js`, `frontend/src/alumno/navegacion.js`,
  `frontend/src/components/shell/ShellFrame.jsx`.

### M26 — Los horarios del docente y del alumno son un campo más del ejemplo, no una derivación

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `CUR-101` suma `horario_legible` (`Mar y Jue · 19 a 21 hs`) y `proxima_clase`
  (`Hoy · 19:00`) al lado del `dias_horarios` corto del catálogo, y la inscripción del alumno suma
  `horario_legible` y `horario_prolongado`. Los datos de ejemplo de asistencia, cronograma y
  próximos encuentros van en `src/mocks/asistencias.js` y `src/mocks/inscripciones.js`.
- **Por qué:** los shells de docente y de alumno muestran el horario con punto medio
  (`Mar y Jue · 19 a 21 hs`) y en algunos lugares desarrollado (`Lunes y miércoles · 18:30 a
  21:30`), y la columna del catálogo muestra la forma corta. Un horario no se parte por espacios:
  derivarlo con operaciones de texto sobre `Mar y Jue 19 a 21 hs` se rompe el día que una comisión
  diga `Sábados 10 a 13 hs` y que nadie sepa cuál era cuál. Es el mismo criterio con el que M21
  completó `modalidad` y `sede`.
- **Dato de referencia, no dato de negocio:** `proxima_clase`, el cronograma y los temas de clase
  no están en la planilla del cliente. Van como referencia y P5 sigue siendo el pendiente que los
  carga de verdad.
- **Dónde:** `frontend/src/mocks/comisiones.js`, `frontend/src/mocks/asistencias.js`,
  `frontend/src/mocks/inscripciones.js`.

### M27 — El ejemplo no tiene link de clase cargado, y la validación de URL vive en el servicio

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `src/mocks/clases.js` arranca con la colección `LINKS_DE_CLASE` vacía.
  `guardarLinkClase` valida la URL en la implementación de datos y devuelve `{ ok, error }` en lugar
  de lanzar; la pantalla muestra el error pegado al campo y no confirma nada. La carga del link no
  cambia el acceso de ningún alumno.
- **Por qué:** con el ejemplo sin link, el shell del alumno abre en el estado en que está de verdad
  un alumno recién inscripto —habilitado, con el profesor todavía sin publicar el link—, que es uno
  de los tres estados que el spec exige cubrir; los otros dos se alcanzan con las propias acciones
  del maqueteado: el docente carga el link y el alumno ve el botón, y la secretaría fuerza un
  bloqueo con `forzarBloqueoManual`. Agregar un link de ejemplo para que el botón se viera desde el
  primer clic sería inventar el estado que el cliente todavía no tiene.
- **Por qué un resultado y no una excepción:** la pantalla tiene que poder mostrar el error sin
  confirmar la carga, y eso se lee mejor con un resultado explícito que con un `try/catch` (D17 usa
  la misma forma para el envío de correo). La validación está en el servicio y no en la pantalla
  porque es la misma regla que va a validar el backend.
- **Dónde:** `frontend/src/mocks/clases.js`, `frontend/src/services/mockDataSource.js`,
  `frontend/src/services/apiDataSource.js`, `frontend/src/docente/CommissionDetailPage.jsx`.

### M28 — `ESTADO_ASISTENCIA` va en `src/domain/enums.js` aunque el backend no lo tenga

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** los dos valores `PRESENTE` y `AUSENTE` viven en `src/domain/enums.js`, junto a los
  enums que sí son copia del backend, y no en `src/mocks/asistencias.js`.
- **Por qué:** los usan las dos puntas —el dato de ejemplo y la pantalla—, y si el enum estuviera en
  los mocks la pantalla tendría que importarlos para nombrarlos, que es justo lo que D13 prohíbe.
  La alternativa era repetir el literal en los dos archivos, que es peor: dos lugares donde el
  valor puede quedar desincronizado.
- **Consecuencia:** ese enum es el único del archivo que todavía no existe en Python. El comentario
  del módulo lo dice, porque un archivo que dice "copia del backend" y tiene una entrada que no
  copia nada se vuelve una fuente de verdad falsa. Cuando exista el modelo, la entrada pasa a ser
  copia del enum de Python como las demás.
- **Dónde:** `frontend/src/domain/enums.js`, `frontend/src/mocks/asistencias.js`,
  `frontend/src/docente/AttendancePage.jsx`.

---

## Shell de Alumno (work unit 9, grupo 11)

### M29 — La inscripción del alumno vive en su propia colección y no en el catálogo de comisiones

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `src/mocks/inscripciones.js` guarda la inscripción del alumno del ejemplo —`CUR-102`
  con su docente, sus dos formas de horario, el arancel, el cronograma y los próximos encuentros— y
  se cruza con la fila de `ALUMNOS` para el documento, el email, el teléfono y el acceso. La
  comisión **no** se agrega a `comisiones.js`.
- **Por qué:** `comisiones.js` es un subconjunto de cinco de las diez comisiones del cliente y
  `mocks.test.js` verifica que sus totales den 160 lugares, 43 ocupados y 117 vacantes, que es lo que
  sostiene el `27%` del tablero. Meter `CUR-102` ahí cambiaría tres números verificados por una fila
  que el catálogo de Administración no muestra. La inscripción lleva lo que la pantalla del alumno
  necesita y el catálogo no usa.
- **Consecuencia:** `guardarLinkClase` no puede comprobar la existencia de una comisión mirando solo
  el catálogo, porque `CUR-102` no está ahí. Comprueba las dos colecciones; la comprobación de verdad
  la va a hacer el backend con su 404 o su 403.
- **Dónde:** `frontend/src/mocks/inscripciones.js`, `frontend/src/mocks/comisiones.js`,
  `frontend/src/services/mockDataSource.js`.

### M30 — El teléfono de la alumna del ejemplo es el único dato de contacto que se agrega

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `ALUMNOS` suma `telefono: '011 4788-1122'` a Camila Rodríguez, y a nadie más.
- **Por qué:** el spec del shell de alumno exige que el perfil muestre `Teléfono` con ese valor, y la
  planilla del cliente lo tiene para ella. Los otros cinco alumnos del padrón no tienen teléfono
  registrado, así que el campo queda en `null` para ellos y no se inventa uno.
- **Dónde:** `frontend/src/mocks/alumnos.js`.

### M31 — `Input` acepta campos deshabilitados con leyenda

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** el `Input` compartido acepta `disabled` y `leyenda`. El perfil del alumno los usa para
  `DNI` y `Nombre`, que el spec pide deshabilitados con la leyenda `solo lectura`.
- **Por qué:** la regla "estos dos no se editan" tiene que verse, no solo cumplirse. Un campo apagado
  sin explicación parece un error de la pantalla, y un campo que se ve igual que los editables obliga
  a probarlo para enterarse de que no funciona. La leyenda va en la etiqueta, así que forma parte del
  nombre accesible del campo y un lector de pantalla la anuncia con el rótulo.
- **Dónde:** `frontend/src/components/ui/Input.jsx`, `frontend/src/alumno/StudentProfilePage.jsx`.

### M32 — `alembic check` no verifica las columnas generadas, y hay que decirlo

- **Fecha:** 2026-10-06
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `curso.codigo` es la primera columna generada del esquema y, por lo tanto, la
  primera que el control automático no cubre.
  `test_la_migracion_escrita_a_mano_cuadra_con_los_modelos` corre `alembic check`, y esa
  comparación **ignora las columnas generadas**: si el `Computed(...)` del modelo y el
  `GENERATED ALWAYS AS ... STORED` de la migración se desincronizan —mismo nombre de columna,
  distinta expresión—, `alembic check` sigue_reportando cero diferencias.
- **Por qué:** D16 sigue siendo el control de que la migración escrita a mano cuadra con los
  modelos, y es donde cualquiera iría a verificar un cambio de esquema. Para esta columna ese
  control no alcanza, así que queda escrito para que nadie confíe en él.
- **Mitigación:** la red real es `app/tests/test_codigo_curso.py`, que siembra la secuencia con
  `setval` e inserta los identificadores 999, 1000 y 1001 —justo del lado de la frontera donde
  `lpad` trunca—, más un control negativo que levanta la expresión **sin** `greatest` para
  demostrar que el test no pasa por el motivo equivocado. Ese test restaura la secuencia con
  `last_value` **e** `is_called` en un `finally`, porque en PostgreSQL las secuencias no son
  transaccionales y un `setval` sobrevive al `rollback()` del fixture.
- **Advertencia que lo confirma:** el propio `alembic check` avisa
  `UserWarning: Computed default on curso.codigo cannot be modified`.
- **Dónde:** `app/models/catalogo.py`, `alembic/versions/0002_altas_catalogo.py`,
  `app/tests/test_codigo_curso.py`, `app/tests/conftest.py`.

---

## Catálogo de cursos por curso (change `pulsar-catalogo-cursos`)

### D37 — Una sola pantalla con dos vistas, y la ruta lleva el código del curso

- **Fecha:** 2026-10-06
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `CoursesPage` lee `cursos` de la ruta y dibuja el grid del catálogo
  (`/admin/cursos`) o la tabla de comisiones de ese curso (`/admin/cursos/:codigo`). El
  código se compara con `normalizeCode` de `src/domain/normalize`, el criterio de D6. No
  se crea una segunda pantalla ni un componente presentacional en `frontend/src/admin/`.
- **Por qué:** las dos vistas comparten los mismos cinco listados y el mismo modal de alta,
  así que partir el archivo repartiría el estado y duplicaría el modal. Y
  `shellConsistency.test.jsx` exige que todo `.jsx` de `admin/` lea sus datos por
  `dataService` y dibuje con `components/ui`: un modal presentacional en ese directorio
  rompería la prueba sin motivo. El código y no el identificador es lo que la secretaría
  lee en pantalla, y ya es el parámetro de las rutas de docente y de alumno.
- **Dónde:** `frontend/src/admin/CoursesPage.jsx`, `frontend/src/App.jsx`.

### D38 — El conteo de comisiones por curso se deriva en el cliente

- **Fecha:** 2026-10-06
- **Autor:** Equipo TechAcademy BA
- **Decisión:** la tarjeta del curso cuenta las comisiones agrupando por
  `normalizeCode(comision.curso.codigo)` sobre el estado que la pantalla ya descarga.
  `GET /cursos` no gana ningún campo y el conteo no sale del backend.
- **Por qué:** es el mismo criterio de `obtenerResumenCatalogo`, que también deriva en el
  cliente (D15). Agregar `comisiones_asignadas` a la respuesta obligaría a tocar backend,
  contrato y prueba para calcular una resta que el frontend ya puede hacer con las dos
  listas que descarga. La tarjeta y la tabla salen del mismo grupo, así que no pueden
  contradecirse.
- **Techo, y es el punto flojo:** el conteo es O(n) sobre las comisiones y el filtro de la
  tabla es O(n) por cada curso abierto. Con el tamaño del catálogo de la secretaría es
  irrelevante; con cientos de cursos, la respuesta de `GET /cursos` es el lugar correcto y
  el cambio queda dentro de la fuente de datos.
- **Dónde:** `frontend/src/admin/CoursesPage.jsx`.

### D39 — El buscador de las dos vistas se ve deshabilitado y no filtra

- **Fecha:** 2026-10-06
- **Autor:** Equipo TechAcademy BA
- **Decisión:** las dos vistas muestran su campo de búsqueda con `disabled`, `readOnly` y
  la leyenda `la búsqueda todavía no está disponible`. No hay estado, no hay servicio y no
  hay contrato de búsqueda.
- **Por qué:** D20 pide mostrar el hueco en vez de esconderlo. Un campo que se ve igual que
  los demás y no acepta el foco obliga a probarlo para enterarse, y un campo habilitado que
  no filtra hace creer a la secretaría que filtró. La búsqueda es una historia que todavía
  no se escribió.
- **Dónde:** `frontend/src/admin/CoursesPage.jsx`.

---

## Configuración del repositorio

### R1 — `opencode.json` declara Context7 sin API key

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** el servidor MCP de Context7 se declara como remoto público
  (`https://mcp.context7.com/mcp`) **sin** encabezado de API key.
- **Por qué:** el equipo no definió una clave de Context7 para el proyecto, y
  el servidor responde sin ella. Guardar la clave en el repositorio sería peor
  que no guardarla: si algún día hace falta, la variable es `CONTEXT7_API_KEY`
  y el encabezado `Context7-API-Key`, y se documenta en `.env.example` junto a
  las demás, no en un archivo de configuración que se versiona.

### R2 — `AGENTS.md` sin bloque gestionado por OpenSpec

- **Fecha:** 2026-10-02
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `AGENTS.md` se crea sin marcadores `<!-- OPENSPEC:START -->` /
  `<!-- OPENSPEC:END -->`, y todo su contenido es del equipo.
- **Por qué:** este proyecto inicializó OpenSpec con `--tools opencode`, que
  escribe en `.opencode/` y `openspec/`. La raíz `AGENTS.md` es del usuario:
  OpenSpec nunca la escribe y, si alguna vez aparece un bloque con esos
  marcadores, solo reescribe lo que está entre ellos. Fabricar un bloque
  gestionado vacío en un archivo que OpenSpec no administra sería mentir sobre
  quién manda sobre cada línea.
- **Cómo se mantiene:** si un tool futuro agrega el bloque, el contenido del
  equipo queda fuera y no se toca el bloque.

---

## Integración continua y verificación (work unit 10, grupo 12)

### R3 — La CI corre sobre los runners de GitHub, no con `docker compose`

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `.github/workflows/ci.yml` define dos jobs. El de backend usa
  `actions/setup-python` con 3.12 y declara PostgreSQL 16 en `services:`; el de
  frontend usa `actions/setup-node` con 22. Los comandos son exactamente los que
  el equipo corre en local y en el mismo directorio: `ruff check .`, `pytest`,
  `npm ci`, `npm run lint`, `npm run test` y `npm run build`. El job de backend
  define `DATABASE_URL`, `TEST_DATABASE_URL` y `JWT_SECRET_KEY`.
- **Por qué:** la alternativa era `docker compose run --rm backend pytest` dentro
  del workflow, que reutiliza el `compose` y garantiza que la CI es bit a bit el
  entorno local. Se descartó porque obliga a construir las dos imágenes y a
  levantar los tres servicios en cada corrida para ejecutar dos comandos, y
  porque un fallo de dependencias aparece como un fallo de build de imagen en
  lugar de como un `pip install` que falta. Con `setup-python` y `setup-node` los
  comandos son los del día a día y la diferencia con la máquina queda escrita y
  acotada: **solo cambia dónde vive PostgreSQL**, que localmente es el servicio
  `db` del compose y en el runner es un `services:` del job.
- **Consecuencia:** `app/tests/conftest.py` crea la base de pruebas solo cuando
  `TEST_DATABASE_URL` **no** está definida. La CI la define, así que el workflow
  tiene que crearla antes de `pytest`: lo hace con `psycopg`, que ya es
  dependencia del proyecto, para no depender de que el runner traiga `psql`.
- **Pendiente:** la caché de `pip` quedó desactivada. `backend/` no tiene
  `requirements.txt` y cachear por `pyproject.toml` no se pudo verificar sin una
  corrida real del workflow, así que no se agregó algo que no se probó.
- **Dónde:** `.github/workflows/ci.yml`, `backend/app/tests/conftest.py`.

### R4 — Los tiempos que se documentan van con su condición de medición

- **Fecha:** 2026-10-03
- **Autor:** Equipo TechAcademy BA
- **Decisión:** el README anota cuánto tarda el setup con la fecha, la máquina y
  la condición en que se midió —en este caso, con la caché de capas de Docker
  ya tibia— y separa lo medido de lo no medido.
- **Por qué:** un tiempo sin la condición con que se midió no es una
  medición, es una promesa. La primera corrida en una máquina limpia depende de
  la velocidad de la conexión y no se puede medir en la máquina del equipo, así
  que anotarla como si estuviera medida sería mentir por omisión.
- **Dónde:** `README.md`, sección "Levantar el proyecto".

### R5 — En el `opencode.json` del proyecto solo entran los MCP portables

- **Fecha:** 2026-10-05
- **Autor:** Equipo TechAcademy BA
- **Decisión:** `opencode.json` declara Context7 (remoto, sin API key, R1) y CodeGraph (local,
  `codegraph serve --mcp`). Engram **no** se declara: cada miembro lo registra con
  `engram setup opencode`, que lo escribe en la configuración global de su máquina. Ponytail
  tampoco: es un plugin, no un MCP, y queda en el global de cada uno.
- **Por qué:** el criterio no es qué herramienta usamos, sino si su registro sobrevive a un
  `clone` en otra máquina. `engram setup` escribe la **ruta absoluta** del binario
  (`C:\Users\<usuario>\...\engram.exe`), y una ruta absoluta en un archivo versionado no
  funciona en la máquina de nadie más. CodeGraph en cambio se resuelve por `PATH`, que sí es
  portable, así que va en el repo. Ponytail se deja fuera por otra razón: reescribe
  `AGENTS.md` e inyecta en el prompt de cada agente, así que ponerlo en el repo le quitaría
  el veto a los tres. Lo que sí se comparte es la convención, y ya está en "Cambio directo o
  propuesta".
- **Consecuencia:** `.gitignore` ignora `.codegraph/`. El índice es local y por máquina, así que
  **cada clone necesita su propio `codegraph init`**: sin él el servidor levanta y devuelve
  vacío, que es la forma más confusa de fallar. No se ignoró `.engram/` porque todavía no
  existe: si el equipo llegara a querer memoria compartida por repo, ignorarla lo impediría
  en silencio.
- **Dónde:** `opencode.json`, `.gitignore`, `README.md` (sección "Herramientas para desarrollar
  con IA"), `AGENTS.md` (sección "Herramientas").

---

## Aparencia Figma de los shells y los tableros (change `ui-figma-dashboards`)

### D40 — La apariencia nueva sale de los JSON de Figma, con paleta por rol y sin datos del prototipo

- **Fecha:** 2026-10-09
- **Autor:** Equipo TechAcademy BA
- **Decisión:** los tres shells se redibujan con el lenguaje de los JSON exportados de Figma
  —fondo degradado por rol con retícula, lateral blanco translúcido sin rótulo de título y con
  íconos, barra superior con breadcrumb, búsqueda inerte, campana inerte y perfil con
  `Cerrar sesión`, pie de tres textos— y con tres acentos en paleta stock: dorado (Alumno),
  verde (Docente) y azul (Secretaría). Los tableros son las pantallas índice existentes,
  recompuestas con datos del maquetado; lo que el prototipo muestra sin datos detrás
  —gráficos, tareas, calificaciones, correcciones, novedades— no se construye. La sede sale
  del armazón y se conserva en las pantallas de dominio. Las fechas y la `Última actualización`
  quedan literales placeholders.
- **Por qué:** Figma es la autoridad de estructura y estilo (`AGENTS.md`) y aporta cero datos;
  los números del PDF (`1.248 alumnos`, `68% de progreso`) contradicen el maquetado. Los chips,
  títulos de panel y textos de pie que se eliminan estaban fijados en los specs de shell, por
  eso entran como deltas del change y no como cambios de código silenciosos.
- **Dónde:** `openspec/changes/ui-figma-dashboards/`,
  `docs/design/figma-dashboards-overhaul/`,
  `frontend/src/components/shell/ShellFrame.jsx`, `frontend/src/index.css`,
  `frontend/src/*/navegacion.js`.

---

### D41 — El experimento `ui-appearance-improvement` se descarta y no se fusiona

- **Fecha:** 2026-10-09
- **Autor:** Equipo TechAcademy BA
- **Decisión:** la rama `feat/ui-appearance-improvement` (commit `e6cb747`) queda sin fusionar y
  sin borrar; el trabajo nuevo arranca de `feat/altas-catalogo-docentes` con la rama
  `feat/ui-figma-dashboards` y el change `ui-figma-dashboards`.
- **Por qué:** el equipo probó ese acabado y no le gustó cómo quedó, así que se trata como
  rollback. Borrar la rama destruiría el registro de lo que se probó, y fusionarla impondría
  una paleta —terracota, teal, índigo— que la decisión D40 reemplaza.
- **Dónde:** rama `feat/ui-appearance-improvement`.

---

## Pendientes

Decisiones que hay que tomar y que **no** bloquean el scaffold. Se resuelven
con el cliente o entre los tres del equipo.

| # | Pendiente | Quién decide | Por qué sigue abierta |
|---|---|---|---|
| P1 | Esquema de cuotas y de cobro | Cliente | La historia #27 habla de "cuota vigente" y "cuota vencida": la regla no se puede escribir sin esto (D11). |
| P2 | Proveedor de correo | Equipo | Se elige en el sprint siguiente. La interfaz de D17 no cambia. |
| P3 | Camino de alcance (Must+Should o solo Must) | Cliente | No cambia el scaffold. |
| P5 | Cronograma y temas de clase | Cliente | La historia #38 los muestra al alumno pero ninguna historia los carga. |
| P6 | Datos que exige un alumno del exterior | Cliente | La historia #47 entra solo con pasaporte. |
| P7 | Dígito verificador del CUIL | Cliente | El CUIL es único pero **ya no es obligatorio** (D33): lo que sigue pendiente es validar su dígito verificador cuando venga cargado, y el equipo no lo pidió. |
| P8 | `.gitattributes` con `* text=auto eol=lf` | Equipo | Con `core.autocrlf=true` en Windows, git rompe el `end_of_line = lf` de `.editorconfig` en cada clon. Ver más abajo. |
| P10 | Firma de la Definition of Done | Equipo | Se firmó el recorrido el 2026-10-03, en local y después de que el PR #45 saliera mergeado, así que la firma quedó en `docs/verificacion-definition-of-done.md` y no en el PR. La fila de **revisión de la lista** sigue sin firmar: la hace alguien distinto de quien recorrió la interfaz. |

### P4 — Resuelto: todos los montos son pesos argentinos

El pendiente pedía una decisión del cliente porque el Excel tenía al menos un cobro en dólares y
el modelo asumía pesos. La respuesta no fue cambiar el modelo: fue decidir que **los dólares de la
planilla son un dato de ese archivo, no una exigencia del sistema**, y que todos los montos son
pesos argentinos (D35).

Lo que queda escrito:

- No hay columna de moneda ni tipo que la admita. Un monto es `Numeric(14, 2)` y se muestra con el
  formato de es-AR.
- No hubo migración: el modelo ya era así.
- Si algún día hace falta otra moneda, es un change nuevo con columna de moneda y tipo de cambio
  con fecha, no un ajuste de esta decisión.

### P9 — Resuelto: el remoto sí existe y la integración continua ya corrió

Este pendiente se abrió sobre una afirmación que era **falsa**. Se escribió que el repositorio no
tenía remoto configurado, y de ahí salieron las tres cosas que se afirmaron después: que la
integración continua nunca se ejecutó, que no hay dónde firmar la lista y que la 12.5 no se puede
hacer.

Lo verificado, con comando:

- `git remote -v` devuelve `origin https://github.com/PonceMateo/TechAcademyBA.git`.
- La rama `feat/bootstrap-initial-scaffold` está pusheada e idéntica a `origin`.
- El `push` de `d86fa37` disparó el workflow y la corrida terminó en **`success`**, con los dos
  jobs (`backend` y `frontend`) en verde.

La única conclusión que sí era correcta: **la 12.5 sigue sin hacer**, porque depende de que el
equipo abra el pull request.

### Detalle de P8 — `core.autocrlf` contra `.editorconfig`

En una máquina Windows, `git config core.autocrlf` devuelve `true`: git
reescribe LF a CRLF al hacer checkout, así que los archivos llegan al árbol de
trabajo con CRLF aunque `.editorconfig` pida LF. El índice sigue normalizado a
LF, así que **no se generan diffs espurios**, pero la regla del `.editorconfig`
no se cumple en la práctica y el `diff` de un archivo que el editor reescribió
a LF muestra el cambio de fin de línea completo.

La solución es un `.gitattributes` con `* text=auto eol=lf`, que pisa el
`core.autocrlf` local. No se agregó acá porque `.gitattributes` no está en el
alcance de este change; queda a criterio del equipo agregarlo.
