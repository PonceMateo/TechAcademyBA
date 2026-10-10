# Glosario

Traducción entre **la terminología del cliente** y **el modelo técnico**. El
cliente habla como habla: "padrón", "legajo", "nómina", "titular de pago". El
código usa esos mismos nombres, en español y sin tildes (ver D19 en
`docs/decisions.md`).

Este glosario traduce **hacia afuera**: sirve para que alguien de dentro del
equipo entienda al cliente, y para que un tercero lea el código sin inventar un
diccionario. No reemplaza al CSV de historias, que es la fuente de verdad del
modelo.

**Cómo leer la columna técnica:** los nombres entre acentos graves son tablas,
columnas o valores de enum reales del modelo. Donde no hay equivalencia
—porque el término del cliente no tiene tabla propia— dice por qué.

---

## Términos del cliente

| Término | Qué es, en una frase | Equivalente técnico |
|---|---|---|
| **Alumno** | Persona inscripta en una o más comisiones del instituto, con sus datos de contacto y su documento de identidad. | Entidad `alumno`. El documento puede ser nulo: el padrón admite alumnos del exterior con pasaporte y sin DNI. |
| **Comisión** | Instancia concreta y fecha de un curso, con su docente, sus días y horarios, su modalidad, su sede y su cupo. | Entidad `comision`, con `curso_id`, `docente_id`, `dias_horarios`, `modalidad`, `sede_id`, `cupo_maximo`, `arancel` y `estado`. |
| **Curso** | El contenido formativo, sin fecha ni docente: "Python Inicial". Es distinto de la comisión. | Entidad `curso`, con `codigo` y `nombre` más sus columnas normalizadas `codigo_norm` y `nombre_norm` para que `CUR-101` y `CUR101` colisionen (D6). |
| **Sede** | Lugar físico donde se dicta una comisión presencial o híbrida. | Entidad `sede`. Es **opcional en toda modalidad** y solo se acepta cuando la modalidad no es Virtual: el CHECK `modalidad_virtual_sin_sede` de `comision` la prohíbe en `VIRTUAL` (M35). |
| **Arancel** | Precio que paga un alumno por una comisión. | Columna `comision.arancel`, en pesos argentinos con precisión decimal, editable (historia #4). |
| **Padrón** | El registro único de personas del instituto, del que salen los alumnos. El mismo padrón tiene tres secciones: alumnos, docentes y usuarios. | `alumno`, `docente` y `usuario` son tablas separadas. `usuario` es la identidad única de acceso: tiene `rol`, `email` único y vínculos opcionales a `docente_id` y `alumno_id` (D4). |
| **Legajo** | El expediente de un alumno: su inscripción, su categoría arancelaria y su historial de pagos. | **No hay entidad `legajo`.** Es el conjunto `alumno` + `inscripcion` + `cobranza`. El "legajo correcto" del que habla el cliente es la `inscripcion` a la que se imputa un pago. |
| **Nómina** | La lista de personas que asistirá a un curso. **El término tiene dos sentidos distintos y no se deben mezclar:** (a) la nómina de alumnos de una comisión, que se ve en el shell del docente; (b) la nómina de empleados que una empresa inscribe en un contrato. | (a) **No hay entidad:** es la lista de `inscripcion` de la comisión, de solo lectura, y se deriva por consulta (D10). (b) Entidad `nomina_empleado`, anclada al **contrato** corporativo y no a la empresa, porque una misma empresa puede contratar varios cursos (D26). |
| **Comprobante** | El respaldo que el cliente manda por mensajería para probar un pago, con su fecha, importe, medio de pago y adjuntos. | Entidad `cobranza`, con `fecha`, `importe`, `medio`, `origen`, `estado` y `causa`. El estado es `ACREDITADO`, `OBSERVADO` o `RECHAZADO` (D12). Si no está acreditado, **la causa es obligatoria**: sin ella, un comprobante ilegible y una mora se ven igual. |
| **Titular de pago** | La persona o empresa que puso la plata, que puede no ser el alumno: un padre, un familiar, la cuenta bancaria de una empresa. | Entidad `pagador`, que vive **fuera** del padrón de alumnos a propósito (D7): es quien paga, no quién cursa. |
| **Categoría arancelaria** | La condición de pago que se le asigna a una inscripción: **particular**, **becado parcial**, **becado total** o **corporativo**. | Columna `inscripcion.categoria`, con `porcentaje_beca` obligatorio entre 1 y 99 cuando es becado parcial, y `empresa_id` obligatorio cuando es corporativo. |
| **Cupo máximo** | La cantidad de alumnos que entra en una comisión, limitada por la capacidad de la sala. | Columna `comision.cupo_maximo`, con CHECK de que sea mayor que cero. |
| **Vacantes** | Cuántos lugares quedan libres en una comisión. | **No se persiste** (D10): se deriva por consulta restando las inscripciones al cupo. El maquetado muestra el número como dato de ejemplo, no calculado. |
| **Habilitación** | Si el alumno puede entrar a la clase: **habilitado** o **bloqueado**, siempre con la causa a la vista. | **No se persiste** (D9): se deriva de la situación arancelaria. Lo único que se guarda es `override_habilitacion`, el forzado manual con su motivo obligatorio. El maquetado muestra la causa siempre, incluso cuando el estado es bloqueado. |
| **Factura A** | La factura que se le emite a una **empresa** por una compra, con sus datos fiscales. | Entidad `factura` con `tipo = 'A'`, y `empresa.requiere_factura_a` marca si la empresa la necesita. La factura **B**, del alumno particular, también se registra: es el caso más común del instituto. |
| **CUIT** | Clave Única de Identificación Tributaria: el número con el que Hacienda identifica a una persona o empresa en Argentina. | Se guarda en `empresa.cuit_norm`, en `pagador.documento_norm` y, para el docente, en `docente.cuil` (único pero **opcional**, D33). Se almacena normalizado, solo con dígitos: el mismo CUIT escrito con y sin guiones es el mismo. |

---

## Los cinco estados que el Excel usa y el modelo no

El Excel del cliente tiene la columna `Estado_Pago` como **texto libre**.
Ninguno de sus valores es un estado del dominio, y copiarlo sería construir el
mismo problema con más filas (D23). La lectura correcta es la siguiente, y es
parte del trabajo de carga posterior a este change:

| Texto del cliente | Estado del modelo |
|---|---|
| `Pagado total transferencia`, `Abonó 100% transferencia`, `Becada 100%`, `Transferencia ok` | `ACREDITADO` |
| `Pendiente de acreditacion`, `En duda (debe la mitad)` | `OBSERVADO` |
| `Pagó 50% por beca`, `Cuota 1 de 3 abonada` | `ACREDITADO`, con el saldo pendiente derivado de la imputación |
| `Cheque a 30 días`, `Pagado por Paypal` | `ACREDITADO`, con el medio de pago correspondiente |
| `No pago` | Sin `cobranza`: no hay comprobante que imputar |

`Pagado 50% por beca` es el caso que mejor muestra por qué el estado no puede
guardarse: Camila Rodríguez es becada parcial al 50% y abona la mitad del
arancel, y aun así queda `ACREDITADO`. El estado solo es decidible con el
porcentaje de beca de la inscripción al lado.

## Un caso que resume el problema del cliente

Agustina Benítez es becada parcial al 50% y su celda de pago está vacía. El
Excel dice "NO - No pago", pero el motivo real es que mandó un comprobante
borroso que no se lee. **Con solo el estado guardado, "no pagó" y "no se pudo
leer el comprobante" son indistinguibles.** Por eso el modelo separa el estado
—derivado— de la causa —obligatoria cuando no está acreditado—.

En el maquetado ese caso se ve como `BLOQUEADO` con causa `comprobante
ilegible`, nunca como `BLOQUEADO` a secas.
