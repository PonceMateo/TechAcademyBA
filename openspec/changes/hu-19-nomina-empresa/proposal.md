# Proposal

## Why

La HU 19 necesita convertir la nómina de empleados de una empresa en alumnos e
inscripciones reales de una comisión de curso formal. El modelo ya tiene las tablas
`contrato_corporativo` y `nomina_empleado`, pero no existe una operación de aplicación
que las use ni una pantalla para cargar la nómina.

## What Changes

- Agregar `POST /empresas/{empresa_id}/nomina` para cargar empleados de un curso formal.
- Reutilizar alumnos por documento normalizado y crear los que no estén en el padrón.
- Crear el contrato formal, la nómina y las inscripciones de forma atómica.
- Rechazar nóminas que superen las vacantes o contengan datos inválidos.
- Agregar en Administración una acción de carga de nómina por empresa y comisión.

## Non-goals

- No se implementa la búsqueda general de cuentas corporativas de la HU 20.
- No se implementan charlas ni contratos editables.
- No se envían correos ni se muestran contraseñas iniciales en la respuesta de la nómina.
