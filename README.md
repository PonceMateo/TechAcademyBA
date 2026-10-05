# TechAcademy BA

Sistema de gestión de una academia de cursos: cursos y comisiones, padrón de docentes y
alumnos, cobranzas y habilitación de acceso a las clases virtuales.

> **Estado: es un scaffold, no el producto.** El login es real de punta a punta, el ruteo por
> rol funciona, el modelo de datos está completo y las tres secciones (Administración, Docente
> y Alumno) están maquetadas. **Ninguna historia de usuario está implementada**: las pantallas
> muestran datos de ejemplo (*placeholders*, no datos del negocio) y no guardan nada.
> Las decisiones de diseño están en [`docs/decisions.md`](docs/decisions.md) y el alcance en
> [`openspec/changes/bootstrap-initial-scaffold/`](openspec/changes/bootstrap-initial-scaffold/).

El README tiene dos partes. **Si querés usar el sistema, andá directo a
[Levantar el proyecto](#levantar-el-proyecto).** Lo demás es para el equipo que lo desarrolla.

## **Índice**

- **Para usar el sistema**
  [Requisitos](#requisitos) ·
  [Levantar el proyecto](#levantar-el-proyecto) ·
  [Cuentas de demostración](#cuentas-de-demostración) ·
  [Si algo no funciona](#si-algo-no-funciona) ·
  [Qué falta todavía](#qué-falta-todavía)
- **Para desarrollar**
  [Requisitos](#requisitos-1) ·
  [Herramientas con IA](#herramientas-para-desarrollar-con-ia) ·
  [Comandos](#comandos) ·
  [Estructura](#estructura) ·
  [Base de datos](#base-de-datos) ·
  [API](#api) ·
  [Pruebas](#pruebas) ·
  [Integración continua](#integración-continua) ·
  [Configuración](#configuración) ·
  [Documentos](#documentos-del-proyecto)


# Para usar el sistema

## Requisitos

**Docker Desktop** (o Docker Engine con Compose v2) corriendo, y un navegador. No hace falta
instalar Python ni Node: corren dentro de contenedores. Docker se descarga de
[docker.com](https://www.docker.com/products/docker-desktop/).

## Levantar el proyecto

Tres comandos, en este orden (el primero tarda más la primera vez porque descarga las imágenes):

```bash
docker compose up -d
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend python -m app.services.seed
```

1. Levanta los tres servicios.
2. Crea el esquema de la base de datos.
3. Crea las tres cuentas de demostración.

Los pasos 2 y 3 se pueden repetir sin problema: la migración es idempotente y la carga inicial
actualiza las cuentas en lugar de duplicarlas. El aviso con las credenciales **se registra en
el log y no se envía a nadie**, porque todavía no se eligió proveedor de correo (D17).

Después abrí **<http://127.0.0.1:5173>**. Los servicios quedan publicados **solo en el bucle
local**, así que no exponen nada a la red:

| Servicio | Dónde | Notas |
|---|---|---|
| Interfaz | <http://127.0.0.1:5173> | Se abre en el navegador |
| Backend | <http://127.0.0.1:8000> | `GET /health` para ver que responde |
| Documentación de la API | <http://127.0.0.1:8000/docs> | Solo con `DEBUG=true` (el default) |
| Base de datos | `127.0.0.1:5432` | `docker compose exec db psql -U techacademy -d techacademy` |

## Cuentas de demostración

Son públicas, de demostración, y tienen la misma contraseña: `Demo2026!`. No sirven en ningún
otro entorno.

| Rol | Correo | A qué entra |
|---|---|---|
| Administración (mismo rol que Secretaría, D3) | `admin@techacademy.invalid` | Tablero y módulos de administración |
| Docente | `rita.molina@techacademy.invalid` | Comisiones asignadas y asistencia |
| Alumno | `agustina.benitez@techacademy.invalid` | Cursos, pagos y perfil |

Cada rol entra a su sección y solo a la suya.

## Si algo no funciona

| Síntoma | Qué mirar |
|---|---|
| La página no abre | `docker compose ps`: los tres servicios tienen que estar `running` |
| Un servicio no levanta | `docker compose logs -f backend` (o `frontend`, o `db`) |
| No se puede entrar | Falta la carga inicial: corré el tercer comando otra vez |
| Cambiaste el código y no se ve | `docker compose restart backend frontend` |

Para volver a cero (base y volumen incluidos): `docker compose down -v`.

## Qué falta todavía

- **La lógica de negocio.** No hay un solo endpoint del padrón ni una sola escritura. La capa
  de datos real llega cuando existan los endpoints (M17).
- **El cambio de contraseña.** El modelo tiene `must_change_password` y la interfaz avisa, pero
  no existe la pantalla. Por eso las cuentas de demostración tienen el indicador apagado (D18).
- **El proveedor de correo.** Solo existe la implementación que escribe en el log (P2).
- **Los datos reales.** No se importa nada de la planilla del cliente: la carga histórica se
  hace a mano al final del MVP, por decisión del equipo.

---

# Para desarrollar

## Requisitos

- **Git**.
- **Docker Desktop** o Docker Engine con Compose v2. Es obligatorio aunque tengas Python y Node
  instalados: los comandos de este README corren en contenedores.
- **GitHub CLI** (opcional), para consultar el backlog y los pull requests desde la terminal.

Las convenciones del equipo están en [`AGENTS.md`](AGENTS.md).

### Herramientas para desarrollar con IA

El proyecto se trabaja con [opencode](https://opencode.ai). Los comandos de slash y las
habilidades de OpenSpec están versionados en [`.opencode/`](.opencode/), así que
`/opsx-propose`, `/opsx-apply` y el resto funcionan apenas se clona el repo.

**OpenSpec es obligatorio tenerlo instalado** (`npm i -g @fission-ai/openspec`). El proyecto
sigue desarrollo guiado por specs (SDD) para los cambios grandes: propuesta, specs, tareas y
aplicación, antes de escribir código. Los cambios chicos no pasan por OpenSpec. El criterio
para distinguir unos de otros está en [`AGENTS.md`](AGENTS.md).

Los servidores MCP del proyecto están declarados en [`opencode.json`](opencode.json), así que
llegan con el `pull`. Lo que **no** se versiona son los binarios: eso se instala una vez por
máquina.

| Servidor MCP | Qué aporta | Instalar |
|---|---|---|
| Context7 | Documentación actualizada de librerías. | Nada: es remoto. |
| CodeGraph | Índice de símbolos y llamadas del repo. | `npm i -g @colbymchenry/codegraph` y después `codegraph init` |
| Engram | Memoria persistente entre sesiones. | [Su guía de instalación](https://github.com/Gentleman-Programming/engram/blob/main/docs/INSTALLATION.md#windows) y después `engram setup opencode` |

Dos cosas que no se ven en la tabla. **CodeGraph devuelve vacío en lugar de error hasta que
corre `codegraph init`**, y como `.codegraph/` está en `.gitignore` el índice es por máquina:
cada clone necesita el suyo. Y si un servidor MCP aparece caído, casi siempre es que falta el
binario en el `PATH`, no la configuración: `opencode.json` es el mismo para todos.

En Windows, el binario precompilado de Engram lo marca el antivirus como malware. Es un falso
positivo que el propio proyecto documenta, y su recomendación es compilarlo con `go install`.

Ponytail no es un MCP sino un plugin: empuja a la solución más simple que funcione sin cambiar
el resultado, solo el tamaño del diff. Es opcional y vive en la configuración global de cada
uno.

## Comandos

| Qué querés | Comando |
|---|---|
| Levantar los tres servicios | `docker compose up -d` |
| Ver el estado | `docker compose ps` |
| Seguir los logs del backend | `docker compose logs -f backend` |
| Aplicar las migraciones | `docker compose run --rm backend alembic upgrade head` |
| Crear las cuentas de demostración | `docker compose run --rm backend python -m app.services.seed` |
| Pruebas del backend | `docker compose run --rm backend pytest` |
| Lint del backend | `docker compose run --rm backend ruff check .` |
| Pruebas del frontend | `docker compose run --rm frontend npm run test` |
| Lint del frontend | `docker compose run --rm frontend npm run lint` |
| Build de producción del frontend | `docker compose run --rm frontend npm run build` |
| Formatear el frontend (Prettier, reescribe archivos) | `docker compose run --rm frontend npm run format` |
| Verificar el formato sin escribir nada | `docker compose run --rm frontend npm run format:check` |
| Volver a cero, base y volumen incluidos | `docker compose down -v` |

> El build escribe `frontend/dist/`, que está en `.gitignore`.

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
    docente/      shell y pantallas de Docente
    auth/         cliente HTTP del login, contexto de sesión, tabla de ruteo, rutas por rol
    components/   armazón compartido de los tres shells y componentes reutilizables
    config/       origen del backend que consume el navegador
    domain/       copia de los enums del backend y normalización
    mocks/        datos de ejemplo, marcados como tales
    pages/        login, 403, 404 y pantalla de espera
    services/     única frontera de datos: implementación mock e implementación de la API
    test/         arranque de la aplicación para los tests y backend falso
    utils/        formato de moneda y fecha
  index.html, vite.config.js, eslint.config.js, .prettierrc.json
.github/workflows/ci.yml   integración continua
.opencode/                 comandos de slash (commands/) y habilidades (skills/) de OpenSpec
openspec/                  specs y change que definen el alcance
opencode.json              configuración del proyecto para opencode
```

`src/mocks/` y `src/services/` son la capa de datos intercambiable de la decisión D13: los
componentes piden los datos por `src/services/` y nunca por `src/mocks/`, así que reemplazar la
implementación mock por la API real no los cambia. Hoy el login es la única parte que habla con
el backend de verdad (D14), y hay una prueba que verifica esa frontera leyendo el código.

## Base de datos

`alembic upgrade head` aplica la migración inicial, que crea las 18 tablas. Está **revisada a
mano** (D16): Alembic no emite CHECK constraints ni índices sobre columnas normalizadas, así que
esos dos tipos de restricción están escritos a mano en el archivo de migración.

## API

Hoy la interfaz solo habla con el backend para el login (`POST /auth/login` y `GET /auth/me`);
el resto de las pantallas usa datos de ejemplo (D14). Existen además `GET /health` y cuatro
rutas temporales `/auth/probe/*`, que solo sirven para verificar que cada rol accede a lo suyo
y recibe `403` en lo demás.

Con `DEBUG=true` (el default), el listado completo de rutas se puede ver y probar desde
<http://127.0.0.1:8000/docs>. La respuesta de cada una, medida contra el backend real, está en
[`docs/verificacion-definition-of-done.md`](docs/verificacion-definition-of-done.md).

## Pruebas

Los comandos están en la tabla de [Comandos](#comandos). Dos cosas que no se ven ahí:

- **El backend se prueba contra PostgreSQL real, nunca SQLite** (D15). El esquema usa
  `num_nonnulls`, índices únicos sobre columnas normalizadas y CHECKs que SQLite no tiene: una
  suite en SQLite pasaría y la migración fallaría después. La base de pruebas se crea sola y se
  descarta en cada corrida.
- **El frontend no usa TypeScript**: es JavaScript con JSX, y `npm run lint` cubre `.js` y `.jsx`.

## Integración continua

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) corre en cada push y en cada pull request.
Si cualquiera de los dos jobs falla, el workflow queda en rojo.

| Job | Qué hace |
|---|---|
| `backend` | Levanta PostgreSQL 16 como servicio del job, instala con `pip install -e ".[dev]"`, crea la base de pruebas y corre `ruff check .` y `pytest`. |
| `frontend` | Instala con `npm ci` y corre `npm run lint`, `npm run test` y `npm run build`. |

Cada job trabaja en la raíz de su contenedor (`backend/` y `frontend/`), así que los comandos son
los mismos que en tu máquina. Lo único que cambia a propósito es dónde vive PostgreSQL: el
servicio `db` de `docker-compose.yml` localmente, y un `services:` del job en el runner. Con
`TEST_DATABASE_URL` definida, la suite asume que la base ya existe, y en CI la crea el workflow.

## Configuración

Todas las variables están documentadas en [`.env.example`](.env.example) y tienen un valor por
defecto, así que el entorno levanta sin tocar nada. Para cambiar alguna: `cp .env.example .env`.

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
arranca. Antes de cualquier despliegue generá uno propio con
`python -c "import secrets; print(secrets.token_urlsafe(48))"`.

En el navegador **no** hace falta configurar CORS: el servidor de desarrollo de Vite hace proxy
de `/api` hacia el backend, así que el pedido sale del mismo origen que la página (D14).

## Documentos del proyecto

| Documento | Qué hay en él |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Flujo de trabajo del equipo: fuentes de verdad, ramas, commits, convenciones. |
| [`docs/decisions.md`](docs/decisions.md) | Por qué se decidió cada cosa técnica, con fecha y autor. Cada `D17` o `D14` apunta ahí. |
| [`docs/glossary.md`](docs/glossary.md) | La terminología del cliente traducida. |
| [`docs/verificacion-definition-of-done.md`](docs/verificacion-definition-of-done.md) | El recorrido verificado de la Definition of Done. |
| [`openspec/`](openspec/) | El change que define el alcance de este trabajo. |
