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
