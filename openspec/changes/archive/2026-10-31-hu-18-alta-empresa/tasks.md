# Tasks

Cada work unit deja sus propios tests y su propia documentación.

**Trazabilidad del pull request: `Refs #18`. Nunca `Closes`:** el issue #18 se cierra solo si
cumple todos sus criterios de aceptación; si algo queda pendiente, se usa `Refs`.

## 1. `feat(backend)` — Esquema, servicio y API de empresas

- [x] 1.1 Agregar a `app/services/normalization.py` el dígito verificador de CUIT (regla AFIP,
  pesos `5432765432`, resto 0 → "0", resto 1 → "9") y `cuit_es_valido`.
- [x] 1.2 Crear `app/schemas/empresas.py`: `EmpresaCreate` (`razon_social`, `cuit`,
  `requiere_factura_a`, `extra="forbid"`) con validador de CUIT, y `EmpresaOut`.
- [x] 1.3 Crear `app/services/empresas.py`: `EmpresaDuplicada` (trae la empresa existente),
  `crear_empresa` (duplicado por `cuit_norm` → excepción; `IntegrityError` de carrera traducido)
  y `listar_empresas`.
- [x] 1.4 Crear `app/api/empresas.py` con `GET /empresas` y `POST /empresas` (ADMIN) y sumarlo
  al router. 409 con el detalle de la empresa existente; 422 ante CUIT inválido.
- [x] 1.5 Tests en `app/tests/test_empresas_api.py`: alta exitosa, CUIT duplicado (también con
  guiones vs. sin guiones), CUIT con dígito inválido y con letras, razón social vacía, campo
  extra rechazado, listado, 401 sin token y 403 sin rol ADMIN.

## 2. `feat(frontend)` — Alta de empresa en la pantalla de alumnos

- [x] 2.1 `crearEmpresa` en `dataService.js`, `apiDataSource.js` y `mockDataSource.js`
  (el mock rechaza CUIT repetido como el backend).
- [x] 2.2 `StudentsPage.jsx`: acción `+ Nueva Empresa` en el bloque `Cuentas Corporativas
  Vinculadas` y modal `Nueva Empresa` con `Razón Social`, `CUIT` y casilla `Requiere Factura A`;
  errores de validación local y el motivo del backend sin cerrar el modal (D36). La columna
  `PREFERENCIA FACTURA` pasa a renderizar desde `requiere_factura_a`.
- [x] 2.3 Tests en `StudentsPage.test.jsx`: alta exitosa agrega la fila, razón social vacía no
  envía, el rechazo del backend se muestra y el modal queda abierto.
