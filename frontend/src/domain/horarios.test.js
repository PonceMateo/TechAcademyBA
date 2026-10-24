import { describe, expect, it } from 'vitest'
import {
  aHora,
  aMinutos,
  finAlCambiarInicio,
  finSugerido,
  horaCorta,
  redondearHoraEscrita,
  resumenHorarios,
  textoHorarios,
} from './horarios'

function horario(dia, inicio, fin) {
  return { dia, inicio, fin }
}

describe('resumen de horarios', () => {
  it('agrupa los días que comparten rango', () => {
    const horarios = [
      horario('MIE', '19:00', '21:00'),
      horario('LUN', '19:00', '21:00'),
    ]

    expect(resumenHorarios(horarios)).toEqual(['Lun y Mié 19-21hs'])
  })

  it('escribe la hora sin minutos cuando valen cero', () => {
    expect(resumenHorarios([horario('LUN', '19:00', '22:00')])).toEqual(['Lun 19-22hs'])
    expect(horaCorta('19:00')).toBe('19')
  })

  it('escribe los minutos cuando no valen cero', () => {
    expect(resumenHorarios([horario('MAR', '18:15', '21:30')])).toEqual(['Mar 18:15-21:30hs'])
    expect(horaCorta('18:15')).toBe('18:15')
  })

  it('ordena los grupos por día de la semana y no por orden de carga', () => {
    const horarios = [
      horario('SAB', '09:00', '13:00'),
      horario('MAR', '18:15', '21:30'),
      horario('LUN', '19:00', '21:00'),
      horario('MIE', '19:00', '21:00'),
    ]

    expect(resumenHorarios(horarios)).toEqual([
      'Lun y Mié 19-21hs',
      'Mar 18:15-21:30hs',
      'Sáb 9-13hs',
    ])
  })

  it('arma un chip por cada día cuando los siete tienen rangos distintos', () => {
    const dias = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM']
    const horarios = dias.map((dia, posicion) =>
      horario(dia, `${String(9 + posicion).padStart(2, '0')}:00`, `${String(10 + posicion).padStart(2, '0')}:00`),
    )

    expect(resumenHorarios(horarios)).toHaveLength(7)
    expect(textoHorarios(horarios)).toBe(
      'Lun 9-10hs, Mar 10-11hs, Mié 11-12hs, Jue 12-13hs, Vie 13-14hs, Sáb 14-15hs, Dom 15-16hs',
    )
  })

  it('no inventa texto cuando no hay horarios', () => {
    expect(resumenHorarios([])).toEqual([])
    expect(textoHorarios(undefined)).toBe('')
  })
})

describe('reglas del rango', () => {
  it('propone dos horas de clase', () => {
    expect(finSugerido('19:00')).toBe('21:00')
  })

  it('topea el fin propuesto en las 22:00', () => {
    expect(finSugerido('21:00')).toBe('22:00')
    expect(finSugerido('21:45')).toBe('22:00')
  })

  it('recalcula el fin al cambiar el inicio si el fin no se editó', () => {
    expect(finAlCambiarInicio('18:00', '20:00', false)).toBe('20:00')
    expect(finAlCambiarInicio('19:00', '20:00', false)).toBe('21:00')
  })

  it('conserva el fin editado a mano mientras siga siendo posterior', () => {
    expect(finAlCambiarInicio('18:00', '21:30', true)).toBe('21:30')
  })

  it('corrige un fin que dejó de ser posterior al inicio', () => {
    expect(finAlCambiarInicio('21:00', '20:00', true)).toBe('22:00')
  })

  it('redondea lo que se tipea al múltiplo de 15 más cercano', () => {
    expect(redondearHoraEscrita('13:42')).toBe('13:45')
    expect(redondearHoraEscrita('21:19')).toBe('21:15')
    expect(redondearHoraEscrita('19')).toBe('19:00')
  })

  it('acota lo tipeado al rango de 6:00 a 22:00', () => {
    expect(redondearHoraEscrita('05:10')).toBe('06:00')
    expect(redondearHoraEscrita('23:30')).toBe('22:00')
  })

  it('devuelve null cuando el texto no se puede leer', () => {
    expect(redondearHoraEscrita('a la tarde')).toBeNull()
    expect(redondearHoraEscrita('')).toBeNull()
    expect(redondearHoraEscrita('19:75')).toBeNull()
  })

  it('convierte de y hacia minutos sin perder el formato', () => {
    expect(aMinutos('06:15')).toBe(375)
    expect(aHora(375)).toBe('06:15')
    expect(aMinutos('no es una hora')).toBeNull()
  })
})
