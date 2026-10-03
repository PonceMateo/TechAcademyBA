# Proposal

## Why

El repositorio contiene hoy únicamente documentación (contextualización, enunciado, entrevista, maqueta y las 47 historias de usuario) y ningún código. No hay forma de levantar el proyecto, autenticarse ni recorrer la interfaz, y el Hito 0 académico ("Propuesta Técnica y Arquitectura", bloqueante) exige presentar stack, modelo de entidad-relación y wireframes funcionales.

Además, el cliente se enteró de que necesita ver avances concretos ("la semana que ustedes me tienen que mostrar", en `docs/requirements/Primera entrevista.md`), y **el camino de alcance todavía no está decidido**: el MVP 1 original (Must + Should, 28 HU, 82 PHU, ~9 semanas) o el alternativo (solo Must, 18 HU, 44 PHU, ~4-5 semanas). Un esqueleto maquetado que cubra ambos caminos a la vez evita rehacer estructura si el cliente elige el original, que es el escenario más caro de revertir.

## What Changes

- Se inicializa el repositorio con el stack fijo acordado: **backend FastAPI** (Python 3.12, SQLAlchemy 2.x, Alembic, Pydantic v2, PyJWT, bcrypt, psycopg 3, pytest, ruff) y **frontend React + JavaScript** (Vite, React Router, Tailwind, ESLint + Prettier, Vitest + React Testing Library), sobre **PostgreSQL 16** y **Docker Compose**.
- Se agrega **autenticación real por rol**: `POST /auth/login` (email + contraseña, JWT), `GET /auth/me` y dependencias de autorización reutilizables por rol. Roles `ADMIN`, `DOCENTE`, `ALUMNO`. Administración y Secretaría son un único rol (`ADMIN`), mostrado como "Secretaría" en la UI.
- Se define el **esquema de dominio completo** en modelos SQLAlchemy y su migración inicial de Alembic, derivado de los criterios de aceptación de las 47 HU. Sin endpoints CRUD de dominio.
- Se agrega un **seed idempotente** con tres usuarios demo (admin, docente, alumno) y una interfaz `EmailService` con implementación de desarrollo que solo loguea y reporta errores.
- Se construye un **maquetado navegable** de los tres paneles (Administración, Docente, Alumno) con datos mock detrás de una capa `src/services/` intercambiable por API. Solo el login consume el backend real.
- Se agregan las **pantallas de Administración que el Figma no tiene** y los **campos faltantes** que sí exigen historias Must: ítem de menú "Docentes", campos `modalidad` y `sede` en el modal de nueva comisión, y campo de link de clase en el detalle de comisión del docente.
- Se agregan **infraestructura de desarrollo y calidad**: `docker compose up` levanta db + backend + frontend; GitHub Actions con jobs de backend y frontend; `README.md`, `.gitignore`, `.editorconfig`, `.env.example`.
- Se documenta el **flujo de trabajo del equipo** en `AGENTS.md` (preservando el bloque gestionado por OpenSpec), en `.github/pull_request_template.md` y en `docs/decisions.md`.
- Se crea `docs/glossary.md` con la terminología del cliente.

### Explícitamente fuera de este change

Ninguna HU se implementa. No hay CRUD de dominio, ni la regla automática de habilitación, ni pasarela de pago, ni certificados, ni notas, ni liquidación de docentes, ni envío real de mails, ni i18n, ni despliegue, ni lista de espera funcional. Los ítems de historias Won't se muestran **deshabilitados con la etiqueta "Próximamente"**.

**Este change no cierra ninguna HU.** En el PR se usan referencias `Refs #N`, nunca `Closes #N`.

## Capabilities

### New Capabilities

- `auth-and-roles`: login por email y contraseña con emisión de JWT, resolución de sesión por rol, dependencias de autorización reutilizables, modelo `Usuario` con `must_change_password` y las tres identidades de rol (Administración, Docente, Alumno). Refs #9, #13
- `admin-shell`: layout de Administración con sidebar "MENÚ OPERATIVO" y topbar, y el maquetado navegable de Dashboard, Cursos y Comisiones, Docentes, Alumnos e Inscripciones, Cobranzas e Ingresos e Habilitación de Accesos. Refs #1, #2, #5, #6, #7, #8, #9, #13, #14, #15, #16, #18, #21, #22, #23, #24, #28
- `teacher-shell`: layout "ESPACIO DOCENTE" con navegación y las pantallas Mis Comisiones, detalle de comisión con carga de link de clase, Asistencia, Notas y Certificación (deshabilitada), Mi Perfil. Refs #33
- `student-shell`: layout "ESPACIO ALUMNO" con navegación y las pantallas Mis Cursos, detalle de curso, Mis Pagos, Certificados (deshabilitado), Mi Perfil. Refs #38, #39, #42
- `domain-schema`: esquema relacional de dominio derivado de los criterios de aceptación de las 47 HU (catálogo, comisiones y sedes, padrón, inscripciones y categorías arancelarias, cuentas corporativas, pagador desacoplado, cobranzas con su causa e imputaciones, facturas, clases, override de habilitación y auditoría), con unicidades, CHECKs y borrado lógico. Refs #1, #2, #8, #13, #14, #15, #18, #19, #21, #22, #23, #24, #25, #27, #30, #33
- `dev-infrastructure`: arranque reproducible con Docker Compose, migraciones y seed documentados, pipeline de GitHub Actions (backend con Postgres como service, frontend con lint/test/build) y documentación de setup.

### Modified Capabilities

Ninguna. El proyecto no tiene specs previos; `openspec/specs/` está vacío.

## Impact

- **Artefactos OpenSpec:** nuevo change `bootstrap-initial-scaffold` (este), con deltas para las 6 capabilities nuevas.
- **Archivos nuevos:** `AGENTS.md`, `opencode.json` (MCP remoto de Context7), `.github/pull_request_template.md`, `.github/workflows/ci.yml`, `.gitignore`, `.editorconfig`, `docker-compose.yml`, Dockerfiles, `README.md`, `docs/decisions.md`, `docs/glossary.md`, `backend/`, `frontend/`.
- **Dependencias nuevas:** todas. El repositorio pasa de solo-documentación a proyecto ejecutable.
- **Datos:** base PostgreSQL 16 vacía más un seed de tres usuarios demo. **No se importa ni sanea el Excel histórico en este change**: el equipo decidió cargarlo a mano cuando el sistema esté funcional.
- **Backlog:** los issues #1 a #44 se referencian con `Refs`, sin transiciones de estado ni cierres. Las historias #45, #46 y #47 están en el CSV y todavía **no** tienen issue.
- **Datos de referencia:** `docs/design/` y `docs/requirements/` se leen pero no se modifican.

### Fuentes de verdad

En orden de autoridad: el **CSV de historias de usuario** define las restricciones del modelo; la **contextualización** define el modelo de negocio; el **PPTX** define el alcance negociado. El **Figma** aporta estructura de pantallas y estilo, ningún dato. El **Excel del cliente** es el problema a resolver, no la solución: un objetivo del proyecto es reemplazarlo, así que no puede ser la fuente de verdad del modelo. Los datos que muestra el maquetado son placeholders que la secretaría reemplaza con los reales cuando el sistema esté funcional.

### Cobertura del backlog en el maquetado

Se maqueta el **Must completo** (18 HU) y el **Should completo** (10 HU), más los Could que ya aparecen en el Figma y cuestan poco. Los Won't (#12, #26, #29, #35, #36, #37, #41, #44) se representan únicamente como ítems deshabilitados con la etiqueta "Próximamente", sin contenido maquetado.
