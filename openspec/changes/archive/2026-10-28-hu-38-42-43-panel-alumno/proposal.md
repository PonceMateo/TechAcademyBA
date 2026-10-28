# Proposal

## Why

El panel del alumno sigue siendo una maqueta: `apiDataSource` llama a `/alumno/inscripciones`,
`/alumno/pagos` y `/alumno/mi-perfil`, pero **ninguna de esas rutas existe en el backend**, así que
en ejecución real las pantallas no muestran datos. Además, `Guardar cambios` del perfil solo pinta
un aviso y no persiste nada.

Las historias #38 (consultar datos de la cursada), #42 (consultar estado de habilitación propia) y
#43 (cambiar datos personales) son las que convierten esas pantallas en funcionalidad real. Se
trabajan juntas porque comparten el mismo contrato nuevo: la API de autoservicio del alumno.

La #39 (link de la clase virtual) queda afuera hasta que esté terminada la #33, que es la que carga
y distribuye el link.

## What Changes

- **Nueva API de autoservicio del alumno** (`/alumno`), accesible solo con rol `ALUMNO` y siempre
  acotada a la cuenta de quien llama:
  - `GET /alumno/inscripciones`: las inscripciones propias con curso, comisión, docente, horarios,
    categoría, porcentaje de beca y el estado de habilitación derivado con su causa (misma
    derivación que ve Administración).
  - `GET /alumno/inscripciones/{codigo}`: detalle de la cursada propia con período, horarios y
    próximos encuentros. Responde `404` si la comisión no es una inscripción del alumno.
  - `GET /alumno/mi-perfil`: nombre, DNI, email y teléfono de la cuenta.
  - `PUT /alumno/mi-perfil`: actualiza **solo email y teléfono**. El DNI, el nombre y el
    identificador del sistema no son editables y el contrato los rechaza con `422`. Un email que ya
    pertenece a otra cuenta responde `409`.
- **Cronograma con dato real**: los próximos encuentros se derivan de `comision_horario` (días y
  horarios cargados por Secretaría) y del tema de la clase cuando exista. No se agrega columna de
  fecha de fin: el diseño deja lugar a que la comisión tenga fecha de inicio y fin más adelante.
- **Pantallas del alumno conectadas y recompuestas**: `Mis Cursos` y el detalle de la cursada pasan
  a leer la API real, con el indicador de acceso en verde o rojo y la causa del bloqueo coincidente
  con la que ve Administración. El perfil persiste los datos de contacto, informa el conflicto de
  email duplicado y suma una tarjeta de seguridad con el cambio de contraseña, que reutiliza el
  endpoint existente `POST /auth/change-password`.
- **Rediseño visual del panel** alineado al material ya versionado en
  `docs/design/figma-dashboards-overhaul/`, sin agregar rutas, ítems de menú ni pantallas nuevas.

Fuera de alcance: `Mis Pagos` (HU 40), link de la clase virtual (HU 39), certificados e historia
académica.

## Capabilities

### New Capabilities

- `alumno-api`: contrato de autoservicio del alumno autenticado — consulta de sus inscripciones y del
  detalle de su cursada, estado de habilitación derivado con causa, perfil propio y edición de sus
  datos de contacto, con aislamiento estricto por cuenta.

### Modified Capabilities

- `student-shell`: los requisitos de cursos, detalle de curso, perfil y tablero dejan de describir
  datos de referencia y pasan a exigir datos reales de la API; el perfil guarda de verdad, informa
  el conflicto de email y ofrece el cambio de contraseña.
- `auth-and-roles`: la cuenta del alumno puede cambiar su contraseña desde el panel; el requisito
  deja de declarar que el cambio de contraseña no se implementa.

## Impact

- **Backend**: router nuevo `app/api/alumno.py` + `app/schemas/alumno.py` + `app/services/alumno.py`;
  se reutilizan `services.habilitacion.derivar_estado` y `schemas.validators`
  (`EmailConForma`, `TelefonoE164`). Registro del router en `app/api/router.py`. Tests con
  PostgreSQL real en `app/tests/test_alumno_api.py`.
- **Frontend**: `alumno/StudentCoursesPage.jsx`, `alumno/CourseDetailPage.jsx`,
  `alumno/StudentProfilePage.jsx`, `services/dataService.js`, `services/apiDataSource.js`,
  `services/mockDataSource.js`; se reutiliza `pages/ChangePasswordPage` desde
  `auth/SessionContext.changePassword`. Tests de pantalla existentes a actualizar.
- **Datos**: sin migración. Se lee `inscripcion`, `comision`, `comision_horario`, `clase` y
  `usuario`/`alumno`; no se agregan columnas.
- **Documentación**: decisión nueva en `docs/decisions.md` por el contrato de autoservicio y por el
  cronograma derivado de horarios.
