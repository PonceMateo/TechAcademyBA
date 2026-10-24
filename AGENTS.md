# AGENTS.md

Flujo de trabajo del equipo de TechAcademy BA. Leerlo antes de tocar nada.

OpenSpec administra `openspec/` y `.opencode/`. Si aparecen bloques
`<!-- OPENSPEC:START -->` / `<!-- OPENSPEC:END -->`, OpenSpec reescribe solo lo
que está entre ellos.

## Idioma

- El agente habla en español. Los commits van en español.
- Los subagentes trabajan y responden en inglés, salvo que su tarea produzca
  texto para el usuario (strings de UI, commits, docs en español).
    - Los subagentes no devuelven código ni logs completos.
- La UI es es-AR y no hay i18n: los strings no se extraen.
- Nombres en el código: seguí la convención de la capa (frontend mayormente en
  español, backend mayormente en inglés), sin mezclar idiomas dentro de un
  módulo ni renombrar solo por idioma.
- Sin tildes en identificadores, archivos y ramas (sí en texto de UI).
- `docs/glossary.md` traduce la terminología del cliente: consultalo antes de
  nombrar un concepto del dominio.

## Herramientas

Antes de cualquier tarea, una sola vez por sesión: `node .opencode/commands/check-tools.mjs`.
Si todo dice OK, seguí. Si algo no, leé `docs/tooling.md` y resolvelo antes de
arrancar skills o planificación.

Cada vez que este archivo diga "preguntá", usá la herramienta `question` de
opencode (opción múltiple), no texto libre.

- **gh:** necesario para leer el backlog. Nunca pidas el token por chat.
- **CodeGraph:** preferilo a leer archivos enteros.
- **Context7:** docs de librerías. Si falla, no inventes APIs ni versiones y avisá.
- **Engram:** memoria entre sesiones. Si falla, seguí sin memoria.

## Comandos y estructura

Todo corre en contenedores con `docker compose`, no con Python ni Node locales.
Comandos: sección "Comandos" del `README.md`. Carpetas: sección "Estructura".
- Limitá siempre el output de los comandos (modo silencioso, `-q`, solo las
  últimas ~40 líneas). En docker compose: servicios con `up -d` y comandos con
  `exec`, nunca `up` en primer plano.
- Si estás en Windows, el shell es PowerShell 5.1: no uses `||`, `&&`, `grep`,
  `head`, `cat` ni `2>/dev/null`. Usá `;`, `Select-String`,
  `Select-Object -First N` y la herramienta Read para leer archivos. En
  Linux/Mac usá bash normal.
- Si un comando falla, corregilo con la sintaxis del shell; no lo reemplaces por
  scripts de `node -e`.

## Fuentes de verdad

