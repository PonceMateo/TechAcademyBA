# TechAcademy BA

Sistema de gestión de una academia de cursos: cursos y comisiones, padrón de docentes y
alumnos, cobranzas y habilitación de acceso a las clases virtuales.

> **Estado: es un scaffold, no el producto.** El login es real de punta a punta y el modelo de
> datos está completo. **Ninguna historia de usuario está implementada**: las pantallas se
> maquetan más adelante con datos de ejemplo. Los valores que veas en el maquetado son
> *placeholders*, no datos del negocio; la secretaría carga los reales cuando el sistema sea
> funcional. Las decisiones de por qué están en
> [`docs/decisions.md`](docs/decisions.md) y el alcance en
> [`openspec/changes/bootstrap-initial-scaffold/`](openspec/changes/bootstrap-initial-scaffold/).

## Requisitos

- **Docker** con Compose v2. No hace falta Python ni Node en la máquina: todo corre en
  contenedores.
- La primera corrida descarga imágenes. Después, todo es local.

## Levantar el proyecto

```bash
docker compose up -d db backend
```

El backend queda en `http://127.0.0.1:8000` y la base en `127.0.0.1:5432`. Para ver qué está
pasando:

```bash
docker compose ps
docker compose logs -f backend
```

Los dos puertos están publicados **solo** en el bucle local: no exponen nada a la red.

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

## Cuentas de demostración

Las tres tienen la misma contraseña. Son públicas y son de demostración: no sirven en ningún
otro entorno.

| Rol | Correo | Contraseña | A qué entra |
|---|---|---|---|
| Administración (el mismo rol que Secretaría, D3) | `admin@techacademy.invalid` | `Demo2026!` | Tablero y módulos de administración |
| Docente | `rita.molina@techacademy.invalid` | `Demo2026!` | Comisiones asignadas y asistencia |
| Alumno | `agustina.benitez@techacademy.invalid` | `Demo2026!` | Cursos, pagos y perfil |

Las tres quedan con el cambio de contraseña **despendiente**, aunque el modelo diga que las
cuentas nuevas de docente y de alumno nacen con el cambio pendiente: este change todavía no
implementa ese flujo, y con el indicador prendido nadie llegaría a su pantalla (decisión D18).

## Entrar por HTTP

Estos son los dos únicos endpoints que la interfaz va a usar. El resto del frontend consume
datos de ejemplo (decisión D14).

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

```bash
docker compose run --rm backend pytest
docker compose run --rm backend ruff check .
```

Las pruebas corren contra **PostgreSQL real**, nunca SQLite: el esquema usa `num_nonnulls`,
índices únicos sobre columnas normalizadas y CHECKs que SQLite no tiene, así que una suite en
SQLite pasaría y la migración fallaría después (decisión D15). La base de pruebas se crea sola
y se descarta en cada corrida.

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

`JWT_SECRET_KEY` no tiene un valor real por defecto a propósito: si falta, la aplicación no
arranca. Generá uno propio con
`python -c "import secrets; print(secrets.token_urlsafe(48))"` antes de cualquier despliegue.

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
docs/             glosario del cliente y registro de decisiones
frontend/         la interfaz (todavía no está)
openspec/         el change que define el alcance de este trabajo
```

El flujo de trabajo del equipo está en [`AGENTS.md`](AGENTS.md) y la terminología del cliente
en [`docs/glossary.md`](docs/glossary.md).

## Qué falta todavía

- **La interfaz.** No hay frontend: no existe `frontend/`, así que `docker compose up -d` solo
  levanta la base y el backend. Viene en el work unit 5.
- **Las pantallas.** Ninguna historia de usuario está implementada.
- **El proveedor de correo.** Solo existe la implementación que escribe en el log.
- **Los datos reales.** No se importa nada de la planilla del cliente: la carga de los datos
  históricos se hace a mano al final del MVP, por decisión del equipo.
