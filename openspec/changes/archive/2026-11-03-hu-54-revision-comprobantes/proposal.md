# Proposal

## Why

La HU 52 dejó el comprobante del alumno almacenado y visible, pero el circuito administrativo
seguía abierto: Secretaría podía listar los pendientes y abrir el adjunto, y nada más. Para
acreditar el pago había que cargar una cobranza a mano, sin vínculo con el comprobante, y el
alumno no tenía forma de saber si su envío se aceptó, se observó o se rechazó.

Esta historia cierra el circuito dentro de «Cobranzas e Ingresos», sin duplicar el alta de
cobranzas de las HU 21, 22 y 23 ni la imputación de la HU 23, y sin cambiar la habilitación del
alumno por una vía paralela: la aceptación reutiliza la lógica existente y la habilitación se
deriva igual que siempre.

## What Changes

- Extender `comprobante_alumno` con los estados `ACEPTADO`, `OBSERVADO` y `RECHAZADO`, el vínculo
  con la cobranza acreditada (`cobranza_id`, único), el administrador y la fecha de resolución, el
  motivo obligatorio y el vínculo del reenvío (`comprobante_origen_id`, único).
- Agregar la migración aditiva `0008_revision_comprobantes` y los CHECK que sostienen la
  coherencia de la resolución en PostgreSQL.
- Exponer para Secretaría `GET /comprobantes?estado=`, `GET /comprobantes/{id}`,
  `POST /comprobantes/{id}/aceptar`, `POST .../observar` y `POST .../rechazar`.
- Exponer para el alumno `POST /alumno/comprobantes/{id}/reenviar`, que crea un envío nuevo
  pendiente y conserva el original con su motivo.
- Reutilizar `cobranzas.construir_cobranza` dentro de la transacción de la aceptación, con bloqueo
  `SELECT ... FOR UPDATE` de la fila del comprobante y `409` para la segunda resolución.
- Reemplazar la bandeja de comprobantes de Cobranzas por un panel de revisión con filtros, orden
  por fecha de recepción, detalle con adjunto integrado y las tres acciones.
- Mostrar en «Mis Pagos» los cuatro estados con su motivo y permitir reenviar un observado.
- Agregar pruebas de backend y frontend para el circuito completo.

## Non-goals

- No se rehace el envío, la verificación ni el almacenamiento privado de la HU 52.
- No se crea un servicio de cobranzas paralelo: la aceptación usa el alta existente.
- No se toca el esquema de cobranzas, pagadores ni imputaciones, ni la matriz de transiciones de
  `EstadoCobranza` (HU 21 y HU 45).
- No se modifica la habilitación por fuera de `habilitacion.derivar_estado` (HU #27).
- No se emite la Factura A: se conserva la solicitud y el CUIT con la cobranza (HU 25).
- No se implementa el contador de pendientes del menú; el criterio es opcional.
- No se archiva el original observado ni se borra ningún comprobante.

## Impact

- Backend: `models/comprobantes.py`, `models/enums.py`, `schemas/comprobantes.py`,
  `services/comprobantes.py`, `services/cobranzas.py` (extracción de `construir_cobranza`),
  `api/comprobantes.py`, migración `0008_revision_comprobantes`, tests.
- Frontend: `admin/ComprobantesAlumnoCard.jsx`, `alumno/StudentPaymentsPage.jsx`,
  `domain/enums.js`, `services/{dataService,apiDataSource,mockDataSource}.js`, tests.
- Datos: los comprobantes existentes siguen siendo válidos; no se borran filas.
