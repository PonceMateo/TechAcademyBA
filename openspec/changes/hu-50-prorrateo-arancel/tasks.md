# Tasks

## 1. Modelo y migración

- [x] 1.1 Agregar `importe_arancel` a `Inscripcion`, con precisión monetaria y compatibilidad con registros heredados; verificar el modelo y la migración expand/contract.
- [x] 1.2 Documentar la decisión de persistir el importe histórico y actualizar el glosario si corresponde; verificar que la documentación coincida con el contrato.

## 2. Cálculo de prorrateo

- [x] 2.1 Implementar un helper de dominio que calcule clases restantes desde la fecha de alta y reutilice el calendario de la comisión; verificar bordes de inicio, fin y comisión terminada.
- [x] 2.2 Integrar el cálculo en la creación de inscripciones, aplicando el descuento después del prorrateo y excluyendo corporativos; verificar redondeo a centavos.
- [x] 2.3 Rechazar altas sin período válido o sin clases restantes cuando no sea posible calcular el importe; verificar que no quede una inscripción parcial.

## 3. Contratos y consultas

- [x] 3.1 Exponer `importe_arancel` en las respuestas de inscripción y en las consultas que devuelven inscripciones; verificar compatibilidad con registros históricos nulos.
- [x] 3.2 Mostrar el importe calculado en la ficha administrativa del alumno, sin permitir editarlo manualmente; verificar que la ficha distinga el arancel actual del importe histórico.

## 4. Pruebas y documentación

- [x] 4.1 Agregar pruebas backend para inscripción antes del inicio, alta tardía, beca parcial, corporativo, redondeo, comisión sin período y atomicidad.
- [x] 4.2 Ejecutar tests frontend focalizados, pytest del backend y validación estricta de OpenSpec; corregir cualquier regresión.
