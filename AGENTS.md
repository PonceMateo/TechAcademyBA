# AGENTS.md

TechAcademy BA workflow. Read before touching anything.

OpenSpec manages `openspec/` and `.opencode/`. If `<!-- OPENSPEC:START -->` / `<!-- OPENSPEC:END -->` blocks appear, OpenSpec rewrites only between them.

## Language

- Agent speaks Spanish. Commits in Spanish.
- Subagents work/respond in English, except output for user (UI strings, commits, docs in Spanish).
- UI is es-AR, no i18n: strings not extracted.
- Code names: follow layer convention (frontend mostly Spanish, backend mostly English), no mixing languages inside module or renaming only by language.
- No accents in identifiers, files, branches (yes in UI text).
- `docs/glossary.md` translates client terminology: consult before naming domain concept.

## Tools

Before every task, once per session: `node .opencode/commands/check-tools.mjs`. If OK, proceed. If not, read `docs/tooling.md` and fix before launching skills or planning.

When this file says "preguntá", use opencode `question` tool (multiple choice), not free text.

- **gh:** needed for backlog. Never ask for token in chat.
- **CodeGraph:** prefer to reading entire files.
- **Context7:** library docs. If fails, do not invent APIs or versions; warn.
- **Engram:** memory between sessions. If fails, continue without memory.

## Commands and structure

Everything runs in containers with `docker compose`, not local Python or Node. Commands: "Commands" section in `README.md`. Folders: "Structure" section.

- Always limit command output (silent mode, `-q`, last ~40 lines). In docker compose: services with `up -d`, commands with `exec`, never `up` in foreground.
- On Windows, shell is PowerShell 5.1: do not use `||`, `&&`, `grep`, `head`, `cat`, or `2>/dev/null`. Use `;`, `Select-String`, `Select-Object -First N`, and Read tool for files. On Linux/Mac use normal bash.
- If command fails, fix with shell syntax; do not replace with `node -e` scripts.

## Sources of truth

1. **GitHub Projects** (`TechAcademyBA`, project #1, owner `PonceMateo`): only live backlog source (text, priority, epic, estimation, status: `Backlog`, `Ready`, `In progress`, `In review`, `Done`). Read it only through the script:

   ```
   node .opencode/commands/backlog.mjs                      # active backlog (no Done). Default.
   node .opencode/commands/backlog.mjs --all                # full backlog including Done
   node .opencode/commands/backlog.mjs --status ready,backlog   # filter by board column(s)
   node .opencode/commands/backlog.mjs --story 28           # one story: board row + issue body
   ```

   - Output is TSV with header, sorted by story number descending. Columns: `story` (number from the `H/U <n> ·` title; `#<n>` when the title has none and the issue number is used instead), `title`, `status`, `priority` (MoSCoW), `estimate`, `issue` (GitHub issue number as `#<n>`).
   - `--status` takes one or more columns, comma-separated, case-insensitive. Quote names with spaces: `--status "In progress"`.
   - `--story <n>` looks up by story number and reads the issue using the issue number from that row. For rows without an `H/U` title use `--story "#<n>"` (quoted, `#` is a comment in some shells).
   - Never run `gh project item-list` directly: the script already handles limits, parsing and quoting for every shell.
   - Default mode hides `Done`. If a story is missing from the list, run `--all` before concluding it doesn't exist.
   - Story number and issue number differ: use the `story` column to identify stories.
   - Story done when `Status` is `Done`, not when issue is closed.
   - If board inaccessible, ask user for access; if prefers to continue, use whatever is in repo and say so.

   - Do not replace the script with ad-hoc `node -e` commands. If it fails, fix the script.
2. **Problem context** (`docs/requirements/`): business model.
3. **PPTX mockup:** negotiated scope and two MVP paths.
4. **Secondary reference:** Figma (screens and style, zero data), client's Excel (is the problem, not the solution) and story CSV (frozen, not read or updated).

## New story

Add to board, never to CSV: issue `H/U <n> · <title>` with description and acceptance criteria, label `Epic: <name>`, and in project Priority, Epic, Estimation and `Status=Backlog`. Verify it is on board before implementing.

## Direct change or proposal

- **Direct change** if observable behavior does not change: bugfix restoring spec, typos, styles, internal refactor, tests of existing code, config and dependencies.
- **OpenSpec proposal** (`/opsx-propose`) if contract changes: new or modified story, business rule, data model, API, security or permissions.
  - **Mandatory archive:** if you used SDD/OpenSpec, when done, **ask the user** (yes/no) if he wants to archive the change with `openspec archive <change>` (or `/opsx-archive`), to sync deltas to `openspec/specs/` and move to `archive/`. No active changes left; unarchived delta = not applied.
- **When in doubt**, ask in one line a team member.

## Sessions and context

- When starting planning, ask **once only** (Yes / No) if wants exhaustive question session to calibrate scope (optional; explain without jargon). Warn it consumes many tokens; recommend only if initial request vague or ambiguous. If request clear, recommend no.
  - **Yes:** load `grilling`, do not write or open branch until user confirms shared understanding. **No:** proceed.
- After grill, recommend opening new session for apply; if prefers to stay in same, run `/compact` first.
- Do not read entire files over 200 lines: use CodeGraph, Grep or Read with offset/limit.

## Branches and commits

**Branches:** `<type>/<slug>/<First>-<Last>`, from `main`, ending with name and surname of creator. Types: `feat/hu-<n>-<slug>`, `fix/<slug>`, `chore/<slug>`. Check `git config user.name` and `docs/branching.md` table; if missing, ask option per member.

**Commits:** `<type>(<scope>): <imperative description in lowercase>`, type in `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `build`, `ci`. One work unit, one commit. No `Co-Authored-By` or AI signatures.

**Traceability:** `Refs #N` references story. `Closes #N` only if meets all criteria and stays `Done`. PR asks for issue or `none, minor change`.

## Migrations

If branch touches `backend/alembic/`, warn user before pushing to `main`: CI `migrations` job applies `alembic upgrade head` on Supabase production after suites pass and `db-migrations` environment approved (D56). Every new migration must be expand/contract: never delete or rename in same deploy that changes code using it.

## Decisions

Every non-functional technical decision and root cause of error recorded in `docs/decisions.md` with date and author **before applying**. Scope, contract or model ones also go in OpenSpec change.

## Technical conventions

Not negotiated per story; detail in `docs/decisions.md`.

- No TypeScript: frontend is JavaScript.
- Backend tests with pytest against real PostgreSQL, never SQLite (model uses `num_nonnulls`, unique indexes on normalized columns and CHECKs).
- Components do not call backend: everything through `src/services/`, except login and password change (`src/auth/authClient.js`). Do not import `src/mocks/` or add invented data to screens.
