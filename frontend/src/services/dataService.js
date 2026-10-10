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

export function buscarAlumnos(texto) {
  return getDataSource().buscarAlumnos(texto)
}

export function listarEmpresas() {
  return getDataSource().listarEmpresas()
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
