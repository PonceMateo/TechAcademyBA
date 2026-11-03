# Tasks

## 1. Contrato y servicio de nómina

- [x] 1.1 Actualizar `NominaCreate` y `EmpleadoNominaIn` para que la carga corporativa no acepte categoría ni porcentaje de beca, y verificar con pruebas de validación que los campos extra respondan 422.
- [x] 1.2 Cambiar el servicio de nómina para crear cada inscripción con categoría `CORPORATIVO`, `empresa_id` asociado y porcentaje nulo, y verificar con pruebas de integración que la transacción persista esos valores.
- [x] 1.3 Agregar pruebas backend para rechazar payloads con categorías o porcentajes de beca y conservar las pruebas de cupo, reutilización y atomicidad.

## 2. Formulario administrativo

- [x] 2.1 Quitar del modal los controles de categoría y porcentaje de beca, mostrar que la carga corresponde a una inscripción corporativa y verificar el flujo con pruebas de componentes.
- [x] 2.2 Ajustar la transformación del payload y las fuentes mock/API para enviar únicamente los datos admitidos por la carga corporativa, y verificar que no se envíen campos de beca.
- [x] 2.3 Actualizar las validaciones y textos visibles del modal, incluyendo pruebas de DNI, email, duplicados y guardado exitoso sin datos de beca.

## 3. Verificación e integración

- [x] 3.1 Ejecutar los tests frontend focalizados y ESLint, y verificar que el modal permita cargar una nómina corporativa completa.
- [ ] 3.2 Ejecutar `docker compose exec backend pytest -q app/tests/test_nomina_api.py` y verificar que las nuevas inscripciones no queden marcadas como becadas.
- [x] 3.3 Ejecutar la validación estricta del change con `openspec validate "corregir-categoria-corporativa-nomina" --type change --strict` y corregir cualquier inconsistencia de los artefactos.
