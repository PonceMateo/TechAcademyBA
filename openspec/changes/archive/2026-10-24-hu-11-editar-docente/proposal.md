# Proposal

## Why

El padrón de docentes permite consultar, buscar y dar de alta, pero no corregir los datos de un
docente ni recuperar su acceso. Un DNI o un mail mal cargado obliga a crear un docente duplicado, y un
docente que pierde la contraseña no tiene forma de volver a entrar porque el restablecimiento
administrativo solo existe para alumnos. La historia #11 pide ambas cosas sin perder las comisiones ya
asignadas.

## What Changes

- Nuevo `PUT /docentes/{id}`, exclusivo de Administración: actualiza nombre, apellido, DNI, email y
  teléfono, y sincroniza `nombre` y `email` del `Usuario` vinculado en la misma transacción. El CUIL
  sigue fuera del contrato, igual que en el alta (D33).
- Un DNI que ya pertenece a otro docente responde `409`; un email que ya pertenece a otro docente, a
  un alumno o a otra cuenta responde `409` nombrando el padrón. Un `id` inexistente responde `404` y
  los datos inválidos, `422`.
- Nuevo `POST /docentes/{id}/password`, exclusivo de Administración: recibe la nueva contraseña, guarda
  solo su hash, invalida la anterior y deja `must_change_password = true`. El docente entra con la
  contraseña nueva y la cambia en ese mismo ingreso. No se envía correo ni se devuelve la contraseña
  en claro.
- La tabla de docentes agrega una columna `ACCIONES` con los botones **Editar** y **Restablecer
  contraseña**, igual que la tabla de alumnos. El modal de edición reutiliza los campos del alta y no
  pide CUIL. El modal de contraseña pide la nueva y su confirmación, y avisa que el docente deberá
  cambiarla.
- Las comisiones asignadas y su historial SHALL conservarse: la edición no toca `comision.docente_id`.
- Sin migración: `docente`, `usuario`, sus índices únicos y `must_change_password` ya existen.

**Fuera de alcance:** editar el CUIL, dar de baja o reactivar docentes, cambiar sus comisiones desde
esta pantalla, recuperación por el propio docente y cualquier cambio en el alta.

## Capabilities

### New Capabilities

- `edicion-docentes`: edición de los datos personales de un docente y restablecimiento administrativo
  de su contraseña, con la sincronización de su cuenta de acceso.

### Modified Capabilities

- `admin-shell`: la tabla de docentes incorpora la columna `ACCIONES` y los modales de edición y
  restablecimiento de contraseña.

## Impact

- **Backend:** `PUT /docentes/{id}` y `POST /docentes/{id}/password` en `app/api/padron.py`,
  `DocenteUpdate` y `RestablecerPasswordRequest` en `app/schemas/padron.py`, `editar_docente` y
  `restablecer_password` en `app/services/padron.py`, y pruebas `pytest` contra PostgreSQL real.
- **Frontend:** `TeachersPage`, `src/services/dataService.js`, `apiDataSource`, `mockDataSource` y
  pruebas `vitest` de edición, duplicados, contraseña y autorización.
- **Documentación:** `docs/decisions.md` registra la sincronización de la cuenta, el `must_change_password`
  del restablecimiento y la continuidad de D33 para el CUIL.
- **Backlog:** el PR usa `Refs #11` y solo pasa a `Closes #11` si se cumplen todos los criterios.
