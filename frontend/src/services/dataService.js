import { getDataSource } from './dataSourceFactory'

/**
 * La frontera de datos del frontend (D13).
 *
 * **Este es el único módulo del que una pantalla saca datos.** Cada función es asíncrona y
 * devuelve la forma que va a devolver la API, así que una pantalla escrita contra esto sirve igual
 * con datos de ejemplo y con datos reales. Los componentes no importan `src/mocks/` ni conocen si
 * la respuesta vino de la memoria o de una red.
 *
 * **Por qué funciones y no un objeto con estado:** cada pantalla pide lo que necesita y lo dibuja.
 * Un store global obligaría a las pantallas a conocer el ciclo de vida de los datos de otras, que
 * es exactamente el acoplamiento que la frontera viene a evitar.
 *
 * Los nombres siguen el idioma del dominio, que es español sin tildes (D19): `listarComisiones`,
 * no `getCourses`.
 */
export function listarComisiones() {
  return getDataSource().listarComisiones()
}

/**
 * Alta de curso. **El contrato no lleva código**: lo genera el sistema (D32) y la respuesta lo
 * trae para que la pantalla muestre lo que el operador va a ver después.
 */
export function crearCurso(datos) {
  return getDataSource().crearCurso(datos)
}

/**
 * Edición de un curso (historia #3). Conserva el `id` y el código generado; la respuesta trae
 * el curso actualizado y la pantalla reemplaza la fila que ya mostraba.
 */
export function editarCurso(id, datos) {
  return getDataSource().editarCurso(id, datos)
}

/** Alta de comisión. La respuesta trae el código derivado `{codigo del curso}-{numero}` (D34). */
export function crearComision(datos) {
  return getDataSource().crearComision(datos)
}

/**
 * Catálogo de cursos, para el selector del alta de comisión.
 *
 * **No se puede armar con `listarComisiones()`:** el selector se llenaba con
 * `comisiones.map((c) => c.curso)`, que solo ofrece cursos que **ya tienen** una comisión. Un
 * curso recién creado no podría abrir su primera comisión, que es justo el flujo que este change
 * habilita (D36).
 */
export function listarCursos() {
  return getDataSource().listarCursos()
}

/**
 * Totales del catálogo que el chip y el tablero muestran. Van por el servicio y no como
 * constantes de cada pantalla para que los dos números no puedan contradecirse.
 */
export function obtenerResumenCatalogo() {
  return getDataSource().obtenerResumenCatalogo()
}

export function listarDocentes() {
  return getDataSource().listarDocentes()
}

export function buscarDocentes(texto) {
  return getDataSource().buscarDocentes(texto)
}

/**
 * Alta de docente. **El contrato no lleva CUIL** (D33) y la promesa **nunca cae al ejemplo**: un
 * alta que no llega a la base tiene que fallar y decirlo (D36).
 */
export function crearDocente(datos) {
  return getDataSource().crearDocente(datos)
}

export function listarAlumnos() {
  return getDataSource().listarAlumnos()
}

export function crearInscripcion(datos) {
  return getDataSource().crearInscripcion(datos)
}

export function buscarAlumnos(texto) {
  return getDataSource().buscarAlumnos(texto)
}

/**
 * Alta de alumno (historia #13). **El contrato no lleva `tipo_documento`**: esta entrega registra
 * solo DNI (D44). La promesa **nunca cae al ejemplo**: un alta que no llega a la base tiene que
 * fallar y decirlo, porque la pantalla no puede confirmar un alumno que no existe.
 */
export function crearAlumno(datos) {
  return getDataSource().crearAlumno(datos)
}

/**
 * Edición de los datos personales del alumno (historia #17). Conserva el `id` y el legajo;
 * la respuesta trae la fila actualizada y la pantalla la fusiona con la que ya mostraba.
 */
export function editarAlumno(id, datos) {
  return getDataSource().editarAlumno(id, datos)
}

/**
 * Restablecimiento administrativo de la contraseña (historia #17). La nueva contraseña no se
 * devuelve en claro y la cuenta queda obligada a cambiarla en el próximo ingreso.
 */
