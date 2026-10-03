# Tasks

Cada tarea dice cómo se verifica. Cada grupo deja sus propios tests y su propia documentación: nada de acumular testing o docs en un grupo final. Ninguna tarea implementa funcionalidad de una HU: el objetivo es el scaffold, el login real y el maquetado navegable.

Al terminar cada grupo se sube un commit convencional en la rama del change. El PR usa `Refs #N` y nunca `Closes #N`.

## 1. Convenciones del equipo y hygiene del repositorio

- [x] 1.1 Crear `.gitignore` con artefactos de Python, de Node, entornos virtuales, `.env` real, `__pycache__`, `.pytest_cache` y salidas de build; verificar que `.env.example` **no** está ignorado con `git check-ignore .env.example` devolviendo "no coincide".
- [x] 1.2 Crear `.editorconfig` con UTF-8, salto de línea LF, indentación de 4 espacios para Python y 2 para JavaScript, y recorte de espacios finales; verificar abriendo un archivo Python y uno JavaScript con el editor configurado.
- [x] 1.3 Crear `AGENTS.md` con el flujo de trabajo del equipo: criterio para cambio directo sin OpenSpec (bugfix que restaura comportamiento, typos, estilos, refactor interno sin cambio de comportamiento, tests de código existente, config y dependencias) y criterio para propuesta (HU nueva o modificada, regla de negocio, cambio de modelo de datos o de contrato de API, cambio de seguridad o permisos), la instrucción de consultar en una línea ante la duda en vez de arrancar una propuesta completa, las ramas `feat/hu-<n>-<slug>` / `fix/<slug>` / `chore/<slug>`, el formato de commit convencional, la regla de `Refs #N` frente a `Closes #N`, y la regla de registrar decisiones no funcionales. Verificar que el contenido del equipo queda **fuera** de cualquier bloque gestionado por OpenSpec, y que si aparece un bloque con marcadores queda intacto.
- [x] 1.4 Crear `.github/pull_request_template.md` que pida qué cambió, por qué, issue o change relacionado (o "ninguno, cambio menor") y cómo se probó; verificar abriendo un pull request de prueba y comprobando que las cuatro secciones aparecen. _(archivo creado; la verificación pide abrir un PR de prueba y no hay remoto)_
- [x] 1.5 Crear `docs/decisions.md` con la entrada inicial fechada y con autor, usando las decisiones D1 a D21 de `design.md`; verificar que tiene fecha y autor en cada entrada.
- [x] 1.6 Crear `docs/glossary.md` con los términos del cliente (comisión, arancel, padrón, legajo, nómina, comprobante, titular de pago, categoría arancelaria, cupo, vacantes, habilitación, factura A, CUIT) y su equivalencia técnica cuando exista; verificar que cada entrada define el término en una frase.
- [x] 1.7 Crear `opencode.json` con el servidor MCP remoto de Context7 en formato `{"mcp": {"context7": {"type": "remote", "url": "https://mcp.context7.com/mcp"}}}`, más el encabezado de API key por variable de entorno si se define; verificar con `opencode mcp list` que el servidor aparece y que responde.

## 2. Entorno de contenedores

- [x] 2.1 Crear `backend/Dockerfile` sobre Python 3.12 con las dependencias de aplicación y de desarrollo; verificar que `docker compose build backend` completa y que `python --version` dentro del contenedor devuelve 3.12.
- [x] 2.2 Crear `frontend/Dockerfile` con Node para el modo desarrollo; verificar que `docker compose build frontend` completa.
- [x] 2.3 Crear `docker-compose.yml` con los servicios `db` (PostgreSQL 16, volumen nombrado, healthcheck), `backend` (recarga automática montando el código, depende de `db` en condiciones de salud) y `frontend` (Vite con recarga automática y proxy de `/api` hacia `backend`); verificar con `docker compose config` que los tres servicios resuelven.
- [x] 2.4 Crear `.env.example` con todas las variables que consume el backend (conexión a base de datos, secreto de firma del token, orígenes permitidos, configuración de correo) y con la del frontend, sin ningún valor secreto; verificar que las lee la aplicación al arrancar y que ningún archivo `.env` real queda versionado.
- [x] 2.5 Verificar el arranque conjunto con `docker compose up -d` y que los tres servicios quedan en estado saludable; verificar que un `docker compose down -v` seguido de `up -d` vuelve a levantar limpio con el volumen descartado.

## 3. Base del backend: estructura, configuración y salud

