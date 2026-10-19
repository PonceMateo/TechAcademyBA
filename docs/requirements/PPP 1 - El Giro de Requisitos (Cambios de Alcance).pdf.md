## **Introducción y Dinámica de Trabajo**

En el marco de la simulación laboral interactiva de PPP 1, la sesión async del jueves
15/10 constituye el hito denominado "El Giro de Requisitos". El cuerpo docente
asumirá el rol activo de cliente/stakeholder para introducir modificaciones sustanciales
en las reglas de negocio, condicionantes operativos e imprevistos de dominio para
cada uno de los 8 proyectos bajo desarrollo.
Los equipos de trabajo deberán evaluar de inmediato el impacto de estos
requerimientos sobre sus diagramas de dominio, modelos entidad-relación, reglas de
validación y arquitectura propuesta. Estas modificaciones constituirán la base técnica
para la negociación del MVP que se defenderá presencialmente durante las semanas
11 y 12.

| Caso   | Dominio / Proyecto                     | Foco del Nuevo Requerimiento                                            |
| ------ | -------------------------------------- | ----------------------------------------------------------------------- |
| Caso 1 | Gastrorrepuestos Once                  | Descuentos por volumen y cotización de divisa propia                   |
| Caso 2 | Fletes y Mudanzas Express              | Restricciones de tránsito y penalización por cancelación             |
| Caso 3 | Gestión Veterinaria y Guardería      | Descuento multimascota y reserva de cupo de emergencia                  |
| Caso 4 | Equipamiento Audiovisual               | Alquiler por combo/kit y bloqueo por dependencia en cadena              |
| Caso 5 | Tostaduría y Stock de Café           | Abonos recurrentes y cálculo dinámico de merma por perfil             |
| Caso 6 | Gestión de Alumnos y Clases           | Prorrateo por alta tardía y vencimiento de acceso semanal              |
| Caso 7 | Normalización de Envíos (MandáTodo) | Enrutamiento multi-parada y recargo por re-intento de entrega           |
| Caso 8 | Bot IA y Panel de Supervisión         | Escalado por análisis de sentimiento y mitigación de prompt injection |

## Detalle de Requerimientos por Caso (Borré el resto)

### Caso 6: Sistema de Gestión de Alumnos, Pagos y Habilitación de Clases

- **Nuevas Reglas de Negocio:** Prorrateo arancelario por incorporación extemporánea **Especificación:**
- Para inscripciones realizadas cuando la comisión ya ha iniciado sus actividades (semanas 2 o 3), el sistema debe calcular el arancel mediante un prorrateo proporcional exacto a las clases restantes del periodo.
