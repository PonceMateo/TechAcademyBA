/**
 * Formato de la interfaz (es-AR).
 *
 * **Los separadores no se escriben a mano.** `$45.000` con punto de miles y `10/05/2026` con
 * barra son literales del spec de `admin-shell`, y salen de acá y no de una plantilla en cada
 * pantalla: si mañana hay un importe con centavos, se cambia en un lugar.
 */

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

/** `2026-05-10` → `10/05/2026`. Sin `Date`: las fechas del dominio son fechas, no instantes. */
export function formatFechaCorta(fecha) {
  if (!fecha) {
    return ''
  }

  const [anio, mes, dia] = String(fecha).split('-')
  return `${dia}/${mes}/${anio}`
}
