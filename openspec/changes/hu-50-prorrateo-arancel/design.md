# Design

## Context

La inscripción actual guarda categoría, porcentaje y empresa, pero no conserva ningún importe.
La comisión ya expone `fecha_inicio`, `fecha_fin`, `arancel` y `cantidad_clases` derivada de sus
horarios. La creación se concentra en `backend/app/services/inscripciones.py` y el contrato HTTP
en `backend/app/schemas/inscripciones.py`.

## Goals / Non-Goals

**Goals:**

- Persistir un `importe_arancel` por inscripción para que el valor histórico no cambie al editar la
  comisión.
- Calcular con Decimal el importe base proporcional a las clases restantes y redondear a dos
  decimales.
- Aplicar el descuento de beca parcial después del prorrateo.
- Devolver el importe en los contratos y consultas de inscripción.

**Non-Goals:**

- Recalcular importes existentes al cambiar período, horarios o arancel de una comisión.
- Definir cuotas, vencimientos o imputaciones de cobranzas.
- Prorratear contratos corporativos, que siguen la lógica contractual de empresa.

## Decisions

- **Fecha de alta:** se usará la fecha de creación de la inscripción en la zona horaria del dominio,
  no una fecha enviada por el cliente, para evitar que un usuario altere el importe.
- **Clases restantes:** se cuentan desde la fecha de alta inclusive hasta `fecha_fin`, filtrando los
  días de cursada y reutilizando `clases_del_periodo` para mantener una única regla de calendario.
- **Fórmula:** `arancel * clases_restantes / cantidad_clases`; para beca parcial se multiplica luego
  por `(100 - porcentaje_beca) / 100`.
- **Redondeo:** `ROUND_HALF_UP` a dos decimales, igual que la precisión monetaria de PostgreSQL.
- **Sin cálculo:** una comisión sin ambas fechas, sin horarios válidos o ya terminada sin clases
  restantes devuelve un error de dominio explícito; no se guarda una inscripción con importe
  inventado.
- **Persistencia:** se agrega una columna monetaria nullable durante la migración expand; las
  inscripciones heredadas pueden quedar sin importe hasta que el producto defina una regularización.

## Risks / Trade-offs

- [Risk] El cálculo depende de la fecha de ejecución y de la zona horaria → Mitigation: usar la
  zona horaria del dominio y probar bordes de inicio, fin y cambio de día.
- [Risk] Los registros históricos existentes no tienen importe → Mitigation: no alterar históricos
  automáticamente; exponer null y documentar el estado pendiente.
- [Risk] Redondeos pueden dejar diferencias de centavos → Mitigation: centralizar Decimal y
  `ROUND_HALF_UP`, y probar importes con división no exacta.

## Migration Plan

1. Agregar `inscripcion.importe_arancel` como columna nullable de precisión monetaria.
2. Desplegar el servicio que calcula el valor para nuevas inscripciones.
3. Mantener lectura compatible con inscripciones anteriores sin importe.
4. No recalcular ni modificar importes históricos durante este change.