- [x] 3.1 Crear la estructura por capas `app/core`, `app/models`, `app/schemas`, `app/api`, `app/services` y el paquete `app/tests`; verificar con un test que los cinco paquetes importan sin errores circulares.
- [x] 3.2 Declarar las dependencias fijadas (FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, pydantic-settings, psycopg 3, PyJWT, bcrypt, pytest, httpx, ruff) y configurar `ruff` y `pytest`; verificar que `ruff check` y `pytest` ejecutan sin errores de configuración y que ninguna prueba usa `unittest`.
- [x] 3.3 Configurar la aplicación con `pydantic-settings` leyendo del entorno, incluida la zona horaria `America/Argentina/Buenos_Aires`; verificar con un test que cambia una variable de entorno y lee el valor nuevo, y que la zona horaria por defecto es la esperada.
- [x] 3.4 Implementar `GET /health` sin autenticación; verificar con un test que responde con éxito sin token y que la respuesta no expone datos sensibles.

## 4. Modelos de dominio y migración inicial

- [x] 4.1 Implementar los modelos SQLAlchemy del catálogo (`curso`, `comision`, `sede`) con las columnas normalizadas y los CHECKs de `cupo_maximo`, `arancel` y modalidad-sede; verificar con un test que se rechaza un cupo cero, un arancel menor o igual a cero y una modalidad presencial sin sede.
- [x] 4.2 Implementar los modelos del padrón (`docente`, `alumno`, `usuario`) con la unicidad de email en los tres y de documento por padrón, y el CHECK de correspondencia entre rol y vínculo; verificar con un test que una cuenta docente sin docente es rechazada y que un email repetido entre docente y alumno es rechazado.
- [x] 4.3 Implementar los modelos de inscripción, empresa, contrato corporativo y nómina con la unicidad de alumno y comisión, el rango de porcentaje de beca, la empresa obligatoria para corporativo y la regla de que la charla no genera nómina; verificar con un test cada CHECK.
- [x] 4.4 Implementar los modelos de pagador, cobranza, imputación y factura, con `imputacion` de destino único y sin columna de estado de habilitación en `inscripcion`; verificar con un test que una imputación sin destino o con dos destinos es rechazada y que el modelo de inscripción no expone estado de habilitación.
- [x] 4.5 Implementar los modelos de clase, asistencia, override de habilitación y auditoría, más `created_at` y `updated_at` en todas las entidades y la baja lógica donde corresponde; verificar con un test que un motivo vacío en el override es rechazado.
- [x] 4.6 Configurar Alembic y generar la migración inicial; revisar a mano y **agregar a mano** los CHECKs y los índices únicos sobre columnas normalizadas, porque el autogenerado no los emite; verificar que `alembic upgrade head` sobre una base PostgreSQL vacía completa sin error.
- [x] 4.7 Verificar que la migración inicial **no** crea ninguna tabla de cuotas ni de esquema de cobro; verificar listando las tablas resultantes y comprobando que el nombre de ninguna corresponde a ese esquema.
- [x] 4.8 Escribir las pruebas de migración que aplican la migración inicial contra PostgreSQL real y que confirman que no hay rutas de Testing en el código; verificar que la suite pasa contra PostgreSQL y que no existe dependencia de SQLite.

## 5. Autenticación, roles y autorización

- [x] 5.1 Implementar el hash y la verificación de contraseñas con bcrypt y la emisión y validación del token; verificar con un test que un hash nunca almacena la contraseña en claro.
- [x] 5.2 Implementar `POST /auth/login` con respuesta genérica ante credenciales inválidas y validación de cuerpo; verificar con tests el login exitoso, la contraseña incorrecta, el email inexistente y el cuerpo incompleto.
- [x] 5.3 Implementar `GET /auth/me` devolviendo identidad, rol, nombre para mostrar y `must_change_password`; verificar con tests el token válido y el token ausente, inválido o expirado.
- [x] 5.4 Implementar la dependencia de autorización por rol reutilizable y aplicarla a un endpoint de prueba por cada rol; verificar con tests que `ADMIN` accede a la ruta de administración, que `DOCENTE` recibe 403, que `ALUMNO` recibe 403 y que sin token se responde 401 sin revelar la existencia del recurso.
- [x] 5.5 Verificar que el mensaje de credenciales inválidas es idéntico para email inexistente y para contraseña incorrecta; verificar con un test que compara ambas respuestas.

## 6. Interfaz de correo y carga de datos inicial

- [x] 6.1 Implementar la interfaz de envío de correo y la implementación de desarrollo que solo registra en el log, devolviendo resultado con éxito o fallo sin lanzar excepción; verificar con un test que no se.contacta ningún proveedor externo y que un fallo se reporta sin revertir la operación que la originó.
- [x] 6.2 Implementar el comando de carga inicial idempotente con las tres cuentas de demostración (administración, docente, alumno), con contraseña documentada y sin cambio de contraseña pendiente, con upsert por clave natural; verificar con un test que se puede ejecutar dos veces seguidas sin duplicar registros ni fallar.
- [x] 6.3 Documentar en el README los comandos de migraciones y de carga inicial, y las credenciales de demostración; verificar que los comandos escritos en el README se ejecutan tal como están escritos.

