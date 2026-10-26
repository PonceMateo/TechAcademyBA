import { describe, expect, it } from 'vitest'
import { formatFechaLarga, formatTelefono } from './formato'

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

/** El teléfono de la tabla: se guarda en E.164 y se lee en formato nacional. */
describe('formatTelefono', () => {
  it('muestra el número con el prefijo nacional en vez del código de país', () => {
    expect(formatTelefono('+541140000001')).toBe('011 4000-0001')
    expect(formatTelefono('+5491199990000')).toBe('011 15-9999-0000')
  })

  it('devuelve tal cual un valor que no se puede interpretar', () => {
    expect(formatTelefono('particular')).toBe('particular')
    expect(formatTelefono('000')).toBe('000')
  })

  it('devuelve vacío cuando no hay teléfono', () => {
    expect(formatTelefono(null)).toBe('')
    expect(formatTelefono('')).toBe('')
  })
})
