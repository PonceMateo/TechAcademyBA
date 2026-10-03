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

## Requisitos

- **Docker** con Compose v2. No hace falta Python ni Node en la máquina: todo corre en
  contenedores.
- La primera corrida construye las dos imágenes del proyecto a partir de sus Dockerfile y
  descarga las imágenes base. Después, todo es local.

## Levantar el proyecto

Tres comandos, en este orden. Con el tercero ya se puede entrar con una cuenta de
demostración.

```bash
docker compose up -d
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend python -m app.services.seed
```

Los dos últimos tienen su sección propia más abajo: [migraciones](#migraciones) y
[carga inicial](#carga-inicial).

El backend queda en `http://127.0.0.1:8000`, la interfaz en `http://127.0.0.1:5173` y la
base en `127.0.0.1:5432`. Para ver qué está pasando:

```bash
docker compose ps
docker compose logs -f backend
```

Los puertos están publicados **solo** en el bucle local: no exponen nada a la red.

> **Cuánto tarda.** Medido en la máquina del equipo el 2026-10-03, con la caché de capas de
> Docker ya tibia: `build` 34 s, `up -d` 12 s, migraciones 5 s y carga inicial 5 s, o sea
> **60 s de principio a fin**. La primera corrida en una máquina limpia, sin imágenes
> construidas, además descarga `python:3.12-slim`, `node:22-slim` y `postgres:16-alpine` e
> instala las dependencias de las dos imágenes: eso **no está medido** porque depende de la
> conexión. La spec se pone en menos de diez minutos; el número de arriba es el del camino
> medido, no una promesa.

### Migraciones

La migración inicial crea el esquema completo (18 tablas). Sobre una base recién creada:

```bash
docker compose run --rm backend alembic upgrade head
```

Para deshacer todo y volver a empezar de cero:

```bash
docker compose down -v
```

### Carga inicial

Crea las tres cuentas de demostración y les escribe un aviso con sus credenciales. El aviso
**se registra en el log y no se envía a nadie**: este proyecto todavía no eligió proveedor de
correo (decisión D17).

```bash
docker compose run --rm backend python -m app.services.seed
```

El comando es **idempotente**: podés correrlo las veces que quieras. La segunda corrida
actualiza las cuentas en lugar de duplicarlas.

## Entrar por la interfaz

Con los tres servicios arriba, abrir `http://127.0.0.1:5173` y entrar con cualquiera de las
tres cuentas de la tabla de abajo. El login es **real de punta a punta**: el navegador llama
a `POST /auth/login` y a `GET /auth/me` contra el backend de verdad, a través del proxy
`/api` del servidor de desarrollo (decisión D14).

Cada rol entra a su sección y solo a la suya:

| Rol | A dónde entra | Qué pasa si abre la sección de otro |
|---|---|---|
| `ADMIN` | `/admin` | pantalla 403 |
| `DOCENTE` | `/docente` | pantalla 403 |
| `ALUMNO` | `/alumno` | pantalla 403 |

Sin sesión, cualquier ruta protegida manda al login. Una ruta que no existe responde 404.

> **Ocultar rutas no es proteger.** El frontend esconde la pantalla de un rol ajeno, pero la
> autorización es del backend, que es el que resuelve la cuenta contra la base en cada
> request (M7) y devuelve 401 o 403. Que la interfaz no muestre una pantalla no reemplaza
> esa comprobación: los endpoints de prueba de abajo siguen siendo los que la verifican.

## Cuentas de demostración

Las tres tienen la misma contraseña. Son públicas y son de demostración: no sirven en ningún
otro entorno.

| Rol | Correo | Contraseña | A qué entra |
|---|---|---|---|
| Administración (el mismo rol que Secretaría, D3) | `admin@techacademy.invalid` | `Demo2026!` | Tablero y módulos de administración |
| Docente | `rita.molina@techacademy.invalid` | `Demo2026!` | Comisiones asignadas y asistencia |
| Alumno | `agustina.benitez@techacademy.invalid` | `Demo2026!` | Cursos, pagos y perfil |

Las tres quedan **sin** cambio de contraseña pendiente, aunque el modelo diga que las cuentas
nuevas de docente y de alumno nacen con el pendiente: este change todavía no implementa ese
flujo, y con el indicador prendido nadie llegaría a su pantalla (decisión D18). Cuando una
cuenta lo tiene, la barra superior de las tres secciones avisa; lo que no existe todavía es la
pantalla para cambiar la contraseña.

## Entrar por HTTP

Estos son los dos únicos endpoints que la interfaz va a usar. El resto del frontend consume
datos de ejemplo (decisión D14).

Los ejemplos pegan al backend por su puerto. La interfaz no lo hace: usa
`http://127.0.0.1:5173/api`, que es el mismo proxy `/api` que usa el navegador. Los dos
caminos devuelven lo mismo.

Obtener el token:

```bash
curl -s -X POST http://127.0.0.1:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@techacademy.invalid","password":"Demo2026!"}'
```

```json
{"access_token":"eyJhbGciOi...","token_type":"bearer","user_id":1,"rol":"ADMIN","must_change_password":false}
```

Usar ese token para leer la sesión:

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@techacademy.invalid","password":"Demo2026!"}' \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')

curl -s http://127.0.0.1:8000/auth/me -H "Authorization: Bearer $TOKEN"
```

```json
{"id":1,"email":"admin@techacademy.invalid","rol":"ADMIN","nombre":"Secretaria BA","must_change_password":false}
```

Un correo que no existe y una contraseña incorrecta devuelven **exactamente** la misma
respuesta, porque una respuesta distinta confirmaría qué correos están registrados:

```json
{"detail":"Credenciales inválidas."}
```

> En PowerShell 5.1, `curl` es un alias de `Invoke-WebRequest`: usá `curl.exe` y escapá las
> comillas dobles del JSON (`\"`), o corré los bloques en un shell POSIX.

### Endpoints

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

## Comandos

Todos los comandos de la máquina en una tabla. Cada uno tiene su sección más arriba; esta
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

## Herramientas opcionales

**Ninguna hace falta para desarrollar.** Git, Docker y un editor alcanzan para trabajar en
este proyecto. GitHub CLI está recomendada solo para consultar el backlog y los pull
requests desde la terminal, y es opcional: lo mismo se hace en la web de GitHub.

Con [GitHub CLI](https://cli.github.com/) 2.x en el PATH:

```bash
gh auth login
gh auth refresh -s project
```

| Comando | Qué hace |
|---|---|
| `gh auth login` | Abre el flujo de autenticación en el navegador y guarda el token en el almacén de credenciales del sistema. |
| `gh auth refresh -s project` | Le **agrega** el alcance `project` al token ya guardado, que es lo que da lectura y escritura sobre los proyectos de usuario y de organización. El alcance por defecto de `gh` no lo incluye. |

Con eso, el backlog se consulta desde la terminal:

```bash
gh issue list
gh pr list
```

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
openspec/         el change que define el alcance de este trabajo
```

**`src/mocks/` y `src/services/` ya existen** y son la capa de datos intercambiable de la
decisión D13: los componentes piden los datos por `src/services/` y nunca por `src/mocks/`,
así que reemplazar la implementación mock por la API real no los cambia. Hoy esa
implementación es la de ejemplo; el login es la única parte que habla con el backend de
verdad (D14). Hay una prueba que lo verifica leyendo el código.

El flujo de trabajo del equipo está en [`AGENTS.md`](AGENTS.md), la terminología del cliente
en [`docs/glossary.md`](docs/glossary.md) y el detalle de por qué en
[`docs/decisions.md`](docs/decisions.md). El recorrido verificado de la Definition of Done
está en [`docs/verificacion-definition-of-done.md`](docs/verificacion-definition-of-done.md).

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
- **El remoto de Git.** El repositorio todavía no tiene remoto configurado, así que la
  integración continua existe como archivo pero **nunca se ejecutó**. La primera corrida
  real ocurre con el primer `git push` (P9).
