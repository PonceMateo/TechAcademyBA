# AGENTS.md

Flujo de trabajo del equipo de TechAcademy BA. Leerlo antes de tocar nada.

OpenSpec administra `openspec/` y `.opencode/`: si alguna vez aparecen bloques
`<!-- OPENSPEC:START -->` / `<!-- OPENSPEC:END -->`, OpenSpec reescribe solo lo
que está entre ellos. El resto de este archivo es del equipo.

## Fuentes de verdad

1. **GitHub Projects** (`TechAcademyBA`, project #1, owner `PonceMateo`). Única
   fuente viva del backlog: qué historias existen, su texto, prioridad, épica,
   estimación y estado (`Backlog`, `Ready`, `In progress`, `In review`, `Done`).

   ```
   gh project item-list 1 --owner PonceMateo --limit 100 --format json --jq '.items[] | [.content.number, .content.title, .status, .priority] | @tsv'
   gh issue view <número> --json title,body,state
   ```

   Siempre con `--limit 100`: sin esa bandera recorta a 30 items y parece que
   faltan historias. No hay `--offset`: se pagina subiendo el límite. Filtrá con
   `--jq` en vez de pedir el JSON completo, que trae el cuerpo de cada issue.
   Cada historia es un issue `H/U <n> · <título>`; el número del issue no es el
   número de la historia. El campo Priority es MoSCoW (`Must`, `Should`,
   `Could`, `Won't`) y el equipo puede agregar opciones. Una historia está
   terminada cuando `Status` es `Done`, no cuando el issue está cerrado.
2. **Contextualización del problema** (`docs/requirements/`). Modelo de negocio.
3. **Maqueta PPTX.** Alcance negociado y los dos caminos de MVP.
4. **Figma.** Pantallas y estilo. Aporta cero datos.
5. **Excel del cliente.** Es el problema, no la solución: muestra qué datos hay
   que sostener y qué ambigüedades resolver. Un objetivo del proyecto es
   deshacerse de él.
6. **Histórico, no fuente:** el CSV de historias de
   `docs/requirements/Historias_de_Usuario_TechAcademy_BA.csv`. Es la foto que
   se entregó en la materia. Está congelado: no se lee para implementar, no se
   actualiza y no se sincroniza con el board.

Si el board no es accesible, pedile acceso al usuario (ver Herramientas). Si
prefiere seguir igual, seguí con lo que haya en el repo y decilo.

## Historia nueva

Se agrega al board, nunca al CSV: issue `H/U <n> · <título>` con descripción y
criterios de aceptación, label `Épica: <nombre>`, y en el project Priority,
Épica, Estimación y `Status=Backlog`. Verificá que la historia esté en el board
antes de implementarla.

## Cambio directo o propuesta

**Cambio directo, en la rama y sin propuesta**, cuando el comportamiento
observable no cambia: bugfix que restaura lo especificado, typos y estilos,
refactor interno, tests de código existente, configuración y dependencias.

**Propuesta en OpenSpec** (`/opsx-propose`) cuando cambia el contrato: historia
nueva o modificada, regla de negocio, modelo de datos, contrato de API,
seguridad o permisos.

**Ante la duda, consultá en una línea** a una persona del equipo, con la duda y
lo que asumiste. Una propuesta para una duda de cinco minutos es cara de
revisar; si la respuesta te cambia el modelo o una regla, ahí sí es propuesta.

## Arranque de una propuesta o una feature

Antes de abrir un cambio (`/opsx-propose`) o de empezar una historia, preguntá
una sola vez si hace falta grilling: rondas de preguntas con multiple choice
para acordar el alcance. Si el usuario elige grilling, no escribas ni abras la
rama hasta que confirme que el entendimiento es compartido.

## Ramas

`<tipo>/<slug>/<Nombre>-<Apellido>`, siempre desde `main`, con el nombre y el
apellido de quien la crea.

- `feat/hu-<n>-<slug>` — ejemplo: `feat/hu-27-estado-habilitacion/Mateo-Ponce`.
- `fix/<slug>` — corrección sin historia asociada.
- `chore/<slug>` — higiene, tooling, documentación, configuración.

| `user.name`     | Autor de la rama    |
|-----------------|---------------------|
| `PonceMateo`    | `Mateo-Ponce`       |
| `santitorrens1` | `Santiago-Torrens`  |
| `agutor`        | `Agustin-Torres`    |

Antes de crear la rama mirá `git config user.name`. Si no está en la tabla, no
adivines: preguntá con una opción por integrante.

## Commits

`<tipo>(<ámbito>): <descripción en imperativo y en minúscula>`, con tipo entre
`feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `build`, `ci`. Un
work unit, un commit.

```
chore(repo): add project hygiene, team conventions and glossary
feat(auth): add email and password login endpoint
```

Sin `Co-Authored-By` ni firmas de IA.

## Trazabilidad

- `Refs #N` referencia la historia. Es lo que usa el pull request.
- `Closes #N` solo si la historia cumple todos sus criterios y queda `Done`.

Este proyecto maqueta: cerrar issues a medias hace que el backlog mienta sobre
el estado real del producto. La plantilla del PR pide el issue o `ninguno,
cambio menor`.

## Decisiones

Toda decisión técnica no funcional, y la causa raíz de un error, se registra en
`docs/decisions.md` con fecha y autor **antes** de aplicarla. Las decisiones de
alcance, contrato o modelo van también en el change de OpenSpec.
`docs/glossary.md` traduce la terminología del cliente.

## Herramientas

Los MCP se declaran en `opencode.json` y llegan con el `pull`. Si uno falla, la
causa casi siempre es el binario que lo lanza (Node, `npx`), no la config.

- **gh.** Si falta: `winget install --id GitHub.cli -e` (Windows) o
  `brew install gh` (macOS); preguntá antes de instalar. Login una vez por
  máquina con `gh auth login --web -s project`, o `gh auth refresh -s project`
  si ya hay sesión: el scope `project` no viene por defecto. Nunca pidas el
  token por chat.
- **CodeGraph.** Indexa el repo en `.codegraph/` (local, no versionado) y se
  lanza con `npx` desde `opencode.json`. Si falta el índice, preguntá una vez
  si correr `npx -y @colbymchenry/codegraph init`. Si no hay Node, avisale al
  usuario y seguí con Read, Grep y Glob.
- **Context7.** Documentación de librerías. La lógica del proyecto se lee en el
  repo.
- **Engram.** Memoria entre sesiones; se configura con `engram setup opencode`
  en la configuración global de cada máquina, por eso no está en el repo.

## Convenciones técnicas

No se negocian por historia; el detalle está en `docs/decisions.md`.

- **Sin TypeScript.** El frontend es JavaScript.
- **Tests del backend con pytest.** `unittest` no se usa.
- **Tests contra PostgreSQL real**, nunca SQLite: el modelo usa `num_nonnulls`,
  índices únicos sobre columnas normalizadas y CHECKs que SQLite no tiene.
- **El idioma del código sigue al dominio, que es español:** `Comision`,
  `Inscripcion`, `Cobranza`, sin tildes en el código. Nombres, código y paths en
  inglés; el glosario traduce hacia afuera.
- **La UI es es-AR** y no hay i18n: los strings no se extraen.
- **Solo el login llama al backend.** El resto del frontend consume
  `src/services/`, única frontera de datos; los componentes no importan
  `src/mocks/` ni conocen la fuente.
- **Los datos del maquetado son placeholders.** La secretaría carga los reales
  cuando el sistema esté funcional.
