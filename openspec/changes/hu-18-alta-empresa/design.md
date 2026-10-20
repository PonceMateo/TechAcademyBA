# Design

- **D1**: el endpoint vive en `app/api/empresas.py` con router propio, un módulo por
  concernimiento como en `padron.py`; la lógica queda en `app/services/empresas.py` (D1).
- **D2**: la validación de dígito verificador corre en el esquema Pydantic (422 con mensaje
  claro) **y** la base ya la sostiene con `ck_empresa_cuit_digito`: doble defensa deliberada, la
  misma estrategia del resto del esquema.
- **D3**: el 409 del duplicado trae en el `detail` el nombre y el CUIT de la empresa existente,
  porque el criterio de #18 pide "mostrar la empresa existente" y un "CUIT ya registrado" no
  alcanza para saber a qué empresa volver.
- **D4**: `requiere_factura_a` es obligatorio en el contrato (booleano): el criterio pide
  indicar si la empresa requiere Factura A, y un campo ausente sería una respuesta que el
  formulario nunca produce.
- **D5**: no hay columna normalizada nueva: `cuit_norm` y su índice único ya existen (D6), y el
  alta normaliza con `normalize_document` como el resto de los documentos.
- **D6**: en el frontend la columna `PREFERENCIA FACTURA` lee `requiere_factura_a` (el campo del
  modelo), que las filas de ejemplo también traen; `preferencia_factura` queda como dato
  reservado del maquetado.
