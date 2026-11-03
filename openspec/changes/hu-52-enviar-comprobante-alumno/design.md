# Design

## Decisión: entidad independiente

El comprobante enviado por el alumno se guarda en `comprobante_alumno`, una tabla propia, y **no**
en `cobranza`. Una cobranza es un hecho contable con importe, estado y auditoría que impacta en la
habilitación; un comprobante enviado es una **declaración del alumno pendiente de revisión**. Si
compartieran tabla, cualquier fila pendiente entraría en los saldos y en las consultas de
cobranzas sin querer.

La entidad registra: alumno autenticado, inscripción a imputar, fecha del pago, importe, medio de
pago, titular opcional, solicitud de Factura A, CUIT cuando corresponde, referencia de archivo,
estado y fecha/hora del envío (`enviado_at`).

No hay clave foránea a `cobranza`: la integración futura (aceptar/rechazar) es la que decidirá si
crea una cobranza acreditada y sus imputaciones reutilizando el flujo de las HU 21 y 22.

## Decisión: estados

`EstadoComprobanteAlumno` tiene dos valores:

- `PENDIENTE_CARGA`: fila técnica creada al iniciar la subida. No se lista en ninguna pantalla.
- `PENDIENTE_REVISION`: estado inicial visible una vez verificado el archivo.

El estado inicial **observable** es `Pendiente de revisión`. No se agregan `ACEPTADO` ni
`RECHAZADO` porque la aceptación definitiva pertenece al flujo de revisión de cobranzas y se
documenta como integración futura. Los estados de `cobranza` (D12) no se tocan.

El paso intermedio permite verificar el archivo **después** de almacenarlo, tal como exige la
historia, sin dejar una fila «pendiente» con un archivo que nunca llegó. Si la verificación falla,
se borran la fila y el objeto: no quedan registros inconsistentes.

## Decisión: titular opcional

`titular` es nulo cuando el alumno no informa quién pagó. Nulo significa **no identificado** y no
se completa con el nombre del alumno: el comprobante puede haberlo pagado un familiar o una
empresa y asumir lo contrario inventaría un dato. Es una diferencia deliberada con
`TITULAR_SIN_IDENTIFICAR` de la cobranza manual, donde la pantalla necesita un texto para mostrar.

`cuit`/`cuit_norm` solo se aceptan cuando se solicita Factura A, se validan con la misma regla de
dígito verificador del padrón (`EXPRESION_CUIT_VALIDO`) y se guardan normalizados.

## Decisión: almacenamiento privado en dos pasos

La carga se hace en tres llamadas para que funcione igual en desarrollo y en producción:

1. `POST /alumno/comprobantes` valida los metadatos y devuelve el destino de subida.
2. El archivo se sube a ese destino: al backend (`PUT .../archivo`) en desarrollo, o directo al
   storage con URL firmada en producción.
3. `POST .../confirmar` lee el objeto almacenado, valida tamaño y contenido real y recién ahí
   marca `PENDIENTE_REVISION`.

El motivo es el límite de 4,5 MB de las Vercel Functions: un PDF de 5 MB no puede atravesar la
Function. Con URL firmada, el archivo va del navegador al storage privado y la Function solo
firma y verifica.

**Desarrollo:** `AlmacenamientoLocal` escribe bajo `STORAGE_LOCAL_DIR`, montado en un volumen
dedicado de Docker (`comprobantes_data`). La carpeta no se sirve como estático: la única forma de
leer un archivo es el endpoint autenticado.

**Producción:** `AlmacenamientoSupabase` usa la API de Storage de Supabase con la service role
key: firma la subida (`/object/upload/sign/...`), firma la descarga temporal y borra el objeto si
la verificación falla. Si `STORAGE_BACKEND` no está configurado, o si en producción quedó en
`local`, la operación responde `503` con un mensaje claro: **no hay fallback insegura**.

Las claves de almacenamiento las genera el servidor (`alumno/{alumno_id}/{uuid}`); el nombre que
manda el usuario se guarda solo como etiqueta de descarga y nunca se usa como ruta.

## Decisión: permisos del adjunto

- El listado y la descarga del alumno salen de `usuario.alumno_id`, nunca de un id del cuerpo.
- Secretaría (rol `ADMIN`) puede listar los pendientes y descargar cualquier adjunto.
- Otro alumno recibe `404` (mismo que uno inexistente, para no filtrar ids) y sin sesión `401`.
- Docente recibe `403`.
- No hay URLs públicas permanentes: en local el archivo viaja por el endpoint autenticado; en
  producción el endpoint redirige a una URL firmada de vida corta.
- Ni el contenido ni las URLs firmadas se escriben en logs. La auditoría guarda ids, no binarios.

## Consecuencias

- La habilitación no cambia: no se crean cobranzas ni imputaciones, y `derivar_estado` no conoce
  esta tabla.
- Queda un archivo huérfano si el alumno sube y nunca confirma. Se documenta como límite conocido
  y el volumen se puede limpiar por antigüedad de `PENDIENTE_CARGA` cuando exista una tarea de
  mantenimiento.
- La futura aceptación en Secretaría reutiliza el modal de cobranzas: crea la cobranza acreditada
  con los datos del comprobante, imputa a la inscripción y marca el comprobante como aceptado en
  una migración aditiva.
