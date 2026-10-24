# Design

- **D53**: la HU 21 persiste `Pagador`, `Cobranza` e `Imputacion` en una transacción. El
  `Pagador` se crea por cobranza, sin deduplicación: el formulario no captura documento en los
  pagos normales y el cliente pidió no administrar un padrón de pagadores.
- **Imputación**: el formulario elige un alumno, pero el modelo exige una inscripción. Se agrega
  `GET /alumnos/{id}/inscripciones` y el `POST /cobranzas` acepta `inscripcion_id`. El servicio
  valida que la inscripción exista, sea del alumno y esté `ACTIVA`; si se omite y el alumno tiene
  exactamente una activa, la usa. Con cero o varias responde 422.
- **Factura A**: no se crea ningún registro `Factura`. Se agrega
  `cobranza.factura_a_solicitada` con migración aditiva y se exige `cuit_titular` válido cuando
  está marcada; el CUIT se guarda en `Pagador.documento`/`documento_norm`. La emisión queda para
  la HU 25.
- **Historial**: `GET /cobranzas` devuelve la fila armada con pagador e imputación resueltos,
  ordenada por fecha e id descendente. Acepta `q` para coincidencias parciales por nombre del
  titular. `factura` es `"A"` solo si se solicitó; en otro caso `null`, y la tabla muestra `—`.
- **Validación**: Pydantic valida fecha no futura (zona `America/Argentina/Buenos_Aires`),
  importe > 0, enums de medio y estado, causa no vacía si no está acreditado y CUIT con dígito
  verificador. La base conserva sus CHECKs como segunda defensa.
- **Errores**: 401/403 por `require_roles(Rol.ADMIN)`, 404 para alumno/inscripción inexistente,
  422 para datos o combinaciones inválidas. Los mensajes son de interfaz y no exponen SQL ni
  detalles internos.
- **Frontend**: el formulario conserva campos y estilo. Al elegir alumno carga sus inscripciones;
  con una sola la muestra seleccionada, con varias muestra un selector y sin ninguna bloquea el
  alta imputada. El `try/catch` muestra el `detail` del backend y solo confirma con éxito. Tras
  el alta recarga con `GET /cobranzas`.
