# Design

## Context

Ver `proposal.md` para la motivación. El estado actual que condiciona el enfoque:

- Los formularios de docente y de alumno usan el `Input` de texto común para el teléfono; no hay
  control de país ni normalización. `emailConForma` vive dentro de `StudentsPage.jsx` y el DNI del
  docente solo se valida como no vacío.
- `DocenteCreate`/`DocenteUpdate` son `extra="forbid"` y no declaran `cuil`; la columna
  `docente.cuil` ya existe, es nullable y tiene `uq_docente_cuil` (D33). No hace falta migración.
- `DocenteUpdate` hereda de `DocenteCreate`; el servicio de edición pisa todos los campos. Para
  distinguir “no vino” de “vino en null” hay que mirar `model_fields_set`.
- El seed de Rita guarda `cuil="27345678907"` con `dni="30111222"`. El valor no coincide con el DNI
  y el upsert actual no actualiza el CUIL de una fila existente, solo lo setea al crearla.
- `apiDataSource.leerDetalle` solo entiende `detail` como string; el mapeo de los `422` de Pydantic
  a errores por campo queda para `errores-422-por-campo` y no se toca acá.

## Goals / Non-Goals

**Goals:**

- Una sola regla de email y de DNI para docentes y alumnos, compartida en el front y en el backend.
- Teléfono E.164 en la API y un control de país en los cuatro formularios.
- CUIL opcional con la composición prefijo + DNI + verificador manual y sin validación de módulo 11.
- Cupo entero positivo en el alta de comisión.
- Sin migración de base ni cambio de modelo.

**Non-Goals:**

- Mapear los `422` a errores por campo; `StudentProfilePage`; CUIT de empresa; nombre de curso;
  modal de inscripción; validaciones de `PaymentsPage`.
- Validar que un teléfono E.164 sea una línea real o que el CUIL tenga un dígito verificador
  correcto.

## Decisions

### 1. Módulo compartido de validación en el front

Se crea `frontend/src/domain/validacion.js` con las reglas puras: `emailConForma`, `dniConForma`
(7 u 8 dígitos con `.`, espacio o `-`), `dniDigitos` (solo dígitos), `componerCuil` y `partirCuil`.
Reutiliza `normalizeDocumento` de `frontend/src/domain/normalize.js` para los dígitos.

`StudentsPage.jsx` deja de tener su copia local de `emailConForma` y su regex de DNI;
`TeachersPage.jsx` importa las mismas funciones. La alternativa era duplicar las reglas en cada
pantalla, que es justo el problema que el cambio evita.

### 2. Componente de teléfono

Se agrega `react-phone-number-input` a `frontend/package.json` y se crea
`frontend/src/components/ui/CampoTelefono.jsx`, que envuelve el `PhoneInput` con el estilo y el
mensaje de error del `Input`/`Campo` existente. Usa `defaultCountry="AR"`, muestra el selector de
todos los países y entrega E.164 o `undefined`; el formulario traduce `undefined` a `null`.

El componente distingue dos modos:

- **Internacional:** el valor actual es E.164 o está vacío; se usa `PhoneInput` y se valida con
  `isValidPhoneNumber`.
- **Legacy:** el valor guardado no es E.164. Se muestra un input de texto con el valor crudo, sin
  advertencia, y una acción secundaria para pasar al control internacional. Guardar sin reingresar
  el teléfono deja el error de validación; el valor no se pierde de la vista.

La alternativa de pasar el string crudo a `PhoneInput` no sirve: el componente espera E.164 y trata
lo que no parsea como “sin valor”, así que el dato legacy desaparecería de la pantalla.

### 3. Validadores compartidos del backend

En `backend/app/schemas/validators.py`:

- `DniConForma`: `AfterValidator` que acepta solo dígitos, puntos, espacios y guiones, y exige 7 u 8
  dígitos. Reemplaza el validador local de `alumnos.py` y se usa también en `DocenteCreate.dni`.
- `TelefonoE164`: `AfterValidator` con la forma `+`, primer dígito distinto de cero y 7 a 15 dígitos
  en total. Se usa en `DocenteCreate.telefono` y `AlumnoCreate.telefono` (y sus `Update`).
- `validar_cuil(cuil, dni)`: normaliza a dígitos, exige 11, prefijo `20/23/24/27` y que los 8 del
  medio sean el DNI con `zfill(8)`. No calcula el dígito verificador y devuelve los 11 dígitos.

`DocenteCreate` declara `cuil: str | None = None` después de `dni` y lo valida con un
`field_validator` que lee `info.data["dni"]`. `DocenteUpdate` lo hereda. La alternativa de validar el
CUIL solo contra el DNI en el servicio dejaría el `422` fuera del contrato de entrada; el formulario
y la API deben rechazar lo mismo.

El regex de teléfono no agrega `phonenumbers` al backend: el front ya valida con la librería y la API
solo garantiza la forma de transporte. Si más adelante hace falta validar líneas reales, se agrega
`phonenumbers` en un change aparte.

### 4. CUIL opcional y semántica del `PUT`

- `DocenteCreate.cuil` es opcional; el alta guarda `datos.cuil` (11 dígitos o `None`).
- `DocenteUpdate` hereda el campo. El servicio de edición solo toca `docente.cuil` cuando
  `"cuil" in datos.model_fields_set`; así omitirlo conserva el actual y `null` lo borra.
