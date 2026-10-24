# Tasks

## 1. Backend

- [x] 1.1 Agregar `factura_a_solicitada` a `Cobranza` y la migración Alembic aditiva
- [x] 1.2 Crear `app/schemas/cobranzas.py` con validaciones de fecha, importe, enums, causa y CUIT
- [x] 1.3 Crear `app/services/cobranzas.py` con alta transaccional, listado, búsqueda por titular y resolución de inscripción
- [x] 1.4 Agregar `GET /alumnos/{id}/inscripciones` y registrar `GET/POST /cobranzas` en el router
- [x] 1.5 Escribir tests de API contra PostgreSQL real: alta, GET, imputación, importe, fecha, obligatorios, CUIT, permisos y búsqueda

## 2. Frontend

- [x] 2.1 Extender `dataService`, `apiDataSource` y `mockDataSource` con cobranzas e inscripciones
- [x] 2.2 Conectar `PaymentsPage` al POST, manejar errores, recargar el historial y validar fecha futura
- [x] 2.3 Agregar selector de inscripción y CUIT de Factura A sin cambiar la identidad visual
- [x] 2.4 Actualizar y ampliar `PaymentsPage.test.jsx` y las pruebas de la frontera de datos

## 3. Verificación

- [x] 3.1 Correr pytest contra PostgreSQL real
- [x] 3.2 Correr Vitest
- [x] 3.3 Verificar persistencia después de recargar. Los artefactos OpenSpec se crearon a mano
  porque el CLI `openspec` no está disponible en el `PATH` de esta máquina.
