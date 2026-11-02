# Proposal

## Why

La carga de empleados de una empresa está clasificando actualmente a todas las personas
como becadas, aunque la inscripción ya contempla la categoría arancelaria `CORPORATIVO`.
Esto distorsiona la habilitación, la facturación y el seguimiento de pagos de las
inscripciones empresariales.

## What Changes

- Corregir la carga de nómina de curso formal para crear inscripciones con categoría
  `CORPORATIVO` y vínculo obligatorio con la empresa.
- Eliminar de la carga de nómina la selección de categorías y porcentajes de beca.
- Mantener las categorías de beca únicamente para inscripciones que realmente sean becadas.
- Actualizar validaciones, contrato de API, fuentes de datos, interfaz y pruebas.
- Alinear la especificación de nómina corporativa con la regla de categoría arancelaria
  corporativa.

## Capabilities

### New Capabilities

- `cuentas-corporativas`: agregar el requisito observable de carga de nómina con categoría
  corporativa.

### Modified Capabilities

- `domain-schema`: las inscripciones creadas por una nómina de curso formal deben usar la
  categoría `CORPORATIVO`, no `BECADO_PARCIAL` ni `BECADO_TOTAL`.

## Impact

- `backend/app/services/nomina.py` y sus esquemas y pruebas.
- `frontend/src/admin/StudentsPage.jsx`, fuentes de datos y pruebas del modal.
- Especificaciones OpenSpec de dominio y cuentas corporativas.
- No requiere una nueva tabla ni una migración: la categoría `CORPORATIVO` y la relación
  `inscripcion.empresa_id` ya existen en el modelo.