export function restablecerPasswordAlumno(id, newPassword) {
  return getDataSource().restablecerPasswordAlumno(id, newPassword)
}

/** Baja lógica del alumno (historia #17): conserva inscripciones, pagos e historial. */
export function eliminarAlumno(id) {
  return getDataSource().eliminarAlumno(id)
}

/**
 * Consulta si un alta choca con un alumno dado de baja y se puede reactivar (historia #17).
 * Devuelve el registro inactivo o `null`; no modifica nada.
 */
export function buscarAlumnoReactivable(datos) {
  return getDataSource().buscarAlumnoReactivable(datos)
}

/**
 * Reactiva el mismo registro en lugar de crear un duplicado (historia #17). Devuelve el alumno
 * activo y una nueva contraseña inicial, que la pantalla muestra una sola vez.
 */
export function reactivarAlumno(id, datos) {
  return getDataSource().reactivarAlumno(id, datos)
}

export function listarEmpresas() {
  return getDataSource().listarEmpresas()
}

/**
 * Alta de cuenta corporativa (18). El contrato lleva razón social, CUIT y si requiere
 * Factura A; la nómina de empleados es la historia #19 y no forma parte del alta.
 */
export function crearEmpresa(datos) {
  return getDataSource().crearEmpresa(datos)
}

export function listarSedes() {
  return getDataSource().listarSedes()
}

export function listarCobranzas() {
  return getDataSource().listarCobranzas()
}

export function buscarHabilitacion(consulta) {
  return getDataSource().buscarHabilitacion(consulta)
}

export function registrarCobranza(datos) {
  return getDataSource().registrarCobranza(datos)
}

export function forzarBloqueoManual(datos) {
  return getDataSource().forzarBloqueoManual(datos)
}

export function listarEmailsHabilitados(comisionCodigo) {
  return getDataSource().listarEmailsHabilitados(comisionCodigo)
}

/**
 * Comisiones asignadas al docente que entra, con los contadores de acceso de cada una (10.2).
 * Los contadores salen del mismo padrón que la fila muestra, para que el indicador y la celda no
 * puedan contradecirse.
 */
export function obtenerComisionesAsignadas() {
  return getDataSource().obtenerComisionesAsignadas()
}

/** Padrón de solo lectura de una comisión (10.3). */
export function obtenerPadronComision(comisionCodigo) {
  return getDataSource().obtenerPadronComision(comisionCodigo)
}

/** Asistencia de la clase del día de una comisión (10.4). */
export function obtenerAsistenciaComision(comisionCodigo) {
  return getDataSource().obtenerAsistenciaComision(comisionCodigo)
}

/** Ficha del docente con sus comisiones (10.5). */
export function obtenerPerfilDocente() {
  return getDataSource().obtenerPerfilDocente()
}

/**
 * Link de clase de una comisión. Lo leen los dos shells: el docente para ver si lo cargó y el
 * alumno para entrar a la clase.
 */
export function obtenerLinkClase(comisionCodigo) {
  return getDataSource().obtenerLinkClase(comisionCodigo)
}

/** Carga del link de clase (10.3). Devuelve `{ ok, error }` en vez de lanzar. */
export function guardarLinkClase(datos) {
  return getDataSource().guardarLinkClase(datos)
}

/**
 * Inscripciones del alumno con su acceso (11.2). Siempre un arreglo: la lista vacía es el caso que
 * la pantalla tiene que saber pintar, con un mensaje y no con un hueco.
 */
export function listarInscripcionesAlumno() {
  return getDataSource().listarInscripcionesAlumno()
}

/** Detalle de una inscripción del alumno (11.3), o `null` si no está inscripto en esa comisión. */
export function obtenerDetalleInscripcion(comisionCodigo) {
  return getDataSource().obtenerDetalleInscripcion(comisionCodigo)
}

/** Comprobantes imputados al alumno (11.4). No incluye pagos de empresas ni cheques sin imputar. */
export function listarPagosAlumno() {
  return getDataSource().listarPagosAlumno()
}

/** Ficha del alumno del ejemplo (11.5). */
export function obtenerPerfilAlumno() {
  return getDataSource().obtenerPerfilAlumno()
}
