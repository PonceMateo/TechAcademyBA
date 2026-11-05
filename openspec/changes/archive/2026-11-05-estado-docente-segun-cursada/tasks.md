# Tasks

## 1. Backend: todos los docentes y `cursando` en la respuesta

- [x] 1.1 En `app/services/padron.py::listar_docentes` se quitó el filtro `activo = true` y
  `_asignar_comisiones` deriva `cursando` (Vigente: `fecha_fin >= hoy` en
  `America/Argentina/Buenos_Aires` o `fecha_fin` nula; vía `estado_comision`). Verificado con
  `pytest app/tests/test_docentes_busqueda.py app/tests/test_padron_docente_api.py
  app/tests/test_edicion_docente.py app/tests/test_docente_credenciales.py` (19 + 55 en verde).
- [x] 1.2 `app/schemas/padron.py::DocenteOut` declara `cursando: bool = False`; el alta lo setea en
  `False` y la edición y el restablecimiento lo derivan con `_asignar_comisiones`.
- [x] 1.3 Tests: el listado incluye docente con `activo = false`; `cursando` verdadero con
  `fecha_fin` futura, nula y con `fecha_fin >= hoy`; falso cuando todas terminaron; falso sin
  comisiones. `ruff check` en verde.

## 2. Frontend: badge derivado y listado completo

- [x] 2.1 `apiDataSource.js` y `mockDataSource.js` conservan `cursando`; el mock lo deriva con
  `estadoDeComision` y `buscarDocentesEnStore`/`listarDocentes` dejaron de excluir `activo = false`.
- [x] 2.2 `TeachersPage.jsx`: la columna `ESTADO` muestra `Activo` en verde con `cursando: true` e
  `Inactivo` en gris con `cursando: false`.
- [x] 2.3 Tests actualizados: Profe Martín, Santi Ads e Ing. González `Activo`; Lic. Laura Benítez y
  Dr. Marcelo Ríos `Inactivo`; caso de docente sin cursada en el listado; derivación en
  `dataService.test.jsx`. Verificado con `npm run test -- --run TeachersPage dataService
  apiDataSource AdminLayout shellConsistency` (158 en verde).

## 3. Documentación

- [x] 3.1 Decisión registrada en `docs/decisions.md` como D90.
- [x] 3.2 `Purpose` de `openspec/specs/padron-docentes/spec.md` editado: listado completo en vez de
  filtro de activos.

## Workflow follow-up

- Archivar el change con `openspec archive estado-docente-segun-cursada` tras la revisión, para
  sincronizar los deltas a `openspec/specs/padron-docentes/spec.md` y
  `openspec/specs/admin-shell/spec.md`.
