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