## 7. Base del frontend: ruteo, sesión y acceso por rol

- [x] 7.1 Crear la aplicación Vite con React en JavaScript, Tailwind, ESLint, Prettier, Vitest y React Testing Library; verificar que `npm run lint`, `npm run test` y `npm run build` ejecutan sin errores sobre el proyecto vacío.
- [x] 7.2 Implementar el cliente de autenticación contra el backend real y el contexto de sesión; verificar con un test que el login guarda la sesión y que un fallo de credenciales no la guarda.
- [x] 7.3 Implementar la redirección por rol al entrar y al cerrar sesión; verificar con un test que `ADMIN` aterriza en el tablero, `DOCENTE` en su shell y `ALUMNO` en el suyo.
- [x] 7.4 Implementar las rutas protegidas por rol y las páginas de error 403 y 404; verificar con un test que un usuario autenticado que no pertenece al rol recibe 403, que una ruta inexistente recibe 404 y que sin sesión se redirige al login.
- [x] 7.5 Implementar la pantalla de login con el patrón único del prototipo (campos de email y contraseña, botón de ingreso y aviso informativo); verificar con un test que renderiza y que no hay selector de rol.

## 8. Capa de datos del frontend y componentes reutilizables

- [x] 8.1 Crear `src/mocks/` con datos de ejemplo para las tres secciones: comisiones deduplicadas por código normalizado, docentes con DNI, CUIL, email y teléfono, alumnos con sus categorías arancelarias, empresas, cobranzas con su estado mapeado al enum del dominio y su causa cuando no están acreditadas; verificar con un test que el placeholder de datos está marcado como tal y que ninguna fila repite un curso duplicado.
- [x] 8.2 Implementar `src/services/` con funciones asíncronas y una fábrica que resuelve la implementación mock o real según variable de entorno; verificar con un test que un componente obtiene sus datos por el servicio y que cambiar la implementación no obliga a tocar el componente.
- [x] 8.3 Implementar los componentes reutilizables `Button`, `Badge`, `Table`, `Modal`, `Input`, `Card` y `StatusIndicator`; verificar con un test que la insignia distingue habilitado de bloqueado y admite mostrar la causa.
- [x] 8.4 Verificar que ningún componente importa datos desde `src/mocks/` directamente; verificar con una búsqueda en el código que las únicas importaciones de mocks están dentro de la capa de servicios.

## 9. Shell de Administración

- [x] 9.1 Implementar el layout con panel lateral `MENÚ OPERATIVO`, barra superior con `Sede Central` y `Período Lectivo 2026`, y pie con `Secretaria BA`; verificar con un test que el panel lateral renderiza los ítems en el orden definido.
- [x] 9.2 Maquetar el tablero con los cuatro indicadores, las tres alertas de gestión pendiente y los tres accesos rápidos del personal, todo estático y sin lógica; verificar con un test que renderiza los valores del prototipo y que los accesos rápidos no navegan a ninguna pantalla.
- [x] 9.3 Maquetar la pantalla de cursos y comisiones con su tabla y el modal de nueva comisión, agregando `Modalidad` y `Sede` con sede obligatoria solo para presencial e híbrida; verificar con un test que guardar una modalidad presencial sin sede muestra el error.
- [x] 9.4 Maquetar la pantalla de docentes con listado, buscador y alta, y el ítem deshabilitado `Próximamente` para el control de clases dictadas; verificar con un test que el ítem deshabilitado no es navegable.
- [x] 9.5 Maquetar la pantalla de alumnos e inscripciones con las dos tablas, las cuatro categorías arancelarias con su color y el indicador de acceso con su causa; verificar con un test que una fila bloqueada muestra la causa y que la categoría de beca parcial muestra el porcentaje.
- [x] 9.6 Maquetar la pantalla de cobranzas con el formulario de registro, la separación visible entre titular y alumno imputado, el historial con los tres estados de gestión y la columna de factura, más el ítem deshabilitado de acreditación automática; verificar con un test que titular y alumno imputado son campos distintos.
- [x] 9.7 Maquetar la pantalla de habilitación de accesos con buscador, ficha resumen, estado con causa, motivo obligatorio en el forzado y el ítem deshabilitado de emisión de certificados; verificar con un test que forzar con motivo vacío no deja confirmar.
- [x] 9.8 Verificar con un test que los tres shells comparten los mismos componentes de interfaz y que ninguna pantalla de administración importa datos de ejemplo directamente.

## 10. Shell de Docente