- `DocenteOut.cuil` ya existe. La tabla formatea con `formatearCuil` (11 dígitos → `XX-XXXXXXXX-X`)
  y deja el valor crudo si no tiene 11 dígitos.
- No se valida el dígito verificador en ningún lado. El caso borde 10 no se produce porque no hay
  cálculo; el verificador se guarda como lo escribió el usuario.

### 5. Controles del CUIL en el formulario

`TeachersPage` guarda `cuilPrefijo` y `cuilVerificador` separados del `dni`. El CUIL compuesto se
deriva en el render y se envía como 11 dígitos o `null`:

- El select de prefijo arranca vacío (`''`) y ofrece `20`, `23`, `24`, `27`.
- La parte del DNI es de solo lectura y muestra `dniDigitos(dni).padStart(8, '0')`.
- El verificador es un `Input` de un dígito, editable, con `maxLength={1}` y solo dígitos.
- Si hay prefijo o verificador pero falta el otro, la validación marca CUIL incompleto y no envía.
- Cambiar el DNI o el prefijo limpia el verificador.
- Al abrir la edición, se parte el CUIL guardado en prefijo y verificador; los 8 del medio se
  arman siempre con el DNI actual. Si el CUIL guardado no coincidía, al guardar se corrige.
- Sin CUIL guardado, los dos controles arrancan vacíos.

La alternativa de un solo input de CUIL se descartó: el pedido pide el prefijo como select, el DNI
ligado y el verificador manual.

### 6. Email, DNI y cupo

- `StudentsPage` y `TeachersPage` usan `emailConForma` y `dniConForma` del módulo compartido. El
  backend ya comparte `EmailConForma`; se agrega `DniConForma` y se retira el validador local de
  alumnos.
- `CoursesPage.validar()` agrega `!Number.isInteger(Number(campos.cupo))` a la condición existente.
  El mensaje «El cupo debe ser un entero positivo» ya está. La edición ya valida el entero y no se
  toca. La API ya recibe `cupo_maximo: int`, así que un decimal sigue dando `422`.

### 7. Seed

- El dato de Rita pasa a un CUIL que coincide con su DNI, por ejemplo `27301112225`
  (`27-30111222-5`). Se guarda sin guiones para que `DocenteOut` devuelva 11 dígitos.
- `_upsert_docente` debe asignar `docente.cuil = datos.get("cuil")` también en la rama de fila
  existente. Sin eso, volver a correr el seed no corrige una base que ya tiene el CUIL viejo.
- El teléfono del seed se deja como `+54 11 4000-0001` a propósito: es el caso legacy parseable que
  ejercita la normalización al editar. No se migra.

## Risks / Trade-offs

- **El contrato de teléfono es breaking para clientes que mandan texto libre.** → Se despliega el
  front y el back juntos; el front valida antes de enviar y el mensaje de la API queda para el
  camino directo.
- **El regex E.164 acepta formas que no son líneas reales.** → Es solo la forma de transporte; el
  front usa `isValidPhoneNumber`. Si se necesita validación real, se agrega `phonenumbers` después.
- **El componente de teléfono con un valor legacy no puede usar `PhoneInput` directo.** → Se usa el
  modo legacy con input de texto y acción para pasar al control internacional; el valor no se
  pierde y no hay aviso al cargar.
- **`react-phone-number-input` en jsdom puede necesitar setup de CSS o de `matchMedia`.** → Se
  agrega el import de estilos en el componente y, si el test falla, un mock en `frontend/src/test/`.
- **Un CUIL guardado que no coincide con el DNI se recompone al editar y cambia en silencio.** → Es
  la decisión acordada; el seed se corrige y antes de desplegar se auditan las filas con CUIL no
  nulo. Si hay datos reales inconsistentes, se listan y se corrigen a mano.
- **Sin validación de módulo 11 se pueden guardar verificadores incorrectos.** → Es una decisión
  explícita del alcance; queda documentada en `docs/decisions.md` y en el spec.
- **El seed no actualiza el CUIL de una fila existente.** → Se corrige el upsert en la misma tarea
  que el dato; se verifica corriendo el seed dos veces.

## Migration Plan

1. No hay migración de esquema. La columna `cuil` y su índice ya existen.
2. Desplegar backend y frontend juntos por el cambio breaking del teléfono. El backend acepta
   `cuil` en `POST/PUT /docentes` y rechaza teléfonos que no sean E.164.
3. Corregir el seed y su upsert; ejecutar el seed en el entorno de demo y verificar que Rita queda
   con `27301112225` y que una segunda corrida no cambia nada.
4. Antes del despliegue, consultar las filas de `docente` con `cuil` no nulo y comparar los 8
   dígitos del medio con `dni_norm`. Las que no coincidan se corrigen o se limpian a mano.
5. Rollback: revertir el deploy de front y back. No hay cambios de esquema que deshacer. El seed
   corregido es idempotente; si se revierte, el CUIL de Rita puede quedar con el valor anterior.

## Open Questions

- Versión exacta de `react-phone-number-input` compatible con React 19: se resuelve al instalar y se
  fija en `package.json` y el lockfile. No cambia el enfoque ni las tareas.