1. **GitHub Projects** (`TechAcademyBA`, project #1, owner `PonceMateo`): única
   fuente viva del backlog (texto, prioridad, épica, estimación y estado:
   `Backlog`, `Ready`, `In progress`, `In review`, `Done`).

   ```
   gh project item-list 1 --owner PonceMateo --limit 100 --format json --jq '.items[] | [.content.number, .content.title, .status, .priority] | @tsv'
   gh issue view <número> --json title,body,state
   ```

   - Copiá el primer comando tal cual y filtrá las filas después. Nunca vuelques
     el JSON completo: trae el cuerpo de cada issue.
   - Siempre `--limit 100`: sin eso recorta a 30 y parece que faltan historias.
   - Cada historia es un issue `H/U <n> · <título>`; el número del issue no es
     el de la historia. Priority es MoSCoW.
   - Una historia está terminada cuando `Status` es `Done`, no cuando el issue
     está cerrado.
   - En PowerShell 5.1 no pongas comillas dobles dentro de `--jq`: las pierde y
     `jq` falla.
   - Si el board no es accesible, pedile acceso al usuario; si prefiere seguir,
     usá lo que haya en el repo y decilo.
   - Para una historia, buscá su fila por título (`H/U 28 ·`) en el listado y
     usá el número de issue de esa fila con `gh issue view`. Nunca asumas que
     coinciden.
   - Nunca corras `gh project item-list` sin el `--jq` del comando de arriba.
2. **Contextualización del problema** (`docs/requirements/`): modelo de negocio.
3. **Maqueta PPTX:** alcance negociado y los dos caminos de MVP.
4. **Referencia secundaria:** Figma (pantallas y estilo, cero datos), Excel del
   cliente (es el problema, no la solución) y el CSV de historias (congelado, no
   se lee ni se actualiza).

## Historia nueva

Se agrega al board, nunca al CSV: issue `H/U <n> · <título>` con descripción y
criterios de aceptación, label `Épica: <nombre>`, y en el project Priority,
Épica, Estimación y `Status=Backlog`. Verificá que esté en el board antes de
implementarla.

## Cambio directo o propuesta

- **Cambio directo** si el comportamiento observable no cambia: bugfix que
  restaura lo especificado, typos, estilos, refactor interno, tests de código
  existente, configuración y dependencias.
- **Propuesta en OpenSpec** (`/opsx-propose`) si cambia el contrato: historia
  nueva o modificada, regla de negocio, modelo de datos, API, seguridad o permisos.
- **Ante la duda**, consultá en una línea a una persona del equipo.

## Sesiones y contexto

- Al arrancar una planificación, preguntá **una sola vez** (Sí / No) si quiere
  una sesión de preguntas exhaustiva para calibrar el alcance (opcional;
  explicalo sin jerga). Avisale que consume muchos tokens, y recomendala solo
  si el pedido inicial es vago o ambiguo. Si el pedido ya es claro, recomendá que no.
  **Sí:** cargá `grill-me` y no escribas ni abras la rama hasta que el usuario
  confirme que el entendimiento es compartido. **No:** seguí.
- Al terminar el grill, recomendale al usuario abrir una sesión nueva para el apply; si prefiere
 seguir en la misma, que corra `/compact` antes.
- No leas archivos de más de 200 líneas completos: usá CodeGraph, Grep o Read
  con offset/limit.

## Ramas y commits

**Ramas:** `<tipo>/<slug>/<Nombre>-<Apellido>`, desde `main`, terminadas con
nombre y apellido de quien la crea. Tipos: `feat/hu-<n>-<slug>`, `fix/<slug>`,
`chore/<slug>`. Mirá `git config user.name` y la tabla de `docs/branching.md`;
si no está, preguntá con una opción por integrante.

**Commits:** `<tipo>(<ámbito>): <descripción en imperativo y en minúscula>`, con
tipo entre `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `build`,
`ci`. Un work unit, un commit. Sin `Co-Authored-By` ni firmas de IA.

**Trazabilidad:** `Refs #N` referencia la historia. `Closes #N` solo si cumple
todos sus criterios y queda `Done`. El PR pide el issue o `ninguno, cambio menor`.

## Migraciones

Si la rama toca `backend/alembic/`, avisale al usuario antes de pushear a
`main`: el deploy de Vercel no corre `alembic upgrade head`; la migración de
Supabase en producción se aplica a mano.

## Decisiones

Toda decisión técnica no funcional y la causa raíz de un error se registran en
`docs/decisions.md` con fecha y autor **antes** de aplicarlas. Las de alcance,
contrato o modelo van también en el change de OpenSpec.

## Skills

Si la tarea no entra en estas áreas, no cargues skills.

| Área | Skills |
|---|---|
| `backend/app/` (rutas, schemas) | `fastapi`, `pydantic` (async: `fastapi-python`) |
| Modelos, queries, `backend/alembic/` | `sqlalchemy`, `sqlalchemy-alembic-expert-best-practices-code-review`, `supabase-postgres-best-practices` |
| Consultas lentas / índices | `sql-optimization-patterns` |
| Tests del backend | `python-testing-patterns` |
| `frontend/src/` | `vercel-react-best-practices`, `ui-styling` |
| Pantalla nueva o desde imagen | `ui-ux-pro-max`, `image-to-code` |
| Tests del frontend | `vitest` |
| Accesibilidad | `accessibility` |
| Change de OpenSpec | La skill `openspec-*` del paso |

## Convenciones técnicas

No se negocian por historia; detalle en `docs/decisions.md`.

- Sin TypeScript: el frontend es JavaScript.
- Tests del backend con pytest contra PostgreSQL real, nunca SQLite (el modelo
  usa `num_nonnulls`, índices únicos sobre columnas normalizadas y CHECKs).
- Los componentes no llaman al backend: todo pasa por `src/services/`, salvo
  login y cambio de contraseña (`src/auth/authClient.js`). No importan
  `src/mocks/` ni se agregan datos inventados a las pantallas.