- [x] 10.1 Implementar el layout `ESPACIO DOCENTE` con su chip de rol, su período lectivo, su pie y su color de acento; verificar con un test que el layout se distingue del de administración.
- [x] 10.2 Maquetar la pantalla de comisiones asignadas con los tres indicadores y los contadores de acceso en singular y plural, con la columna renombrada; verificar con un test que `1 bloqueado` y `4 bloqueados` se renderizan según la cantidad.
- [x] 10.3 Maquetar el detalle de comisión con la nómina de solo lectura, el estado con su causa, el campo de link de clase editable y su validación de URL; verificar con un test que un valor que no es URL es rechazado y que la fila de un alumno bloqueado no ofrece forma de obtener el link.
- [x] 10.4 Maquetar la pantalla de asistencia con las columnas por clase, la columna editable del día y los totales; verificar con un test que la columna del día es la única editable.
- [x] 10.5 Maquetar el perfil de docente en solo lectura y agregar el ítem deshabilitado de notas y certificación, que absorbe también el seguimiento de clases dictadas; verificar con un test que el ítem está deshabilitado y que no hay pantalla de notas detrás.

## 11. Shell de Alumno

- [x] 11.1 Implementar el layout `ESPACIO ALUMNO` con su chip de rol, su período lectivo, su pie y su color de acento; verificar con un test que el layout se distingue de los otros dos.
- [x] 11.2 Maquetar la pantalla de cursos con las tarjetas de comisión y el estado con su causa y su ruta a pagos cuando está bloqueado, más el estado vacío sin inscripciones; verificar con un test que una tarjeta bloqueada muestra la causa y el enlace a pagos.
- [x] 11.3 Maquetar el detalle de curso con la información de la comisión, el bloque de acceso y los próximos encuentros, cubriendo los tres estados de la historia de acceso al link; verificar con un test que sin link cargado no se muestra el botón de ingreso.
- [x] 11.4 Maquetar la pantalla de pagos con el historial, la indicación de pago de terceros, el formulario de carga de comprobante y el estado vacío; verificar con un test que el estado vacío se muestra cuando no hay pagos.
- [x] 11.5 Maquetar el perfil de alumno con documento y nombre deshabilitados y email y teléfono editables, y agregar los ítems deshabilitados de certificados y de pago de cuota; verificar con un test que documento y nombre no admiten edición.

## 12. Integración continua y verificación final

- [x] 12.1 Crear `.github/workflows/ci.yml` con jobs de backend (PostgreSQL como servicio, `ruff`, `pytest`) y de frontend (lint, `vitest`, build), disparado en push y en pull request; verificar que el workflow aparece en la pestaña Actions del repositorio. _(workflow creado y validado localmente; no se pudo confirmar en la pestaña Actions porque el repositorio no tiene remoto)_
- [x] 12.2 Verificar localmente la secuencia completa: migraciones, carga inicial, suite de pruebas del backend, lint y pruebas del frontend, y construcción de producción; verificar que los cinco comandos terminan en éxito desde el repositorio limpio.
- [x] 12.3 Completar el README con setup, comandos, estructura y la sección de herramientas opcionales que recomienda GitHub CLI con `gh auth login` y `gh auth refresh -s project`, aclarando que no es obligatorio para desarrollar; verificar que un compañero nuevo puede levantar el proyecto siguiendo solo el README, midiendo el tiempo y anotándolo en el README.
- [x] 12.4 Recorrer la Definition of Done completa: entrar como cada una de las tres cuentas de demostración, navegar todas las secciones de su menú sin errores, comprobar que un rol no alcanza las rutas de otro, y comprobar que los ítems Won't están deshabilitados con la etiqueta `Próximamente`; verificar con una grabación de pantalla o una lista de verificación firmada en el PR. _(recorrido verificado contra el backend real y la lista escrita en `docs/verificacion-definition-of-done.md`; la firma en el PR y la grabación de pantalla quedaron pendientes)_
- [ ] 12.5 Abrir el pull request con la plantilla y confirmar que usa `Refs` para las historias maquetadas y ningún `Closes`; verificar leyendo el cuerpo del pull request en GitHub.

## Notas de ejecución

- El orden importa: el grupo 4 define el modelo del que dependen el 5 y el 6, y el grupo 8 define la frontera que usan los grupos 9, 10 y 11.
- Las tareas 4.1 a 4.5 se pueden hacer en paralelo entre sí porque tocan archivos distintos; 4.6 espera a que estén todas.
- Si al aplicar aparece una decisión que `design.md` dejó pendiente, no se resuelve improvisando: se registra en `docs/decisions.md` y se anota acá.
- Ninguna tarea de este listado cierra una historia de usuario del backlog.
