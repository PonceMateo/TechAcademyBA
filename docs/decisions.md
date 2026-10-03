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
  `alumno.email`, `usuario.email`, `usuario.nombre`.
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

## Pendientes

Decisiones que hay que tomar y que **no** bloquean el scaffold. Se resuelven
con el cliente o entre los tres del equipo.

| # | Pendiente | Quién decide | Por qué sigue abierta |
|---|---|---|---|
| P1 | Esquema de cuotas y de cobro | Cliente | La historia #27 habla de "cuota vigente" y "cuota vencida": la regla no se puede escribir sin esto (D11). |
| P2 | Proveedor de correo | Equipo | Se elige en el sprint siguiente. La interfaz de D17 no cambia. |
| P3 | Camino de alcance (Must+Should o solo Must) | Cliente | No cambia el scaffold. |
| P4 | Moneda | Cliente | Hay al menos un cobro en dólares y el modelo asume pesos argentinos. |
| P5 | Cronograma y temas de clase | Cliente | La historia #38 los muestra al alumno pero ninguna historia los carga. |
| P6 | Datos que exige un alumno del exterior | Cliente | La historia #47 entra solo con pasaporte. |
| P7 | Dígito verificador del CUIL | Cliente | El dato es obligatorio y único, pero el equipo no pidió validarlo. |
| P8 | `.gitattributes` con `* text=auto eol=lf` | Equipo | Con `core.autocrlf=true` en Windows, git rompe el `end_of_line = lf` de `.editorconfig` en cada clon. Ver más abajo. |

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
