# Proposal

## Why

Las HU 14 y 15 dejaron el alta de inscripción y la categoría arancelaria, pero la gestión diaria
sigue sin puerta propia: para ver quién cursa una comisión hay que recorrer el padrón general, y no
existe forma de dar de baja una inscripción. La secretaría tampoco puede abrir una comisión desde
el listado del curso: la fila solo ofrece `Editar`.

Esta historia agrega la pantalla de gestión de inscriptos de una comisión y la baja lógica de una
inscripción, reutilizando los modelos, servicios, contratos y componentes que ya existen. No rehace
el alta ni la edición de categoría de las HU 14, 15 y 64.

## What Changes

- Abrir la comisión desde su fila en el listado de comisiones del curso, con `Editar` como acción
  independiente, y navegar a `/admin/cursos/:codigo/comisiones/:comisionId`.
- Exponer `GET /inscripciones?comision_id=` solo para Administración: comisión, cupo, inscriptos
  activos, vacantes y las inscripciones activas e históricas con alumno, DNI, categoría y estado de
  habilitación derivado.
- Exponer `POST /inscripciones/{id}/baja` solo para Administración: baja lógica con `FOR UPDATE`,
  `409` ante una transición inválida y registro en `audit_log`, sin borrar pagos ni imputaciones.
- Reutilizar el modal de inscripción existente con la comisión preseleccionada y bloqueada, y el
  modal de categoría existente sobre la inscripción elegida.
- Mostrar en la tabla de la comisión cupo, inscriptos activos y vacantes, y distinguir las
  inscripciones activas de las dadas de baja.
- Agregar pruebas de backend y frontend del listado, la baja, el cupo, los permisos y la
  navegación.

## Non-goals

- No se rehace el alta de inscripción ni la edición de categoría de las HU 14, 15 y 64.
- No se modifica el formulario general de inscripción de la pantalla de Comisiones.
- No se implementan reglas nuevas de reinscripción ni de rehabilitación de una baja.
- No se tocan cobranzas, imputaciones ni importes históricos.
- No se modifica el esquema: la baja es un estado que ya existe (`EstadoInscripcion.BAJA`).
- No se rediseña la sección de cursos ni otros flujos de navegación.

## Impact

- Backend: `schemas/inscripciones.py`, `services/inscripciones.py`, `api/inscripciones.py` y
  pruebas. Sin migración Alembic.
- Frontend: `App.jsx`, `admin/CoursesPage.jsx`, nueva `admin/CommissionEnrollmentsPage.jsx`,
  `admin/InscripcionModal.jsx` y `admin/CategoriaInscripcionModal.jsx` extraídos de las pantallas
  existentes, `admin/StudentsPage.jsx`, servicios de datos real y de ejemplo, y pruebas.
- Datos: ninguna fila se borra; una baja conserva la inscripción, el alumno y sus pagos.
