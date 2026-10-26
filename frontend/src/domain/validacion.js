import { normalizeDocumento } from './normalize'

/**
 * Reglas de validación compartidas por los formularios administrativos (D57).
 *
 * **Una sola regla para docentes y alumnos.** El email y el DNI se validaban con una copia por
 * pantalla, y dos copias de la misma regla terminan aceptando cosas distintas: acá viven una vez
 * y las dos pantallas importan de acá. La contracara en el backend es
 * `app/schemas/validators.py`, con las mismas reglas, porque un formulario que rechaza distinto
 * del servidor rechaza un alta que la base acepta, o al revés.
 *
 * Los identificadores y los nombres de las funciones van en español, como el resto de
 * `src/domain/`.
 */

/** Los prefijos de CUIL que corresponden a una persona física con DNI. */
export const PREFIJOS_CUIL = ['20', '23', '24', '27']

/**
 * La misma regla mínima de email que valida el backend: algo antes de la arroba y un dominio con
 * punto que no termina en punto. No se baja a RFC 5322 porque acepta direcciones que no existen
 * y rechaza direcciones que sí.
 */
export function emailConForma(valor) {
  const texto = String(valor ?? '').trim()
  const arroba = texto.indexOf('@')
  if (arroba === -1) {
    return false
  }
  const local = texto.slice(0, arroba)
  const dominio = texto.slice(arroba + 1)
  return local !== '' && dominio !== '' && dominio.includes('.') && !dominio.endsWith('.')
}

/** Solo los dígitos de un documento: `30.111.222` → `30111222`. */
export function dniDigitos(valor) {
  return normalizeDocumento(valor).replace(/\D/g, '')
}

/**
 * Un DNI de 7 u 8 dígitos, escrito con puntos, espacios o guiones o sin ellos.
 *
 * El rechazo de letras es explícito y no se deja a la API: el formulario tiene que avisar en el
 * campo antes de mandar la solicitud, no después de un `422`.
 */
export function dniConForma(valor) {
  const texto = String(valor ?? '').trim()
  if (!/^[0-9.\s-]+$/.test(texto)) {
    return false
  }
  return [7, 8].includes(dniDigitos(texto).length)
}

/**
 * Arma el CUIL de 11 dígitos con las tres piezas del formulario, o `null` si no está completo.
 *
 * El DNI se completa con ceros a la izquierda hasta 8 dígitos, igual que la comparación de la API.
 * **No se calcula el dígito verificador** (D57): viaja el que escribió la secretaría. Un CUIL
 * parcial —prefijo sin verificador, o verificador sin prefijo— devuelve `null`, y el formulario es
 * el que distingue "sin CUIL" de "CUIL incompleto".
 */
export function componerCuil(prefijo, dni, verificador) {
  if (!PREFIJOS_CUIL.includes(prefijo)) {
    return null
  }
  const digitos = dniDigitos(dni)
  if (![7, 8].includes(digitos.length)) {
    return null
  }
  if (!/^[0-9]$/.test(String(verificador ?? ''))) {
    return null
  }
  return `${prefijo}${digitos.padStart(8, '0')}${verificador}`
}

/**
 * Separa un CUIL guardado en el prefijo y el verificador que muestran los controles.
 *
 * Los 8 dígitos del medio no se devuelven: el formulario los arma siempre con el DNI actual, que
 * es lo que corrige un CUIL que no coincidía. Un valor que no tiene 11 dígitos o cuyo prefijo no
 * está permitido se trata como si no hubiera CUIL.
 */
export function partirCuil(cuil) {
  const digitos = String(cuil ?? '').replace(/-/g, '')
  if (!/^[0-9]{11}$/.test(digitos) || !PREFIJOS_CUIL.includes(digitos.slice(0, 2))) {
    return { prefijo: '', verificador: '' }
  }
  return { prefijo: digitos.slice(0, 2), verificador: digitos.slice(10) }
}

/**
 * El CUIL como lo muestra la tabla: `27301112225` → `27-30111222-5`.
 *
 * Un valor que no tiene 11 dígitos se devuelve tal cual: mostrar guiones en una posición inventada
 * es peor que mostrar el dato crudo que hay guardado.
 */
export function formatearCuil(cuil) {
  const digitos = String(cuil ?? '').replace(/-/g, '')
  if (!/^[0-9]{11}$/.test(digitos)) {
    return String(cuil ?? '')
  }
  return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`
}
