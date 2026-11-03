# Tasks

- [x] Agregar `EstadoComprobanteAlumno` y el modelo `ComprobanteAlumno` con sus CHECK.
- [x] Crear la migración `0007_comprobante_alumno` (expand, sin tocar cobranzas).
- [x] Agregar la configuración de storage y la capa `app/core/storage.py` (local y Supabase).
- [x] Agregar contratos de entrada y salida en `app/schemas/comprobantes.py`.
- [x] Implementar el servicio: inicio, subida, verificación, listados y descarga.
- [x] Exponer los endpoints del alumno y de Secretaría en `app/api/comprobantes.py`.
- [x] Sumar `inscripcion_id` al contrato de las cursadas del alumno.
- [x] Montar el volumen privado en `docker-compose.yml` y documentar variables.
- [x] Reemplazar el formulario de «Mis Pagos» y agregar la lista de comprobantes enviados.
- [x] Mostrar los comprobantes pendientes en la pantalla de Cobranzas de Secretaría.
- [x] Agregar pruebas backend (envío, validaciones, permisos, storage, habilitación).
- [x] Agregar pruebas frontend (formulario, validaciones, estado pendiente, listado de Secretaría).
- [x] Registrar las decisiones en `docs/decisions.md` y actualizar el README.
- [x] Validar OpenSpec en modo estricto y correr las suites.
