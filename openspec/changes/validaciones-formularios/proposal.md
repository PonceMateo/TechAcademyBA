# Proposal

## Why

Los formularios administrativos aceptan datos que la API rechaza después: el teléfono se escribe
libre, el DNI del docente no tiene la regla del alumno, el cupo de la comisión admite decimales y el
CUIL del docente no se puede cargar aunque la columna existe. El rechazo llega como un `422`
genérico, así que la secretaría no sabe qué campo corregir y termina con datos inconsistentes entre
lo que la pantalla muestra y lo que la base guarda.

Esta entrega centraliza la validación en el front, la revalida en la API y deja el CUIL del docente
disponible como dato opcional. El mapeo de los `422` a errores por campo queda para un change
aparte (`errores-422-por-campo`) para no mezclar el contrato de validación con el manejo de errores.

## What Changes

- **Teléfono:** los formularios de alta y edición de docente y de alumno usan
  `react-phone-number-input` con `defaultCountry="AR"` y selector de todos los países. Se guarda
  E.164 o `null`, y la API rechaza con `422` lo que no tenga esa forma. **BREAKING**: el contrato de
  la API deja de aceptar teléfonos de texto libre. Los datos legacy parseables se normalizan al
  editar; los no parseables se conservan tal cual, sin aviso, y se reingresan.
- **Email del docente:** se extrae `emailConForma` de la pantalla de alumnos a un módulo compartido y
  se usa en docentes y alumnos. El backend ya comparte `EmailConForma`.
- **Cupo de comisión:** el alta exige un entero positivo y muestra «El cupo debe ser un entero
  positivo» para `1.1`, `5.3`, negativos o vacío. La edición ya lo valida. La API mantiene el `422`.
- **DNI del docente:** misma regla que el alumno —7 u 8 dígitos, con puntos, espacios o guiones— y un
  validador compartido en el front. En el backend se crea `DniConForma` y lo usan ambos padrones.
- **CUIL del docente:** la columna ya existe, es nullable y única, así que **no hay migración**. Pasa
  a ser opcional en el contrato y en el formulario. El formulario lo arma con un select de prefijo
  `20/23/24/27`, el DNI de solo lectura y un verificador manual de un dígito; un CUIL parcial se
  rechaza. La API valida 11 dígitos, prefijo permitido y que los 8 dígitos del medio coincidan con el
  DNI; no valida el dígito verificador. Se guarda en 11 dígitos y la tabla lo muestra con guiones.
  En `PUT`, omitir `cuil` conserva el actual y `null` lo borra. Al editar se recomponen los 8 dígitos
  con el DNI actual; cambiar el DNI o el prefijo limpia el verificador. El seed de Rita se corrige a
  un CUIL que coincida con su DNI.
- **Fuera de alcance:** `StudentProfilePage`, el CUIT de la empresa, el nombre de curso con solo
  espacios, el modal de inscripción y las validaciones de `PaymentsPage`. El mapeo de `422` no se
  toca en este change.

## Capabilities

### New Capabilities

- `validacion-formularios`: reglas compartidas de validación de los formularios administrativos y su
  revalidación en la API —teléfono E.164, email, DNI, cupo entero y CUIL opcional—.

### Modified Capabilities

- `altas-catalogo`: el alta de docente deja de prohibir el CUIL y lo acepta opcional con la regla de
  estructura y DNI coincidente, y la pantalla de alta de docente incorpora el control de teléfono y
  los controles del CUIL.
- `edicion-docentes`: la edición de docente deja de prohibir el CUIL y lo acepta opcional, conserva el
  actual cuando se omite y lo borra con `null`.

## Impact

- **Frontend:** `TeachersPage.jsx`, `StudentsPage.jsx`, `CoursesPage.jsx`, un módulo compartido de
  validación, un componente de teléfono y `package.json` (`react-phone-number-input`).
- **Backend:** `schemas/padron.py`, `schemas/alumnos.py`, `schemas/validators.py`,
  `schemas/catalogo.py`, `services/padron.py` y `services/seed.py`. Sin migración ni cambio de modelo.
- **API:** `POST/PUT /docentes` (CUIL, DNI y teléfono), `POST/PUT /alumnos` (teléfono) y
  `POST/PUT /comisiones` (cupo entero). El CUIL deja de ser un campo prohibido.
- **Dependencias:** `react-phone-number-input`.
- **Documentación:** `docs/decisions.md` registra la decisión de teléfono E.164, validadores
  compartidos, CUIL manual/opcional y corrección del seed.
- **Tests:** Vitest en los formularios afectados y pytest en los schemas y servicios del backend.
