# Tasks

## Modelo y migración

- [x] Extender `EstadoComprobanteAlumno` con `ACEPTADO`, `OBSERVADO` y `RECHAZADO`.
- [x] Agregar a `ComprobanteAlumno` el vínculo con la cobranza, el revisor, la fecha y el motivo
  de la resolución y el comprobante de origen del reenvío, con sus CHECK y restricciones únicas.
- [x] Crear la migración aditiva `0008_revision_comprobantes` (revises `0007_comprobante_alumno`).
- [x] Actualizar la prueba del esquema con los CHECK, los índices únicos y la versión nueva.

## Backend

- [x] Extraer `cobranzas.construir_cobranza` sin confirmar y conservar `crear_cobranza` como estaba.
- [x] Implementar `listar_para_revision` con pendientes primero y orden por fecha de recepción.
- [x] Implementar `obtener_para_revision` y ampliar el permiso de adjunto a comprobantes resueltos.
- [x] Implementar `aceptar` con `FOR UPDATE`, cobranza `ACREDITADO`, imputación y auditoría.
- [x] Implementar `observar` y `rechazar` con motivo obligatorio y sin cobranza.
- [x] Implementar `iniciar_reenvio` reutilizando la carga de la HU 52.
- [x] Exponer los endpoints administrativos y el de reenvío con `require_roles`.
- [x] Devolver `409` en la segunda resolución y `422` por causa vacía o inscripción inactiva.
- [x] Incluir estado, motivo y vínculo de reenvío en el contrato del alumno.

## Frontend

- [x] Reemplazar la bandeja por el panel de revisión con filtro por estado y orden del backend.
- [x] Mostrar alumno, comisión, titular o «Sin identificar», importe, fecha, medio y estado.
- [x] Abrir el detalle con el PDF o la imagen integrados y los datos de la resolución.
- [x] Agregar las acciones Aceptar, Observar y Rechazar con confirmación y motivo obligatorio.
- [x] Recargar la lista y avisar cuando otro administrador ya resolvió el comprobante.
- [x] Mostrar los cuatro estados y el motivo en «Mis Pagos».
- [x] Permitir reenviar un comprobante observado con un archivo nuevo.
- [x] No ofrecer un segundo reenvío del mismo comprobante observado.
- [x] Actualizar los servicios de datos real y de ejemplo.

## Verificación

- [x] Agregar pruebas de backend del panel, la aceptación, las resoluciones, el reenvío, la
  concurrencia, el rollback y los permisos.
- [x] Actualizar y ampliar las pruebas de frontend del panel y de «Mis Pagos».
- [x] Registrar la decisión en `docs/decisions.md`.
- [x] Ejecutar `ruff check`, la suite completa de pytest y la suite de frontend.
