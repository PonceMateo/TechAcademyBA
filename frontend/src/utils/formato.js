/**
 * Formato de la interfaz (es-AR).
 *
 * **Los separadores no se escriben a mano.** `$45.000` con punto de miles y `10/05/2026` con
 * barra son literales del spec de `admin-shell`, y salen de acá y no de una plantilla en cada
 * pantalla: si mañana hay un importe con centavos, se cambia en un lugar.
 *
 * **Acá conviven dos criterios de fecha, y es a propósito.** Las fechas del dominio son cadenas
 * (`formatFechaCorta`) porque son fechas, no instantes, así que no pasan por `Date`; la fecha del
 * encabezado (`formatFechaLarga`) es genuinamente el instante actual, y es el único lugar del
 * módulo que usa `Date`.
 */
import { formatPhoneNumber, parsePhoneNumber } from 'react-phone-number-input'

/**
 * Miles y pesos sin decimales.
 *
 * Va con `Intl` en modo decimal y el signo adelante a propósito: `Intl` en modo `currency` para
 * `es-AR` separa el `$` del número con un espacio que no aparece en el prototipo, y el spec pide
 * `$45.000`.
 */
const MILES = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

export function formatMoneda(monto) {
  if (monto === null || monto === undefined || monto === '') {
    return ''
  }

  return `$${MILES.format(monto)}`
}

/**
 * `2026-05-10` → `10/05/2026`. Sin `Date`: las fechas del dominio son fechas, no instantes (el
 * instante actual lo formatea `formatFechaLarga`).
 */
export function formatFechaCorta(fecha) {
  if (!fecha) {
    return ''
  }

  const [anio, mes, dia] = String(fecha).split('-')
  return `${dia}/${mes}/${anio}`
}

const FECHA_LARGA = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/**
 * La fecha del encabezado: `Viernes 9 de octubre`. Toma una fecha (por defecto, hoy) y normaliza
 * lo que `Intl` intercala de más: capitaliza el día de la semana y quita la coma (`viernes, 9 de
 * octubre` → `Viernes 9 de octubre`). El argumento existe para poder clavar el formato en un test
 * con una fecha fija, sin congelar el reloj.
 */
export function formatFechaLarga(fecha = new Date()) {
  const texto = FECHA_LARGA.format(fecha).replace(',', '')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * `+541140000001` → `011 4000-0001`: el teléfono como lo lee la secretaría en la tabla.
 *
 * El valor guardado es E.164 porque es lo que viaja y lo que valida la API; el `+54` y el `0` del
 * prefijo nacional son de la vista. Un texto que la librería no puede interpretar —`particular`,
 * `000`— se devuelve tal cual, igual que `formatearCuil`: un formato inventado es peor que el dato
 * crudo que hay guardado.
 */
export function formatTelefono(valor) {
  if (!valor) {
    return ''
  }

  const numero = parsePhoneNumber(String(valor))
  return numero ? formatPhoneNumber(numero.number) : String(valor)
}

/**
 * `30111222` → `30.111.222`: el documento se guarda solo con dígitos (D6) y se lee con puntos.
 * Un texto que no sea un DNI de 7 u 8 dígitos —el alumno del exterior— se devuelve tal cual.
 */
export function formatDocumento(valor) {
  if (!valor) {
    return ''
  }

  const texto = String(valor).trim()
  if (!/^[\d.\s-]+$/.test(texto)) {
    return texto
  }

  const digitos = texto.replace(/\D/g, '')
  if (digitos.length < 7 || digitos.length > 8) {
    return texto
  }

  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Iniciales de la cuenta para el avatar: dos palabras, dos letras. */
export function inicialesDe(nombre) {
  return nombre
    .split(/\s+/)
    .filter((parte) => parte.length > 0)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join('')
}
