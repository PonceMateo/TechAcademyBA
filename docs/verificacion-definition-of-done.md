# Lista de verificación de la Definition of Done

Corresponde a la tarea **12.4** del change `bootstrap-initial-scaffold`: recorrer la
Definition of Done completa —entrar con las tres cuentas de demostración, navegar todas las
secciones del menú de cada rol, comprobar que un rol no alcanza las rutas de otro y que los
ítems Won't están deshabilitados con `Próximamente`— y dejar el registro.

- **Rama:** `feat/bootstrap-initial-scaffold`
- **Fecha:** 2026-10-03
- **Alcance:** work unit 10, grupo 12 (12.1 a 12.4)
- **Entorno:** Windows, Docker 29.6.2, Compose v5.3.1, los tres servicios del
  `docker-compose.yml` levantados y con la base migrada y sembrada

> **Por qué está en un archivo y no firmada en el pull request.** La tarea pide una grabación de
> pantalla **o** una lista de verificación firmada en el PR. El repositorio tiene remoto y la
> rama está pusheada, pero **el pull request todavía no existe**: la tarea 12.5 es la que lo abre y
> no forma parte de este work unit. Queda pendiente firmarla cuando exista el PR (P10 en
> [`docs/decisions.md`](decisions.md)).

## Cómo se verificó cada punto

| Punto | Cómo | Resultado |
|---|---|---|
| Las tres cuentas entran | `POST /auth/login` y `GET /auth/me` contra el backend real del entorno | Las tres devuelven token y sesión |
| Un rol no alcanza las rutas de otro | Matriz de 4 rutas de sondeo × 3 cuentas contra el backend real | 403 en las nueve celdas ajenas, 200 en las tres propias |
| Los ítems Won't están deshabilitados | Suite del frontend: se renderiza el menú de los tres shells | `Próximamente` y sin enlace |
| Todas las secciones se recorren sin errores | Suite del frontend: se renderiza **cada** ruta del menú de cada rol | Las 13 rutas del menú y las 2 de detalle, sin errores |
| Total de la suite | `pytest` y `vitest run` | 272 pruebas del backend y 296 del frontend |

## 1. Entrar con cada una de las tres cuentas

Contra el backend real (`http://127.0.0.1:8000`), no contra un doble de prueba:

| Cuenta | `POST /auth/login` | `GET /auth/me` |
|---|---|---|
| `admin@techacademy.invalid` | 200, `access_token` | `Secretaria BA`, `rol: ADMIN` |
| `rita.molina@techacademy.invalid` | 200, `access_token` | `Rita Molina`, `rol: DOCENTE` |
| `agustina.benitez@techacademy.invalid` | 200, `access_token` | `Agustina Benítez`, `rol: ALUMNO` |

Las tres vuelven con `must_change_password: false`, que es lo que D18 fija a propósito para el
entorno de demostración.

Un correo inexistente y una contraseña incorrecta devuelven **la misma** respuesta: `401` con
el cuerpo `{"detail":"Credenciales inválidas."}`. Sin token, las cuatro rutas de sondeo
devuelven `401`. Una ruta que no existe devuelve `404`.

## 2. Recorrer todas las secciones del menú de cada rol

Cada sección del menú se renderizó con una sesión del rol correspondiente y se comprobó que
dibuja. La lista de rutas sale de los propios módulos de navegación —`SECCIONES_ADMIN`,
`SECCIONES_DOCENTE`, `SECCIONES_ALUMNO`—, o sea que si mañana aparece una sección, la prueba
la recorre sin que nadie la agregue a mano.

| Rol | Sección | Ruta | Cómo se verificó |
|---|---|---|---|
| Administración | Dashboard | `/admin` | `AdminLayout.test.jsx` y `shellConsistency.test.jsx` |
| Administración | Cursos y Comisiones | `/admin/cursos` | `CoursesPage.test.jsx` (14 pruebas) |
| Administración | Docentes | `/admin/docentes` | `TeachersPage.test.jsx` (11 pruebas) |
| Administración | Alumnos e Inscripciones | `/admin/alumnos` | `StudentsPage.test.jsx` (14 pruebas) |
| Administración | Cobranzas e Ingresos | `/admin/cobranzas` | `PaymentsPage.test.jsx` (16 pruebas) |
| Administración | Habilitación de Accesos | `/admin/habilitacion` | `AccessPage.test.jsx` (12 pruebas) |
| Docente | Mis Comisiones | `/docente` | `TeacherCommissionsPage.test.jsx` (9 pruebas) |
| Docente | Mis Alumnos | `/docente/alumnos` | `shellConsistency.test.jsx` |
| Docente | Detalle de comisión | `/docente/alumnos/:codigo` | `CommissionDetailPage.test.jsx` (15 pruebas) |
| Docente | Asistencia | `/docente/asistencia` | `AttendancePage.test.jsx` (10 pruebas) |
| Docente | Mi Perfil | `/docente/perfil` | `TeacherProfilePage.test.jsx` (9 pruebas) |
| Alumno | Mis Cursos | `/alumno` | `StudentCoursesPage.test.jsx` (7 pruebas) |
| Alumno | Detalle de curso | `/alumno/cursos/:codigo` | `CourseDetailPage.test.jsx` (10 pruebas) |
| Alumno | Mis Pagos | `/alumno/pagos` | `StudentPaymentsPage.test.jsx` (10 pruebas) |
| Alumno | Mi Perfil | `/alumno/perfil` | `StudentProfilePage.test.jsx` (8 pruebas) |

