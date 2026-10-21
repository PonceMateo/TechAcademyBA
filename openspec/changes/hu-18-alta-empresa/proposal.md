# Proposal

## Why

La historia #18 pide dar de alta empresas (razón social, CUIT y necesidad de Factura A) para
gestionar paquetes cerrados. El modelo `empresa` ya existe en PostgreSQL (migración 0001) y la
pantalla de Alumnos ya dibuja el bloque `Cuentas Corporativas Vinculadas`, pero no hay endpoint
de alta ni formulario: la tabla vive vacía en modo API.

## What Changes

- **Backend**: `GET /empresas` y `POST /empresas` (rol ADMIN). El alta valida razón social
  obligatoria, CUIT por formato y dígito verificador, y unicidad del CUIT normalizado (D6); un
  CUIT repetido responde 409 e identifica la empresa existente.
- **Frontend**: alta de cuenta corporativa desde la pantalla `Alumnos e Inscripciones`, en el
  bloque `Cuentas Corporativas Vinculadas` (el spec de `admin-shell` la ubica ahí y no en una
  pantalla propia). Botón `+ Nueva Empresa` y modal `Nueva Empresa` con `Razón Social`, `CUIT` y
  la casilla `Requiere Factura A`.
- **Tests**: suite de API contra PostgreSQL real y tests de la pantalla con la fuente de ejemplo.

### Non-goals

- No se implementan las historias #19 (contratos y nómina) ni #20 (buscador corporativo).
- No hay edición ni baja de empresa: solo alta y consulta.
- No se agrega ítem de menú nuevo.

## Capabilities

### New Capabilities
- `cuentas-corporativas`: consulta y alta de empresas contra la API.

### Modified Capabilities
- `admin-shell`: el bloque `Cuentas Corporativas Vinculadas` gana el alta (`+ Nueva Empresa` y
  su modal).

## Impact

- **Spec**: delta en `cuentas-corporativas` (nuevo) y `admin-shell`.
- **Backend**: `app/api/empresas.py` (nuevo), `app/api/router.py` (una línea),
  `app/schemas/empresas.py` (nuevo), `app/services/empresas.py` (nuevo),
  `app/services/normalization.py` (validador de dígito verificador de CUIT),
  `backend/app/tests/test_empresas_api.py` (nuevo).
- **Frontend**: `frontend/src/services/{dataService,apiDataSource,mockDataSource}.js`,
  `frontend/src/admin/StudentsPage.jsx`,
  `frontend/src/admin/StudentsPage.test.jsx`.
- **Sin migración**: la tabla `empresa` ya existe con sus restricciones.
