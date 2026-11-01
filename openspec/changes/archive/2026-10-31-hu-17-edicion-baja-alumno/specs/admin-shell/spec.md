# Spec Delta

## ADDED Requirements

### Requirement: Acciones de edición, contraseña y baja en el padrón de alumnos

La pantalla `Alumnos e Inscripciones` SHALL ofrecer por cada fila las acciones **Editar**,
**Restablecer contraseña** y **Eliminar alumno**, reutilizando los componentes `Button`, `Modal`
e `Input` existentes y sin cambiar colores, tipografías ni navegación. Las operaciones SHALL pasar
por `src/services/` y SHALL actualizar los datos visibles al terminar.

#### Scenario: Editar desde la fila
- **WHEN** el administrador elige **Editar**
- **THEN** se abre un modal con DNI, nombre, email y teléfono precargados y, al guardar, la fila muestra los datos actualizados

#### Scenario: Rechazo de un dato duplicado
- **WHEN** la edición se rechaza por DNI o email repetido
- **THEN** el modal queda abierto con lo cargado y muestra el motivo informado por la fuente

#### Scenario: Restablecer la contraseña
- **WHEN** el administrador elige **Restablecer contraseña** y confirma una nueva contraseña válida
- **THEN** el modal se cierra y la pantalla informa que la contraseña fue restablecida, sin mostrarla en claro

#### Scenario: Confirmar la baja
- **WHEN** el administrador elige **Eliminar alumno**
- **THEN** se abre un modal de confirmación con el nombre del alumno y las opciones de cancelar o confirmar

#### Scenario: Cancelar la baja
- **WHEN** el administrador cancela la confirmación
- **THEN** el alumno sigue visible y no se modifica ningún registro

#### Scenario: Baja confirmada
- **WHEN** el administrador confirma la baja
- **THEN** la fila desaparece del listado y la pantalla muestra un mensaje de confirmación

#### Scenario: Aviso de reactivación al intentar un alta duplicada
- **WHEN** el alta de un alumno choca con un DNI o email de un alumno dado de baja
- **THEN** la pantalla muestra un modal que indica que el alumno fue dado de baja antes y ofrece **Reactivar alumno**

#### Scenario: Reactivación confirmada desde el modal
- **WHEN** el administrador confirma **Reactivar alumno**
- **THEN** el alumno vuelve al listado de activos y la pantalla muestra las nuevas credenciales iniciales

#### Scenario: Reactivación cancelada desde el modal
- **WHEN** el administrador cancela el aviso de reactivación
- **THEN** no se modifica ningún dato y el formulario de alta conserva lo cargado
