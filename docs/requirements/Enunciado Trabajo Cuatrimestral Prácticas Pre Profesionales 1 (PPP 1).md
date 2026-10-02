# Trabajo Práctico

### Universidad Nacional de Lanús Licenciatura en Sistemas

Materia: Prácticas Pre Profesionales 1 (PPP 1)

#### Año: 2026

Índice

Guía del Trabajo Práctico Integrador Cuatrimestral	2
1. Dinámica de Simulación Laboral y Roles	2
2. Conformación de Equipos y Metodología de Trabajo	2
3. Puntos de Partida y Desafío de Datos	2
4. Cronograma de Hitos y Entregas	3
5. Criterio de Aprobación de la Materia	3

## Guía del Trabajo Práctico Integrador Cuatrimestral

El objetivo central de **Prácticas Pre Profesionales 1** es enfrentar a los futuros profesionales con la dinámica real de desarrollo de software en entornos productivos. A lo largo del cuatrimestre, cada equipo llevará adelante el relevamiento, modelado, saneamiento de datos y desarrollo de una solución de software orientada a resolver una problemática de negocio concreta.

### 1. Dinámica de Simulación Laboral y Roles

Para garantizar una experiencia inmersiva, el equipo docente no actuará como evaluador tradicional de código en el día a día, sino que adoptará el rol de **Clientes de Negocio**:

- **Equipo Docente / Clientes:** Gustavo Siciliano (Titular de Cátedra), Marcelo Wolf (Ayudante) y Santiago Cofman (Ayudante).
- **Canales de Interacción:** Las necesidades del negocio, requerimientos adicionales y dudas de alcance se canalizarán a través de correos electrónicos y sesiones periódicas de entrevistas (presenciales o sincrónicas en clase).
- **Dialecto de Negocio:** El cliente planteará sus necesidades sin recurrir a tecnicismos de programación ni arquitectura de software. Será responsabilidad del equipo traducir estas inquietudes operativas a requerimientos técnicos, diagramas de base de datos e historias de usuario.
### 2. Conformación de Equipos y Metodología de Trabajo

- **Tamaño de Grupo:** Equipos de **4 integrantes**, conformados de manera aleatoria al inicio del curso para fomentar la adaptabilidad y el trabajo colaborativo multidisciplinario.
- **Autonomía Tecnológica:** Cada equipo tiene la libertad de elegir el stack tecnológico (lenguajes, frameworks, librerías y bases de datos) que considere más adecuado para resolver el problema, justificando su viabilidad técnica.
- **Control de Versiones y Trazabilidad:** El desarrollo debe gestionarse mediante un repositorio en Git (GitHub/GitLab) utilizando flujo de ramas (*feature branching*) y *pull* *requests*. La participación individual equitativa se auditará a través del historial de commits de cada miembro.
### 3. Puntos de Partida y Desafío de Datos

Al inicio del proyecto, el cliente pondrá a disposición:

1. Una **Carta de Necesidades de Negocio** donde describe la operatoria de su empresa y sus principales dolores de cabeza diarios.
2. Un **registro de datos históricos en planilla de cálculo (Excel)** con información real del negocio. Este archivo reflejará inconsistencias típicas del mundo real (formatos mixtos, duplicidades, texto libre en campos numéricos y datos no estructurados) que el equipo deberá sanear e importar a su propio modelo de datos relacional.

### 4. Cronograma de Hitos y Entregas

El avance del cuatrimestre se estructura en tres etapas incrementales:

- **Hito 0 — Propuesta Técnica y Arquitectura (Fecha:- No evaluable /** **Bloqueante):**
- Presentación del stack tecnológico seleccionado.
- Modelo de Entidad-Relación propuesto tras el análisis y normalización de la planilla histórica.
- Wireframes básicos de la interfaz de usuario y alcance funcional preliminar.
- **Hito 1 / Parcial 1 — MVP Operativo Inicial (Fecha:- Evaluable):**
- Proceso de migración y limpieza de los datos históricos ejecutado con éxito.
- Gestión básica (CRUD) de las entidades principales (catálogo, clientes/proveedores).
- Flujo operativo inicial funcional (registro de una transacción o servicio con validaciones básicas).
- **Hito 2 / Parcial 2 — MVP Completo y Cierre (Fecha:- Evaluable):**
- Implementación completa de las reglas de negocio complejas (control de cupos/stock, anti-solapamiento y cuentas corrientes).
- Módulo de reportería y métricas de gestión para la toma de decisiones del cliente.
- Control de acceso y perfiles de usuario según roles de la empresa.
### 5. Criterio de Aprobación de la Materia

Para aprobar la cursada de PPP 1 es **requisito obligatorio** que la plataforma cuente con el conjunto de *features* mínimas de negocio (MVP) funcionando de extremo a extremo y respondiendo a los requerimientos acordados con los clientes (Gustavo, Marcelo y Santiago) durante las entrevistas de seguimiento.

Una solución que no cumpla con las necesidades operativas mínimas acordadas o que no logre procesar consistentemente los datos históricos no será considerada aprobada, independientemente de la complejidad técnica del código.

Nombres de proyectos:

- Caso 1: "Gastrorrepuestos Once"
- Caso 2: Fletes mudanzas express
- Caso 3: Sistema Integral de Gestión Veterinaria y Guardería Canina
- Caso 4: Sistema de Alquiler y Control de Equipamiento Audiovisual
- Caso 5: Sistema de Gestión de Tostaduría, Stock de Café y Pedidos
- Caso 6: Sistema de Gestión de Alumnos, Pagos y Habilitación de Clases
- Caso 7: Sistema de Normalización y Geolocalización de Direcciones de Envío
- Caso 8: Sistema de Atención al Cliente con Bot IA y Panel de Supervisión para Agencia de Seguros