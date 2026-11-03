# Design

## Contexto

Las inscripciones ya tienen alta (`POST /inscripciones`), edición de categoría
(`PATCH /inscripciones/{id}`) y estado `BAJA` en el enum, y el cupo se deriva de las inscripciones
`ACTIVA` (D10). Lo que falta es la lectura por comisión, la baja y la pantalla.

Decisiones que se reutilizan sin reabrir:

- **D9:** el estado de habilitación no se escribe: se deriva con `habilitacion.derivar_estado`.
- **D10:** las vacantes no son una columna; son `cupo_maximo` menos las inscripciones `ACTIVA`.
- **HU 64:** la categoría es de la inscripción y se valida con `_validar_categoria`, la misma
  función que usa el alta y el `PATCH`.
- **D68:** el importe histórico de la inscripción no se recalcula al cambiar la categoría, y esta
  historia tampoco toca cobranzas ni imputaciones.
- **Registro de auditoría:** `audit_log` solo admite agregados; la baja deja una fila con
  `entidad = "inscripcion"` y `accion = "inscripcion.baja"`.

## API

| Ruta | Rol | Respuesta |
| --- | --- | --- |
| `GET /inscripciones?comision_id=` | `ADMIN` | `200` con la comisión, el cupo, los inscriptos activos, las vacantes y todas las inscripciones (activas y `BAJA`). `404` si la comisión no existe. |
| `POST /inscripciones/{id}/baja` | `ADMIN` | `200` con la inscripción en `BAJA`. `404` si la inscripción o la comisión no existen o no se corresponden; `409` si ya no está `ACTIVA`. |

Sin sesión `401`; `DOCENTE` y `ALUMNO` reciben `403` en ambas rutas, con `require_roles(Rol.ADMIN)`
como el resto de la administración.

El listado incluye **las dos cosas en una consulta**: las filas y los contadores. Las vacantes se
cuentan sobre las `ACTIVA` de esa comisión, así una baja libera un lugar en la misma respuesta. El
estado de habilitación viaja solo para las `ACTIVA`: una inscripción dada de baja o completada
muestra su estado de inscripción, porque no hay bloqueo que derivar (igual que la ficha del alumno).

## Alta desde la comisión

No hay contrato nuevo: el formulario reutiliza `POST /inscripciones` con el `comision_id` de la
comisión abierta. El campo bloqueado es una restricción de interfaz; el backend ya valida que la
comisión exista, el cupo y el duplicado, y no acepta un `comision_id` distinto del que la pantalla
muestra porque el cuerpo lo trae explícito. El listado se recarga al confirmar y las vacantes salen
de la fuente, no de una resta del cliente.

Para que la comprobación de cupo y el alta no se cuelen entre dos peticiones simultáneas, el alta
toma la fila de la comisión con `SELECT ... FOR UPDATE` y hace la cuenta y el `INSERT` en la misma
transacción. El índice único `uq_inscripcion_alumno_comision` sigue siendo la garantía del
duplicado.

## Baja lógica

`dar_de_baja` hace, en una sola transacción:

1. Carga la inscripción con `SELECT ... FOR UPDATE`.
2. Comprueba que exista y que `comision_id` coincida con el cuerpo (si no, `404`).
3. Exige el estado `ACTIVA`: cualquier otro estado es una transición inválida y responde `409`.
4. Escribe `estado = BAJA` y una fila de `audit_log` con el autor, la inscripción y la comisión.
5. Un único `commit`.

La fila no se borra, el alumno sigue en el padrón y las cobranzas, imputaciones y comprobantes
conservan su `inscripcion_id`. Al quedar fuera de las `ACTIVA`, la vacante se libera sola porque el
cupo se deriva (D10). No se implementa rehabilitación: la HU no la pide y su contrato se deja
intacto.

## Frontend

- **Listado de comisiones:** la tabla ya soporta `onFila` y `etiquetaDeFila` (HU 61). La fila abre
  la comisión y el botón `Editar` sigue siendo un control hermano: la tabla ignora los clicks sobre
  `button`, así que no se dispara la navegación.
- **Pantalla de la comisión:** ruta `/admin/cursos/:codigo/comisiones/:comisionId`, con el nombre
  del curso y el código de la comisión, el botón `Volver a las comisiones`, los tres contadores y la
  tabla de inscriptos. Las bajas se muestran al final y con su estado visible.
- **Modales compartidos:** el modal de inscripción de Comisiones se extrae a `InscripcionModal`, que
  acepta una comisión fija opcional; el modal de categoría se extrae a `CategoriaInscripcionModal`.
  Los dos los usan la pantalla existente y la nueva, así que no hay dos versiones de la misma regla
  ni dos formularios que se desincronicen.
- **Baja:** confirmación explícita que aclara que se da de baja **solo esa inscripción**; al
  confirmar se recarga el listado y se anuncia el resultado. Un `409` se muestra como aviso y
  recarga, porque el estado lo decide el backend.

## Pruebas

- Backend: listado con activas y bajas, comisión inexistente, cupo y vacantes, alta en la comisión,
  duplicado y cupo lleno, cambio de categoría aislado, baja con liberación de vacante, conservación
  de cobranzas e historial, baja duplicada `409`, permisos `401`/`403` y bloqueo de la fila.
- Frontend: click en la fila navega, `Editar` no navega, datos reales del listado, alta con comisión
  bloqueada, edición de categoría, confirmación de baja, contadores actualizados y estados vacíos y
  de error.

## Alternativas descartadas

- **Listar los inscriptos desde `GET /comisiones` y filtrar en el cliente:** no distingue activas de
  bajas, no trae DNI ni habilitación y obliga a una consulta por fila.
- **Borrar la inscripción:** pierde la trazabilidad de las cobranzas y de la asistencia, y el
  alumno dejaría de tener historial. El estado `BAJA` ya existe en el enum.
- **Recalcular vacantes en el cliente después de la baja:** la respuesta de la baja y el listado
  son la autoridad; una resta local se desincroniza con cualquier otra sesión.
- **Duplicar el formulario de inscripción en la pantalla nueva:** dos copias de las mismas reglas
  de beca y empresa terminan diciendo cosas distintas.
