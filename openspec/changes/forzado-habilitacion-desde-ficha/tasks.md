# Tasks

## 1. Backend: servicio central

- [x] 1.1 Separar en `services/habilitacion.py` la derivación automática de `derivar_estado`, sin
      cambiar la precedencia del forzado.
- [x] 1.2 Agregar `forzar_estado` y `quitar_forzado` con bloqueo `FOR UPDATE`, validación de
      inscripción `ACTIVA`, motivo, estado contrario al automático, forzado único vigente y
      auditoría de la quita.

## 2. Backend: contrato y rutas

- [x] 2.1 Sumar `estado_automatico` y `motivo` al acceso del detalle del alumno.
- [x] 2.2 Crear `HabilitacionForzadaUpdate` y exponer `POST` y `DELETE
      /inscripciones/{id}/habilitacion` solo para Administración, con sus códigos 401, 403, 404 y
      409.

## 3. Backend: pruebas

- [x] 3.1 Cubrir forzado en ambos sentidos, motivo vacío, persistencia, prevalencia y alcance por
      inscripción.
- [x] 3.2 Cubrir quita, conservación del histórico, auditoría, inscripción no activa, roles,
      duplicados, concurrencia y accesos a clases.

## 4. Frontend: retiro de la pantalla

- [x] 4.1 Quitar `AccessPage`, su test, el ítem del menú, la ruta y los imports sin uso; dejar la
      URL anterior en 404 y las cinco secciones.
- [x] 4.2 Ajustar los tests del armazón y del menú.

## 5. Frontend: forzado desde la ficha

- [x] 5.1 Reemplazar `forzarBloqueoManual` por las operaciones por inscripción en `dataService`,
      `apiDataSource` y `mockDataSource`.
- [x] 5.2 Agregar el lápiz de `Estado de habilitación` y el modal de habilitación con motivo,
      confirmación, error, estado forzado y retorno a la regla automática.
- [x] 5.3 Conectar `StudentsPage` para recargar la ficha conservando la comisión y mostrar el
      resultado.

## 6. Frontend: pruebas

- [x] 6.1 Cubrir la ausencia del menú y la ruta 404.
- [x] 6.2 Cubrir ambos lápices, apertura del modal, motivo obligatorio, forzado, retorno y recarga
      con la comisión conservada.

## 7. Documentación y validación

- [x] 7.1 Registrar la decisión en `docs/decisions.md` con la numeración vigente.
- [x] 7.2 Ejecutar tests de backend y frontend, lint y build; validar OpenSpec en modo estricto.
