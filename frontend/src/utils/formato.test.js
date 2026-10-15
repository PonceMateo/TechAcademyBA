import { describe, expect, it } from 'vitest'
import { formatFechaLarga } from './formato'

/**
 * El formato del encabezado queda clavado acá, con fechas fijas construidas en local: es el único
 * lugar donde la fecha no depende del reloj. Los tests de pantalla afirman el encabezado a través
 * del helper, así que el formato del día se prueba una sola vez y sin congelar el reloj.
 */
describe('formatFechaLarga', () => {
  it('capitaliza el día de la semana y quita la coma', () => {
    expect(formatFechaLarga(new Date(2026, 9, 9))).toBe('Viernes 9 de octubre')
  })

  it('formatea el día y el mes en el estilo de la casa', () => {
    expect(formatFechaLarga(new Date(2026, 9, 15))).toBe('Jueves 15 de octubre')
  })
})
