# Design

## Context

Ver `proposal.md - Why`. El esquema ya tiene `override_habilitacion` (estado forzado, motivo,
usuario, fecha, `activo`) y `audit_log`, y `habilitacion.derivar_estado()` ya devuelve el forzado
vigente antes de la regla automática. La ficha del alumno (`FichaAlumnoModal`) ya consume
`GET /alumnos/{id}` por inscripción y ya tiene el patrón del lápiz de categoría.

## Goals / Non-Goals

**Goals:**
- Administrar el forzado por inscripción con persistencia real y auditoría.
- Retirar la pantalla independiente sin tocar el cálculo automático ni el resto de las pantallas.
- Reutilizar el contrato del detalle del alumno para que la ficha se recargue sola.

**Non-Goals:**
- Cambiar la regla automática, los importes o las cobranzas.
- Migrar el esquema: las columnas y el CHECK de motivo ya existen.
- Reemplazar el selector binario del prototipo por un flujo de varias aprobaciones.

## Decisions

- **Sin migración.** `override_habilitacion` ya soporta estado, motivo, usuario, fecha y vigencia.
  La unicidad del forzado vigente se garantiza con `SELECT ... FOR UPDATE` sobre la inscripción
  dentro de la transacción, igual que la baja de la HU 60. Un índice parcial único requeriría
  migración y no aporta sobre una inscripción bloqueada; se evita el cambio de esquema.
- **Endpoints en `/inscripciones`.** `POST /inscripciones/{id}/habilitacion` y
  `DELETE /inscripciones/{id}/habilitacion`. El identificador es la inscripción, no el alumno: es
  el vínculo real del modelo y evita el endpoint ficticio por alumno. Alternativa descartada:
  `/alumnos/{id}/habilitacion`, que vuelve a mezclar el alcance global con el de inscripción.
- **Estado automático en el contrato.** `acceso` del detalle suma `estado_automatico` y `motivo`.
  Sin ese dato la ficha no puede ofrecer el estado contrario ni distinguir un forzado de un
  bloqueo real. Es aditivo y no rompe consumidores.
- **Un servicio central.** Las operaciones viven en `services/habilitacion.py` junto a
  `derivar_estado`; la API solo traduce excepciones a HTTP (D1). `derivar_estado` sigue siendo la
  única puerta de lectura, así el forzado prevalece en ficha, comisiones, alumno y clases.
- **Modal propio y reutilizable.** `HabilitacionInscripcionModal` sigue el patrón de
  `CategoriaInscripcionModal` (Modal + Button + Input + StatusIndicator) y recibe la inscripción ya
  cargada. La ficha no navega ni inventa una pantalla.
- **La ficha se recarga por `version`.** El modal de la ficha ya conserva la comisión elegida por
  id; al guardar se incrementa la versión y la comisión seleccionada se mantiene.

## Risks / Trade-offs

- **Dos pestañas con el mismo forzado** → el bloqueo transaccional hace que la segunda reciba
  `409`; la pantalla muestra el error y no duplica filas.
- **Quitar el forzado y leer el estado viejo** → la respuesta del `DELETE` y la recarga posterior
  del detalle salen de la misma base; el frontend recarga `GET /alumnos/{id}`.
- **El mock difiere de la regla real** → el mock solo administra el forzado sobre el ejemplo; los
  tests de la regla viven en la suite de PostgreSQL.

## Migration Plan

Sin migración de base. El despliegue solo cambia código: retirar la ruta y el ítem del menú,
publicar los endpoints nuevos y desplegar el frontend que los usa. La URL `/admin/habilitacion`
cae en la ruta comodín 404 existente. Rollback: revertir el despliegue; las filas de
`override_habilitacion` creadas quedan inertes para la versión anterior y no afectan el cálculo.

## Open Questions

Ninguna.
