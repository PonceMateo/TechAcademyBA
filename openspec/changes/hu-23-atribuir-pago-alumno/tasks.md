# Tasks

## 1. Contrato y servicio

- [x] 1.1 `ImputacionCreate` con destino único y monto positivo; `imputaciones` en `CobranzaCreate`
      con suma dentro del importe y destinos no repetidos.
- [x] 1.2 `ImputacionesCreate` para el reparto posterior y `PagoAlumnoOut` para el historial.
- [x] 1.3 `crear_cobranza` crea una cobranza y N imputaciones; la vía de un solo alumno no cambia.
- [x] 1.4 `agregar_imputaciones` bloquea la cobranza, valida el saldo y deja `audit_log`.
- [x] 1.5 Serialización con `imputaciones`, `monto_imputado` y `saldo_sin_imputar`, conservando
      `imputacion`.

## 2. Endpoints

- [x] 2.1 `POST /cobranzas/{id}/imputaciones` con 404/422.
- [x] 2.2 `GET /alumno/pagos` con rol `ALUMNO` y legajo tomado del usuario.

## 3. Empresas

- [x] 3.1 Validar empresa activa con contrato corporativo `ACTIVO` al imputar.
- [x] 3.2 Documentar el bloqueo de la pantalla: la HU 19 no tiene endpoint de contratos.

## 4. Frontend

- [x] 4.1 Modos `Un alumno`, `Varios alumnos` y `Sin imputar`.
- [x] 4.2 Editor de distribución con agregar/quitar, inscripción por alumno, importes, partes
      iguales y totales en vivo.
- [x] 4.3 `Agregar imputación` en el historial con imputaciones existentes y saldo disponible.
- [x] 4.4 Fuente de ejemplo con reparto y saldo.

## 5. Pruebas

- [x] 5.1 API de distribución, reparto parcial, imputación posterior, importes inválidos,
      sobreimputación y empresa con y sin contrato.
- [x] 5.2 Historial del alumno y permisos de acceso.
- [x] 5.3 Pantalla: reparto de $120.000, saldo parcial, rechazo por exceso, partes iguales y
      reparto posterior.
- [x] 5.4 Suites completas de backend y frontend en verde.
