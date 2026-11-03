# Tasks

## Backend

- [x] Extender el contrato con el listado de inscriptos de una comisión y el cuerpo de la baja.
- [x] Implementar `listar_de_comision` con cupo, inscriptos activos, vacantes y habilitación derivada.
- [x] Implementar `dar_de_baja` con `FOR UPDATE`, validación de relación y transición, y auditoría.
- [x] Tomar la fila de la comisión al inscribir para que el cupo no se cuelen dos altas simultáneas.
- [x] Exponer `GET /inscripciones?comision_id=` y `POST /inscripciones/{id}/baja` con rol `ADMIN`.

## Frontend

- [x] Abrir la comisión al hacer click en su fila, con `Editar` independiente y navegación por teclado.
- [x] Agregar la ruta `/admin/cursos/:codigo/comisiones/:comisionId`.
- [x] Crear la pantalla de la comisión con encabezado, contadores, tabla de inscriptos e historial.
- [x] Extraer el modal de inscripción y el de categoría para reutilizarlos en las dos pantallas.
- [x] Inscribir desde la comisión con la comisión preseleccionada y bloqueada.
- [x] Cambiar la categoría de una inscripción y actualizar el listado.
- [x] Dar de baja con confirmación explícita, aviso de resultado y recarga de contadores.
- [x] Manejar comisión inexistente, lista vacía, error de carga y estados de las bajas.
- [x] Implementar las funciones en los servicios de datos real y de ejemplo.

## Verificación

- [x] Agregar pruebas de backend del listado, la baja, el cupo, los permisos y la concurrencia.
- [x] Agregar pruebas de frontend de navegación, listado, alta, categoría, baja y estados.
- [x] Registrar la decisión en `docs/decisions.md`.
- [x] Ejecutar `ruff check`, `pytest`, `npm run test`, `npm run lint` y `npm run build`.
- [x] Validar el cambio con `openspec validate --strict`.
