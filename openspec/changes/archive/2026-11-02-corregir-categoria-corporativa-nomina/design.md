# Design

## Context

La categoría `CORPORATIVO` ya está definida en el modelo de inscripciones y la base
exige `empresa_id` para esa categoría. Sin embargo, la carga de nómina actual restringe
el backend a categorías `BECADO_*` y el formulario inicializa cada fila como becado total.
La motivación está documentada en `proposal.md`.

## Goals / Non-Goals

**Goals:**

- Hacer que la carga masiva use una única regla corporativa coherente en frontend, API y
  persistencia.
- Rechazar solicitudes que intenten usar categorías o porcentajes de beca en este endpoint.
- Conservar la transacción, reutilización de alumnos y asociación con contrato existentes.

**Non-Goals:**

- Cambiar la definición general de categorías arancelarias.
- Modificar el flujo de inscripción individual, cobranzas o habilitación.
- Crear una migración: el esquema actual ya soporta la categoría requerida.

## Decisions

- **Categoría fija en la operación corporativa:** el servicio asignará `CORPORATIVO`
  server-side en lugar de confiar en un valor enviado por cada fila. Así se evita que el
  cliente clasifique accidentalmente a un empleado como becado.
- **Contrato de entrada sin campos de beca:** el esquema de nómina dejará de exponer
  `categoria` y `porcentaje_beca`. Una solicitud con esos campos debe rechazarse por la
  configuración de campos extra del contrato, manteniendo el endpoint específico y claro.
- **Formulario sin selector arancelario:** la interfaz mostrará los datos identificatorios
  y de contacto, y comunicará que la empresa cubre la inscripción. No se reutiliza el
  selector de becas del alta individual.
- **Validación de consistencia:** las pruebas verificarán categoría, empresa y porcentaje
  nulo, además del rechazo de payloads con datos de beca. No se alterará el cálculo de
  habilitación para `CORPORATIVO`.

## Risks / Trade-offs

- [Risk] Los payloads del frontend actual contienen categorías de beca y dejarán de ser
  compatibles → Mitigation: actualizar simultáneamente las fuentes de datos, el modal y
  las pruebas; el endpoint devolverá 422 para clientes antiguos.
- [Risk] Puede haber datos ya cargados como becados por la implementación actual →
  Mitigation: no modificar históricos automáticamente; agregar una corrección explícita o
  migración de datos solo si el usuario la solicita tras identificar registros afectados.

## Migration Plan

No se requiere migración estructural. Se desplegará primero el cambio de contrato y servicio
junto con el frontend actualizado; las cargas nuevas quedarán corporativas. Los registros
anteriores no se transformarán automáticamente.
