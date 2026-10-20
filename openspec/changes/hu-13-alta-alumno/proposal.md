# Proposal

## Why

La historia #13 es una historia **Must** y hoy el padrón de alumnos no tiene alta ni consulta
real: la pantalla `Alumnos e Inscripciones` muestra su estado vacío contra la API porque no
existe ningún endpoint de alumnos. Sin padrón no se pueden construir las inscripciones, las
cobranzas ni la habilitación de accesos, que son las historias que siguen.

Esta entrega implementa el **alta y sus validaciones**. El envío de credenciales por email
queda pendiente de una decisión del equipo, y por eso la historia se implementa de forma
**parcial**: no cierra el issue #13 (`Refs #13`, nunca `Closes #13`).

## What Changes

- Nuevo `POST /alumnos`, exclusivo de Administración, con DNI obligatorio, nombre, email y
  teléfono opcional.
- Nuevo `GET /alumnos` básico, exclusivo de Administración, para que el alta se vea en el
  padrón. La búsqueda por DNI o email sigue siendo la historia #16.
- Validaciones: DNI de 7 u 8 dígitos —se aceptan puntos, espacios y guiones, y se normaliza—,
  nombre obligatorio, email con formato y teléfono opcional.
- El alta crea en una sola transacción el `Alumno` y su `Usuario` con rol `ALUMNO`, con la
  contraseña de demostración almacenada como hash bcrypt. **No se envía ningún correo.**
- Duplicados de documento o email: `409` con un mensaje que nombra el campo repetido. El
  mensaje **no** incluye los datos del alumno existente; es una desviación consciente del
  criterio «muestra el alumno existente» y queda pendiente de aprobación del equipo.
- La pantalla de Alumnos agrega el modal `+ Nuevo Alumno`, reutilizando el diseño y los
  componentes del modal de Docentes. No se modifican colores, tipografías, navegación ni
  estilos globales.
- El listado conserva las columnas actuales. Comisión, categoría y acceso se muestran vacíos
  («Sin comisión», «—») para los alumnos que todavía no tienen inscripción.
- El buscador de la pantalla se deshabilita con `Próximamente`; la búsqueda es la historia #16.
- El aviso de éxito aclara que la cuenta se creó pero las credenciales no se enviaron.

**Fuera de alcance:** envío de credenciales y tratamiento del fallo de envío, pasaporte y
alumno del exterior (HU 47), inscripción y categoría arancelaria (HU 14 y #15), búsqueda
(HU 16), edición (HU 17), cambios de esquema o migraciones.

## Capabilities

### New Capabilities

- `padron-alumnos`: alta y consulta básica del padrón de alumnos, sus validaciones, la
  unicidad de documento y email, y la creación transaccional de la cuenta de acceso.

### Modified Capabilities

- `admin-shell`: la pantalla `Alumnos e Inscripciones` agrega el alta real, consume el padrón
  desde la API, deshabilita el buscador y muestra los huecos de comisión, categoría y acceso
  mientras no exista una inscripción.
- `domain-schema`: el esquema sigue admitiendo pasaporte y documento nulo, pero el alta de
  esta entrega acepta **solo DNI**. El alta con pasaporte y sin DNI queda diferida a la
  HU 47, que está en `Won't`. También se cierra la nota que dejaba la validación de email del
  alumno para el change del alta.

## Impact

- **Backend:** rutas de padrón, esquemas de entrada y salida, servicio de alta y consulta, y
  pruebas `pytest` contra PostgreSQL real. No hay migración: `alumno` y `usuario` ya existen.
- **Frontend:** `StudentsPage`, la frontera `dataService`, las implementaciones `api` y `mock`,
  y pruebas `vitest`. Sin cambios de identidad visual.
- **Documentación:** `docs/decisions.md` registra el alcance DNI-only, la contraseña demo, la
  ausencia de envío de correo y la desviación del `409`.
- **Backlog:** implementación parcial; el issue #13 se referencia, no se cierra.
