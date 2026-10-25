# Tasks

## 1. Backend

- [x] 1.1 Agregar `CobranzaEstadoUpdate` a `app/schemas/cobranzas.py` con `estado` y `justificacion` obligatoria
- [x] 1.2 Implementar `cambiar_estado_cobranza` en `app/services/cobranzas.py` con lock de fila, matriz de transiciones y entrada en `audit_log`
- [x] 1.3 Exponer `PATCH /cobranzas/{id}/estado` con `require_roles(Rol.ADMIN)` y traducción a 404/422
- [x] 1.4 Escribir tests de API contra PostgreSQL real: las cinco transiciones, persistencia, auditoría, permisos, mismo estado, transición inválida e importe/imputación intactos
- [x] 1.5 Guardar la justificación como `causa` cuando el estado nuevo no está acreditado

## 2. Frontend

- [x] 2.1 Extender `dataService`, `apiDataSource` y `mockDataSource` con `actualizarEstadoCobranza`
- [x] 2.2 Agregar la matriz de transiciones al dominio y la columna `ACCIONES` con `Editar estado` en todas las filas
- [x] 2.3 Agregar el modal de edición con datos de la cobranza, destinos válidos, justificación, confirmación y manejo de errores
- [x] 2.4 Ampliar `PaymentsPage.test.jsx` y `apiDataSource.test.js`
- [x] 2.5 Cubrir con prueba que el último pago imputado no cuenta un pago observado o rechazado

## 3. Verificación

- [x] 3.1 Correr pytest de cobranzas contra PostgreSQL real
- [x] 3.2 Correr Vitest de los archivos tocados
- [x] 3.3 Verificar que el estado nuevo sobrevive a recargar la pantalla
