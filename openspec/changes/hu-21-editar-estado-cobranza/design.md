# Design

- **D55**: la corrección del estado de una cobranza es una actualización de la fila existente, no
  un alta. Se expone `PATCH /cobranzas/{id}/estado` con `estado` y `justificacion`, y la matriz de
  transiciones es `ACREDITADO → OBSERVADO | RECHAZADO`, `OBSERVADO → ACREDITADO | RECHAZADO` y
  `RECHAZADO → ACREDITADO`. Cualquier otra combinación, incluido el cambio al mismo estado, es un
  `422`: el operador tiene que saber que el estado no cambió, no recibir un `200` mudo.
- **Transiciones:** la matriz vive en el servicio (`TRANSICIONES_ESTADO`) y el frontend la repite
  en el dominio (`TRANSICIONES_ESTADO_COBRANZA`) solo para ofrecer los destinos válidos en el
  selector; la API sigue siendo la autoridad y vuelve a validar. La fila se lee con
  `SELECT … FOR UPDATE` para que dos cambios simultáneos no escriban dos entradas de auditoría.
- **Lo que no se toca:** importe, fecha, medio, titular, pagador e imputación quedan igual. La
  `causa` se actualiza con la justificación cuando el estado nuevo es `OBSERVADO` o `RECHAZADO`,
  porque el modelo la exige mientras la cobranza no está acreditada y es el motivo que muestra el
  historial; al acreditar se conserva la anterior como registro de por qué se había observado.
- **Auditoría:** se reutiliza `audit_log` (solo agregado, inmutable por trigger en la migración
  inicial) con `accion = "cobranza.estado_cambiado"`, `entidad = "cobranza"`, `entidad_id` y
  `detalle` JSON con `estado_anterior`, `estado_nuevo`, `justificacion` y `fecha`. La fecha
  también queda en `cobranza.estado_cambiado_at` y el autor en `estado_cambiado_por`, columnas
  que ya existían para la HU 24. **No se agrega migración.** Las dos escrituras van en la misma
  transacción: o quedan el estado y su entrada de auditoría, o no queda ninguna.
- **Errores:** 401 sin sesión, 403 para roles distintos de `ADMIN`, 404 si la cobranza no existe,
  422 para transición no permitida, cambio al mismo estado o justificación vacía. Los mensajes son
  de interfaz y no exponen SQL.
- **Frontend:** el historial suma la columna `ACCIONES` con `Editar estado` en todas las filas. El
  selector de destino sale de `TRANSICIONES_ESTADO_COBRANZA` (dominio), así que nunca ofrece un
  cambio que la API vaya a rechazar. El modal reutiliza el componente `Modal` y muestra titular,
  alumno imputado, importe, fecha y estado actual; el paso de confirmación repite el cambio y la
  justificación antes de enviar. Con `200` se reemplaza la fila en memoria con la respuesta, sin
  recargar el historial; con error se muestra el `detail` y el modal queda abierto.
- **Indicadores:** el último pago imputado de la ficha de habilitación se deriva de
  `GET /cobranzas` filtrando `ACREDITADO` en cada consulta, así que refleja el estado actualizado
  sin cambios y no cuenta un pago observado o rechazado. Se cubre con prueba.
- **Dónde:** `backend/app/schemas/cobranzas.py`, `backend/app/services/cobranzas.py`,
  `backend/app/api/cobranzas.py`, `frontend/src/domain/enums.js`,
  `frontend/src/services/dataService.js`, `frontend/src/services/apiDataSource.js`,
  `frontend/src/services/mockDataSource.js`, `frontend/src/admin/PaymentsPage.jsx`,
  `frontend/src/admin/AccessPage.test.jsx` y sus tests.
