# Tasks

## 1. Baja de la columna en el frontend

- [x] 1.1 Quitar la columna `CÁTEDRA O ESPECIALIDAD` del listado de `Docentes` y sus referencias en
  mocks, fuentes de datos, tests y comentarios (`TeachersPage.jsx`, `TeachersPage.test.jsx`,
  `mocks/docentes.js`, `mockDataSource.js`, `apiDataSource.js`). Verificado con
  `docker compose run --rm frontend npm run test -- --run TeachersPage` (42 tests en verde) y sin
  coincidencias de `catedra` en `frontend/src`.

## 2. Documentación

- [x] 2.1 Registrar la decisión en `docs/decisions.md` como D88 y verificar que la entrada queda
  escrita con fecha y autor.

## Workflow follow-up

- Archivar el change con `openspec archive baja-columna-catedra-docentes` tras la revisión, para
  sincronizar el delta a `openspec/specs/admin-shell/spec.md`.
