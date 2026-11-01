# Proposal

## Why

La historia #17 es **Should** y el padrón de alumnos ya tiene alta, consulta y búsqueda reales,
pero todavía no permite corregir los datos de un alumno, restablecer su acceso ni retirarlo del
padrón. Sin esas operaciones, un DNI mal cargado obliga a crear un alumno duplicado y un alumno
que deja de asistir queda para siempre en el listado.

Esta entrega amplía el alcance de la HU 17 para incluir la **baja lógica**: el alumno deja de
aparecer y de poder ingresar, pero sus inscripciones, pagos e historial se conservan. El requisito
oficial (`docs/requirements/Historias_de_Usuario_TechAcademy_BA.csv`) ya quedó actualizado con
los escenarios de baja antes de implementar.

## What Changes

- Nuevo `PUT /alumnos/{id}`, exclusivo de Administración: edita DNI, nombre, email y teléfono,
  conserva el mismo `id` y legajo, sincroniza `usuario.email` y `usuario.nombre`, y reutiliza las
  validaciones y la unicidad del alta. Un DNI o email de otro alumno responde `409` nombrando el
  campo.
- Nuevo `POST /alumnos/{id}/password`, exclusivo de Administración: recibe la nueva contraseña,
  guarda solo su hash, invalida la anterior y deja `must_change_password = true` para el próximo
  ingreso. No se envía correo.
- Nuevo `DELETE /alumnos/{id}`: **baja lógica**. Marca `alumno.activo = false` y
  `usuario.is_active = false` en una sola transacción. No borra filas ni relaciones.
- Nuevo `GET /alumnos/reactivable` y `POST /alumnos/{id}/reactivar`: si un alta choca con un
  alumno dado de baja, el administrador puede reactivar el mismo registro en lugar de crear un
  duplicado. Conserva `id`, legajo, inscripciones, pagos e historial, y recibe una nueva contraseña
  inicial con cambio obligatorio.
- `GET /alumnos` deja de devolver alumnos con `activo = false`. El login ya rechaza cuentas
  inactivas, así que el alumno dado de baja no puede iniciar sesión.
- La pantalla de Alumnos agrega las acciones **Editar**, **Restablecer contraseña** y
  **Eliminar alumno**, con modales que reutilizan los componentes existentes y confirmación antes
  de la baja. Si el alta detecta un alumno inactivo, muestra el modal **Reactivar alumno**. Los
  datos visibles se actualizan después de cada operación y la baja muestra su mensaje de
  confirmación.
- Sin migración: `alumno.activo` y `usuario.is_active` ya existen y ya son la representación de
  la baja lógica del modelo.

**Fuera de alcance:** eliminación física, envío de correos, recuperación por el propio alumno,
edición de la categoría arancelaria o de las inscripciones, y cualquier cambio de contrato de
otras historias.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `padron-alumnos`: edición de datos, restablecimiento administrativo de contraseña y baja lógica.
- `auth-and-roles`: la contraseña restablecida por Administración obliga a cambiarla en el
  siguiente ingreso y la baja desactiva la cuenta de acceso.
- `admin-shell`: la pantalla de Alumnos incorpora las tres acciones y sus modales de confirmación.
