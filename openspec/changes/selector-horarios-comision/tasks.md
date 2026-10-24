# Tasks

## 1. Decisiones registradas antes de tocar código

- [ ] 1.1 Registrar en `docs/decisions.md`, con fecha y autor, las decisiones del change —tabla nueva `comision_horario` con `dias_horarios` conservado como texto derivado, contrato con `horarios` estructurado, `409` por solapamiento del docente, `react-datepicker` como única dependencia nueva y `Modal` con pila de modales— y verificar que la entrada quede escrita antes de cualquier cambio de código
- [ ] 1.2 Actualizar `docs/glossary.md`: la entrada **Comisión** deja de nombrar `dias_horarios` como el dato del horario y agrega la entidad `comision_horario`, y se agrega la entrada **Horario de cursada**, verificando que el glosario refleje el modelo nuevo

## 2. Modelo y migración

- [ ] 2.1 Agregar el modelo `ComisionHorario` en `backend/app/models/catalogo.py` con su relación hacia `Comision`, la restricción única por comisión y día y los CHECK de minutos, rango y `fin > inicio`, y verificar que `docker compose exec backend alembic revision --autogenerate` no proponga cambios fuera de esa tabla
- [ ] 2.2 Escribir la migración `backend/alembic/versions/0005_comision_horario.py` con el `create_table`, su `drop_table` reversible y el parser defensivo que convierte los `dias_horarios` existentes en filas, y verificar con `docker compose exec backend alembic upgrade head` seguido de `downgrade -1` y otro `upgrade head`
- [ ] 2.3 Cubrir el parser con tests de pytest: textos que se convierten (`Lunes y miércoles 18:00 a 20:00`, `Mar y Jue 19 a 21 hs`) y textos que quedan sin filas (`Sábados intensivo`, `Mar y Jue 18:30` sin fin, `Lunes 19:10 a 21:00` fuera de la grilla de 15 minutos, `Lunes 23 a 24` fuera de 6:00–22:00 y `Lunes y lunes 19-21` con el día repetido), verificando que en los primeros quedan las filas esperadas, que el texto original nunca cambia y que `docker compose exec backend alembic upgrade head` termina sin errores
- [ ] 2.4 Extender `backend/app/tests/test_migration.py` con la tabla nueva, su clave foránea, su índice único y sus CHECK, verificando que el test los liste uno por uno

## 3. Contrato y reglas de la API

- [ ] 3.1 Reemplazar `dias_horarios` por `horarios: list[HorarioComision]` en `ComisionCreate` y `ComisionUpdate` con `extra="forbid"`, y sumar `horarios` a `ComisionOut`, verificando con tests que un cuerpo con `dias_horarios` responde `422` y que la respuesta trae los horarios estructurados
- [ ] 3.2 Validar en los schemas que `horarios` tenga entre 1 y 7 elementos, que los minutos sean múltiplos de 15, que las horas estén entre 6:00 y 22:00, que `fin > inicio` y que no se repita ningún día, verificando con tests de pytest que cada caso responde `422`, incluido `horarios: []`, que no debe llegar nunca a la derivación de `dias_horarios`
- [ ] 3.3 Persistir los horarios en `crear_comision` y `editar_comision`, regenerando `dias_horarios` desde las filas con el formato del resumen, y verificar con un test que el texto devuelto es el resumen de los horarios guardados
- [ ] 3.4 Implementar el chequeo de solapamiento por docente con comparación estricta, la excepción de servicio y su traducción a `409` en la ruta, verificando con tests el choque con otra comisión del mismo docente, el borde exacto 18:30/18:30 permitido, el mismo horario de otro docente permitido y la comisión dada de baja que no choca
- [ ] 3.5 Excluir la propia comisión del chequeo en `PUT /comisiones/{id}`, verificando con un test que reenviar los horarios actuales o cambiar el rango de un solo día no responde `409`

## 4. Frontend: dominio, servicios y dependencia

- [ ] 4.1 Crear `frontend/src/domain/horarios.js` con la función pura que agrupa días con igual rango y la que formatea hora sin minutos cuando valen cero, y verificar con tests de vitest los ejemplos `Lun y Mié 19-21hs`, `Mar 18:15-21:30hs` y `19-22hs`
- [ ] 4.2 Adaptar `frontend/src/services/mockDataSource.js` y el servicio al payload estructurado, verificando con los tests de `dataService` y de `apiDataSource` que el alta y la edición mandan `horarios` y que el `409` sube con su `status`
- [ ] 4.3 Agregar `react-datepicker` como dependencia del frontend e importar su CSS, verificando con `npm run build` que la aplicación compila con la dependencia nueva

## 5. Frontend: selector, formulario y tabla

- [ ] 5.1 Agregar a `frontend/src/components/ui/Modal.jsx` la pila de modales y el foco atrapado, verificando con tests que `Escape` cierra solo el modal de arriba, que el foco queda adentro y que al cerrar vuelve al control que lo abrió
- [ ] 5.2 Implementar el selector de horarios —título `Horario de cursada`, switch `Mismo horario todos los días` activado por defecto, chips de día como botones con `aria-pressed`, un rango por día, `Listo` deshabilitado sin días activos y la confirmación al volver a `mismo`— y verificar con tests de vitest cada uno de esos comportamientos
- [ ] 5.3 Implementar las reglas del rango en una función pura —inicio entre 6:00 y 21:45, fin estrictamente mayor, duración por defecto de dos horas topeada en 22:00, recálculo solo si el fin no se editó a mano, redondeo del tipeo al múltiplo de 15 y restauración del valor anterior—, y verificar con tests los casos 19:00→21:00, 21:00→22:00, `13:42`→`13:45`, `21:19`→`21:15` y texto inválido
- [ ] 5.4 Montar el picker de hora sobre esa función en modo solo hora, con portal y z-index por encima del modal, verificando en el navegador que el popover no queda tapado, que las 22:00 se pueden elegir y que el tipeo se normaliza al confirmar
- [ ] 5.5 Reemplazar el `Input` de texto libre por la fila `Días y Horarios` de ancho completo con chips de solo lectura, el botón `Agregar horarios` / `Modificar horarios`, el estado `Sin horarios definidos`, el error `Agregá al menos un horario` y el scroll interno del modal, en el alta y en la edición, verificando con tests de vitest cada estado
- [ ] 5.6 Mostrar el `409` de choque de horario bajo el campo `Días y Horarios` con la comisión en conflicto, sin cerrar el formulario, verificando con un test que simula la respuesta de la API
- [ ] 5.7 Implementar el renderer compacto de la tabla `HORARIO` —una línea con ellipsis, tooltip con el texto completo y badge `+N` determinista cuando hay más de un grupo, con popover— y verificar con tests que7 días con rangos distintos se ven sin truncar en el formulario y con `+N` en la tabla

## 6. Verificación integral

- [ ] 6.1 Correr la suite completa del backend en contenedores y verificar que pasa sin tocar otra capability
- [ ] 6.2 Correr `npm run lint` y `npm run test` del frontend y verificar que pasan
- [ ] 6.3 Levantar el entorno con `docker compose up -d` y recorrer a mano el alta con horarios, la edición, el choque de horario del mismo docente y el resumen de 7 días, verificando que cada caso se ve como describen los criterios de aceptación
