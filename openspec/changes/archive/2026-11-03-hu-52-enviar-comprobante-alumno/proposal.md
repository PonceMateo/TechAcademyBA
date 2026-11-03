# Proposal

## Why

Hoy el alumno no tiene forma de enviar su comprobante de pago desde el sistema: la pantalla
«Mis Pagos» solo confirma en el navegador y el comprobante real llega por WhatsApp. Eso deja el
pago fuera de trazabilidad, obliga a Secretaría a pedir el archivo por un canal privado sin
control y no permite consultar el estado del envío.

El envío de un comprobante **no acredita el pago**. La acreditación sigue siendo una decisión de
Secretaría dentro del flujo de cobranzas de las HU 21 y 22.

## What Changes

- Agregar la entidad independiente `comprobante_alumno` con estado inicial `PENDIENTE_REVISION`
  (más un estado técnico `PENDIENTE_CARGA` mientras se sube el archivo).
- Exponer `POST /alumno/comprobantes` (inicio), `PUT /alumno/comprobantes/{id}/archivo`,
  `POST /alumno/comprobantes/{id}/confirmar`, `GET /alumno/comprobantes` y
  `GET /alumno/comprobantes/{id}/archivo`.
- Exponer para Secretaría `GET /comprobantes` y `GET /comprobantes/{id}/archivo`.
- Validar inscripción propia y activa, fecha no futura, importe positivo, medio de pago, CUIT
  cuando se pide Factura A y archivo PDF/JPG/PNG de hasta 5 MB con contenido real válido.
- Agregar una capa de almacenamiento privado reutilizable: volumen dedicado en desarrollo y
  carga directa con URL firmada en producción; sin carpeta pública ni fallback insegura.
- Reemplazar el formulario de ejemplo de «Mis Pagos» por el envío real y agregar la lista de
  comprobantes enviados con su estado.
- Mostrar en Cobranzas los comprobantes pendientes de revisión y permitir abrir su adjunto.
- Agregar la migración Alembic `0007_comprobante_alumno` y las pruebas de backend y frontend.

## Non-goals

- No se acredita, observa ni rechaza el comprobante desde esta historia.
- No se crea una cobranza, un pagador ni una imputación al recibir el comprobante.
- No se modifica la habilitación del alumno ni el estado de su inscripción.
- No se agrega `PENDIENTE_REVISION` al enum de `cobranza` ni se toca D12.
- No se implementa la emisión de Factura A (HU 25) ni la aceptación definitiva del comprobante.
- No se sube ningún archivo al repositorio ni se expone una carpeta pública.
