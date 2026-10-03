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

export function listarDocentes() {
  return getDataSource().listarDocentes()
}

export function buscarDocentes(texto) {
  return getDataSource().buscarDocentes(texto)
}

export function listarAlumnos() {
  return getDataSource().listarAlumnos()
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