Son quince pantallas: seis de Administración, cinco de Docente y cuatro de Alumno. Los tres
shells dibujan el armazón compartido `ShellFrame` y las pantallas salen del mismo `data-ui`
que los componentes compartidos, que es lo que afirma `shellConsistency.test.jsx`.

## 3. Un rol no alcanza las rutas de otro

Dos verificaciones independientes. La primera es de verdad, contra el backend del entorno.

| Token | `/auth/probe/admin` | `/auth/probe/docente` | `/auth/probe/alumno` | `/auth/probe/personal` |
|---|---|---|---|---|
| `ADMIN` | **200** | 403 | 403 | 200 |
| `DOCENTE` | 403 | **200** | 403 | 200 |
| `ALUMNO` | 403 | 403 | **200** | 403 |

La segunda es del lado de la interfaz, y mira las cuatro combinaciones que importan: un
`DOCENTE` en `/admin` y en `/alumno`, y un `ALUMNO` en `/admin` y en `/docente`
(`RequireRole.test.jsx` y `shellConsistency.test.jsx`). En los cuatro casos se muestra la
pantalla de 403 y **no se dibuja ni un pedazo de la sección ajena**.

Ojo con lo que esto no es: ocultar una pantalla no es protegerla. La comprobación que manda
es la del backend, que resuelve la cuenta contra la base en cada request (M7). La interfaz
solo refleja lo que el backend ya decidió.

## 4. Los ítems Won't están deshabilitados con `Próximamente`

| Rol | Ítem | Cómo se verificó |
|---|---|---|
| Docente | Notas y Certificación | `TeacherProfilePage.test.jsx`: es un ítem deshabilitado del menú, con `Próximamente` y **sin enlace** |
| Alumno | Pagar la cuota | `StudentLayout.test.jsx`: los dos deshabilitados, con `Próximamente` y sin enlace |
| Alumno | Certificados | `StudentLayout.test.jsx` y `StudentProfilePage.test.jsx` |
| Administración | Alta de docente sin formulario detrás | `TeachersPage.test.jsx`: la acción está, el formulario no, y `Clases dictadas` sale deshabilitado con `Próximamente` |
| Administración | Controls sin implementar de cobranza y de habilitación | `PaymentsPage.test.jsx` y `AccessPage.test.jsx` |

Un ítem deshabilitado **no es un enlace sin destino**: el armazón lo dibuja como texto con la
insignia `Próximamente` y sin atributo `href`, así que no hay forma de pulsarlo y no hay
pantalla detrás a la que llegar (D20). Los ítems Won't se muestran y no se esconden: el
cliente tiene que ver el hueco para decidir entre los dos caminos de MVP.

## Lo que NO se verificó

Esto queda dicho con nombre y apellido, porque una lista de verificación que presume es peor
que no tener lista.

| No verificado | Por qué |
|---|---|
| El recorrido visual a ojo, con el navegador abierto | En el entorno donde se hizo este work unit no había navegador automatizable. La evidencia automatizada es el render de arriba, que no es una mirada: es una aserción que falla. **Después, el equipo lo recorre a mano en el navegador y reporta que funciona** (ver más abajo). |
| El ingreso tipeando el formulario del login en el navegador | El login se verificó contra el backend real con las tres cuentas, no desde el formulario. `LoginPage.test.jsx` cubre el render del formulario. |
| El pull request de la tarea 12.5 | El remoto existe y la rama está pusheada, pero el PR no está abierto: lo abre el equipo. |

## Verificación posterior, del equipo

El 2026-10-03, con los tres servicios levantados, el equipo levantó la interfaz, entró con las
tres cuentas de demostración y recorrió las secciones de cada rol. **Reportó que todo funciona.**

Esto suma lo que ninguna aserción automatizada puede sumar: que las pantallas se ven bien y que
el ingreso desde el formulario funciona de verdad. Queda como testimonio del equipo, no como
verificación reproducible.

La integración continua, en cambio, sí quedó verificada por máquina: el `push` de `d86fa37`
disparó el workflow y la corrida terminó en `success`, con los jobs `backend` y `frontend` en
verde.

## Firmas

| Quién | Qué firma | Fecha |
|---|---|---|
| | Recorrido completo de la Definition of Done en el PR | |
| | Revisión de la lista | |

Las firmas se completan cuando exista el pull request de 12.5.