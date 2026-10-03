# TechAcademy BA

Sistema de gestión de una academia de cursos: cursos y comisiones, padrón de docentes y
alumnos, cobranzas y habilitación de acceso a las clases virtuales.

> **Estado: es un scaffold, no el producto.** El login es real de punta a punta, el ruteo por
> rol ya está, el modelo de datos está completo y **las tres secciones ya están maquetadas**:
> se entra con una cuenta de verdad y se recorren las pantallas de cada rol. **Ninguna
> historia de usuario está implementada**: las pantallas muestran datos de ejemplo y no
> guardan nada. Los valores que veas en el maquetado son *placeholders*, no datos del
> negocio; la secretaría carga los reales cuando el sistema sea funcional. Las decisiones de
> por qué están en [`docs/decisions.md`](docs/decisions.md) y el alcance en
> [`openspec/changes/bootstrap-initial-scaffold/`](openspec/changes/bootstrap-initial-scaffold/).

Este README tiene dos partes. **Si querés usar el sistema, andá directo a
[Levantar el proyecto](#levantar-el-proyecto).** Todo lo demás es para el equipo que lo
desarrolla.

## Para usar el sistema

### Requisitos

Lo único que hace falta es **Docker Desktop** _(o Docker Engine con Compose v2)_ instalado y
corriendo, y un navegador. No hace falta instalar Python ni Node: los dos corren dentro de
contenedores.

Si no lo tenés, se descarga de [docker.com](https://www.docker.com/products/docker-desktop/).

### Levantar el proyecto

Tres comandos, en este orden. El primero tarda más la primera vez porque descarga las
imágenes:

```bash
docker compose up -d
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend python -m app.services.seed
```

El segundo crea el esquema de la base (18 tablas) y el tercero crea las tres cuentas de
demostración. Los dos se pueden repetir: la migración es idempotente y la carga inicial
actualiza las cuentas en lugar de duplicarlas. Un detalle de la carga inicial: el aviso con
las credenciales **se registra en el log y no se envía a nadie**, porque el proyecto todavía
no eligió proveedor de correo (D17).

Después de eso, abrí **<http://127.0.0.1:5173>** en el navegador para ver el Frontend.
Los tres servicios quedan escuchando en estos puertos, todos publicados **solo** en el bucle local: no exponen nada a la red.

| Servicio | Dónde | Cómo se entra |
|---|---|---|
| Interfaz | <http://127.0.0.1:5173> | Se abre en el navegador |
| Backend | <http://127.0.0.1:8000> | `GET /health` para ver que responde |
| Documentación de la API | <http://127.0.0.1:8000/docs> | Solo con `DEBUG=true`, que es el default |
| Base de datos | `127.0.0.1:5432` | `docker compose exec db psql -U techacademy -d techacademy` |

### Cuentas de demostración

Las tres tienen la misma contraseña. Son públicas y son de demostración: no sirven en ningún
otro entorno.

| Rol | Correo | Contraseña | A qué entra |
|---|---|---|---|
| Administración (el mismo rol que Secretaría, D3) | `admin@techacademy.invalid` | `Demo2026!` | Tablero y módulos de administración |
| Docente | `rita.molina@techacademy.invalid` | `Demo2026!` | Comisiones asignadas y asistencia |
| Alumno | `agustina.benitez@techacademy.invalid` | `Demo2026!` | Cursos, pagos y perfil |

El login es **real de punta a punta**: el navegador llama al backend de verdad. Cada rol entra
a su sección y solo a la suya.

### Si algo no funciona

| Síntoma | Qué mirar |
|---|---|
| La página no abre | `docker compose ps` — los tres servicios tienen que estar `running` |
| Un servicio no levanta | `docker compose logs -f backend` (o `frontend`, o `db`) |
| No se puede entrar | Falta la carga inicial: corré el tercer comando otra vez |
| Cambiaste el código y no se ve | `docker compose restart backend frontend` |

Para volver a cero y arrancar de nuevo:

```bash
docker compose down -v
```

Los puertos están publicados **solo** en el bucle local: no exponen nada a la red.

## Qué falta todavía

- **La lógica de negocio.** Es lo más importante: **ninguna historia de usuario está
  implementada**. Los tres shells y sus quince pantallas están maquetados y se recorren con
  datos de ejemplo, pero no hay un solo endpoint del padrón ni una sola escritura: las
  pantallas no guardan nada. La capa de datos real llega cuando existan los endpoints (M17).
- **El flujo de cambio de contraseña.** El modelo tiene `must_change_password` y la interfaz
  avisa, pero no existe la pantalla para cambiar la contraseña. Por eso las tres cuentas de
  demostración quedan con el indicador apagado (D18).
- **El proveedor de correo.** Solo existe la implementación que escribe en el log (P2).
- **Los datos reales.** No se importa nada de la planilla del cliente: la carga de los datos
  históricos se hace a mano al final del MVP, por decisión del equipo.
- **El pull request.** La rama `feat/bootstrap-initial-scaffold` está pusheada y la integración
  continua ya corrió en verde sobre ella, pero el pull request todavía no está abierto: esa es
  la tarea 12.5 del change, y la hace el equipo (P10).

---

# Para desarrollar

## Requisitos

- **Git**, para trabajar sobre ramas.
- **Docker Desktop** o Docker Engine con Compose v2. Sigue siendo obligatorio: aunque
  tengas Python y Node instalados, los comandos de este README corren en contenedores.
- **GitHub CLI**, opcional. Solo para consultar el backlog y los pull requests desde la
  terminal.

`README` de las convenciones del equipo: [`AGENTS.md`](AGENTS.md).

### Herramientas para desarrollar con IA

El proyecto se trabaja con [opencode](https://opencode.ai). Los comandos de slash y las
habilidades de OpenSpec ya están versionados en [`.opencode/`](.opencode/), así que
`/opsx-propose`, `/opsx-apply` y el resto funcionan apenas se clonea el repo.

**Una es obligatoria: OpenSpec.** Es el flujo de cambios del proyecto —propuesta, specs,
tareas y aplicación—. Cualquier cosa que cambie el contrato pasa por acá antes de escribirse
el código; las reglas de cuándo hace falta una propuesta y cuándo no, en
[`AGENTS.md`](AGENTS.md).

**Las otras son opcionales y recomendables.** Ninguna hace falta para levantar el sistema ni
para correr las pruebas. Viven en la configuración de opencode de cada uno y no en este
repositorio, así que cada quien decide cuáles usa:

| Herramienta | Qué aporta |
|---|---|
| Engram | Memoria persistente entre sesiones: no se pierde el contexto entre una sesión y otra. |
| Context7 | Documentación actualizada de librerías, para no responder de memoria. Es el único servidor MCP declarado acá: [`opencode.json`](opencode.json). |
| CodeGraph | Índice de símbolos y llamadas del repo, para no leer archivos a ciegas. |
| Ponytail | Plugin que empuja a la solución más simple que funcione. No cambia el resultado: cambia el tamaño del diff. |

## Comandos

Todos los comandos de la máquina en una tabla. Cada uno tiene su sección más abajo; esta
es para no tener que buscarlos.

| Qué querés | Comando |
|---|---|
| Levantar los tres servicios | `docker compose up -d` |
| Ver el estado | `docker compose ps` |
| Seguir los logs del backend | `docker compose logs -f backend` |
| Aplicar las migraciones | `docker compose run --rm backend alembic upgrade head` |
| Crear las cuentas de demostración | `docker compose run --rm backend python -m app.services.seed` |
| Correr las pruebas del backend | `docker compose run --rm backend pytest` |
| Lint del backend | `docker compose run --rm backend ruff check .` |
| Lint del frontend | `docker compose run --rm frontend npm run lint` |
| Correr las pruebas del frontend | `docker compose run --rm frontend npm run test` |
| Construir el frontend para producción | `docker compose run --rm frontend npm run build` |
| Verificar el formato sin escribir nada | `docker compose run --rm frontend npm run format:check` |
| Volver a cero, base y volumen incluidos | `docker compose down -v` |

> El build de producción escribe `frontend/dist/` en el árbol de trabajo. Está en
> `.gitignore`, así que no aparece en ningún `git status`.

## Estructura

```
backend/
  app/
    api/          rutas HTTP (incluye las dependencias de autorización por rol)
    core/         configuración, base de datos y seguridad
    models/       modelos SQLAlchemy
    schemas/      contratos de entrada y salida (Pydantic)
    services/     reglas de negocio: autenticación, unicidad de correo, carga inicial
    tests/        suite de pruebas
  alembic/        migraciones
docs/             glosario del cliente, registro de decisiones y lista de verificación
frontend/
  src/
    admin/        shell y pantallas de Administración
    alumno/       shell y pantallas de Alumno
    auth/         cliente HTTP del login, contexto de sesión, tabla de ruteo, rutas por rol
    components/   armazón compartido de los tres shells y componentes de interfaz reutilizables
    config/       origen del backend que consume el navegador
    docente/      shell y pantallas de Docente
    domain/       copia de los enums del backend y normalización
    mocks/        los datos de ejemplo, marcados como tales
    pages/        login, 403, 404 y la pantalla de espera
    services/     la única frontera de datos: la implementación mock y la de la API
    test/         arranque de la aplicación para los tests y backend falso
    utils/        formato de moneda y fecha
  index.html      punto de entrada del documento
  vite.config.js  plugins, proxy de `/api` y configuración de Vitest
  eslint.config.js, .prettierrc.json
.github/
  workflows/ci.yml   la integración continua
.opencode/
  commands/        comandos de slash de OpenSpec (/opsx-propose, /opsx-apply, ...)
  skills/          las habilidades que los ejecutan
openspec/         las specs y el change que definen el alcance del trabajo
opencode.json      configuración del proyecto para opencode (el servidor MCP de Context7)
```

**`src/mocks/` y `src/services/` ya existen** y son la capa de datos intercambiable de la
decisión D13: los componentes piden los datos por `src/services/` y nunca por `src/mocks/`,
así que reemplazar la implementación mock por la API real no los cambia. Hoy esa
implementación es la de ejemplo; el login es la única parte que habla con el backend de
verdad (D14). Hay una prueba que lo verifica leyendo el código.

## Migraciones y carga inicial

Los dos comandos de arranque viven en [Levantar el proyecto](#levantar-el-proyecto) y en la
tabla de [Comandos](#comandos); lo que se agrega acá es lo que no se ve en la línea de
comando.

`alembic upgrade head` aplica la migración inicial, que crea las 18 tablas. Está **revisada a
mano** (D16): Alembic no emite CHECK constraints ni índices sobre columnas normalizadas, así
que esos dos tipos de restricción están escritos a mano en el archivo de migración.

`python -m app.services.seed` crea las tres cuentas y les escribe un aviso con sus
credenciales, que **queda en el log**: no hay proveedor de correo todavía (D17).

Para volver a cero la base y arrancar de nuevo:

```bash
docker compose down -v
```

## Entrar por HTTP

Estos son los dos únicos endpoints que la interfaz va a usar. El resto del frontend consume
datos de ejemplo (D14). La tabla completa:

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/health` | Verificación de salud. Sin autenticación. |
| `POST` | `/auth/login` | Autentica por correo y contraseña y emite el token. |
| `GET` | `/auth/me` | Devuelve la identidad de quien llama, con su rol. |
| `GET` | `/auth/probe/admin` | Ruta de administración. Solo `ADMIN`; el resto recibe `403`. |
| `GET` | `/auth/probe/docente` | Ruta de docente. Solo `DOCENTE`; el resto recibe `403`. |
| `GET` | `/auth/probe/alumno` | Ruta de alumno. Solo `ALUMNO`; el resto recibe `403`. |
| `GET` | `/auth/probe/personal` | Ruta que admite `ADMIN` y `DOCENTE`. |

Las cuatro rutas de `/auth/probe` son de prueba: existen para que la autorización por rol se
pueda verificar de verdad, y se reemplazan por las pantallas reales cuando lleguen.

Para verlas a mano:

```bash
curl -s -X POST http://127.0.0.1:8000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@techacademy.invalid","password":"Demo2026!"}'
```

```json
{"access_token":"eyJhbGciOi...","token_type":"bearer","user_id":1,"rol":"ADMIN","must_change_password":false}
```

Con ese token: `curl -s http://127.0.0.1:8000/auth/me -H "Authorization: Bearer $TOKEN"`.
Un correo que no existe y una contraseña incorrecta devuelven **exactamente** la misma
respuesta, porque una respuesta distinta confirmaría qué correos están registrados.

> En PowerShell 5.1, `curl` es un alias de `Invoke-WebRequest`: usá `curl.exe` y escapá las
> comillas dobles del JSON (`\"`), o corré los bloques en un shell POSIX.

La respuesta de cada punto, medida contra el backend real, está en
[`docs/verificacion-definition-of-done.md`](docs/verificacion-definition-of-done.md).

## Pruebas y linter

Backend:

```bash
docker compose run --rm backend pytest
docker compose run --rm backend ruff check .
```

Las pruebas corren contra **PostgreSQL real**, nunca SQLite: el esquema usa `num_nonnulls`,
índices únicos sobre columnas normalizadas y CHECKs que SQLite no tiene, así que una suite en
SQLite pasaría y la migración fallaría después (decisión D15). La base de pruebas se crea sola
y se descarta en cada corrida; en integración continua la crea el propio workflow, porque
con `TEST_DATABASE_URL` definida la suite asume que la base ya existe.

Frontend:

```bash
docker compose run --rm frontend npm run lint
docker compose run --rm frontend npm run test
docker compose run --rm frontend npm run build
docker compose run --rm frontend npm run format
```

Los tres primeros son los que corren en integración continua. `format` es Prettier, que
reescribe los archivos: `npm run format:check` los verifica sin tocar nada. La interfaz no
tiene **TypeScript**: es JavaScript con JSX, y `npm run lint` cubre los `.js` y los `.jsx`.

## Integración continua

El flujo está en [`.github/workflows/ci.yml`](.github/workflows/ci.yml) y corre en **cada
push y en cada pull request**. Son dos jobs:

| Job | Qué hace |
|---|---|
| `backend` | Levanta PostgreSQL 16 como servicio del job, instala con `pip install -e ".[dev]"`, crea la base de pruebas y corre `ruff check .` y `pytest`. |
| `frontend` | Instala con `npm ci` y corre `npm run lint`, `npm run test` y `npm run build`. |

**Los comandos son los de la tabla de arriba, en el mismo directorio.** El job de backend
trabaja con `backend/` como directorio de trabajo, que es la raíz del contenedor del backend; el
de frontend, con `frontend/`, que es la raíz del contenedor del frontend. Por eso `pytest` y
`npm run build` dicen exactamente lo mismo en el runner que en la máquina. Lo único que cambia
a propósito es dónde vive PostgreSQL: localmente es el servicio `db` de `docker-compose.yml` y
en el runner es un `services:` del propio job.

Si cualquiera de los dos jobs falla, el workflow queda en rojo.

> **Ya corrió de verdad.** El `push` de la rama `feat/bootstrap-initial-scaffold` disparó el
> workflow el 2026-10-03 y la corrida terminó en `success`, con los dos jobs en verde. Es la
> misma evidencia que dan los comandos de arriba, pero ejecutada por GitHub y no en la máquina.

## Configuración

Todas las variables están documentadas en [`.env.example`](.env.example) y tienen un valor por
defecto, así que el entorno levanta sin tocar nada. Para cambiar alguno, copiá el archivo:

```bash
cp .env.example .env
```

Las que más se tocan:

| Variable | Qué es | Por defecto |
|---|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL | la del contenedor `db` |
| `JWT_SECRET_KEY` | Secreto de firma del token | placeholder de desarrollo |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Vigencia del token, en minutos | `480` (ocho horas) |
| `CORS_ORIGINS` | Orígenes del navegador permitidos, separados por coma | `http://localhost:5173` |
| `EMAIL_BACKEND` | Implementación de envío de correo | `log` |
| `VITE_API_BASE_URL` | Ruta que el navegador usa para llamar al backend | `/api` |
| `VITE_API_PROXY_TARGET` | A quién reenvía el proxy `/api` de Vite | `http://backend:8000` |

`JWT_SECRET_KEY` no tiene un valor real por defecto a propósito: si falta, la aplicación no
arranca. Generá uno propio con
`python -c "import secrets; print(secrets.token_urlsafe(48))"` antes de cualquier despliegue.

En el navegador **no** hace falta configurar CORS: el servidor de desarrollo de Vite hace
proxy de `/api` hacia el backend, así que el pedido sale del mismo origen que la página
(decisión D14).

## Documentos del proyecto

| Documento | Qué hay en él |
|---|---|
| [`AGENTS.md`](AGENTS.md) | El flujo de trabajo del equipo: fuentes de verdad, ramas, commits, convenciones. |
| [`docs/decisions.md`](docs/decisions.md) | Por qué se decidió cada cosa técnica, con fecha y autor. Cada `D17` o `D14` del README apunta ahí. |
| [`docs/glossary.md`](docs/glossary.md) | La terminología del cliente traducida. |
| [`docs/verificacion-definition-of-done.md`](docs/verificacion-definition-of-done.md) | El recorrido verificado de la Definition of Done. |
| [`openspec/`](openspec/) | El change que define el alcance de este trabajo. |
