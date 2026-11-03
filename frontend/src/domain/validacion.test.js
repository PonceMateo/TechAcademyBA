import { describe, expect, it } from 'vitest'
import {
  componerCuil,
  dniConForma,
  dniDigitos,
  emailConForma,
  formatearCuil,
  partirCuil,
  PREFIJOS_CUIL,
} from './validacion'

/**
 * Reglas compartidas de los formularios (D57).
 *
 * Lo que se afirma acá es lo que la pantalla y la API tienen que aceptar y rechazar igual: la
 * contracara en Python está en `backend/app/tests/test_validators.py`.
 */

describe('emailConForma', () => {
  it('acepta un email con algo antes de la arroba y un dominio con punto', () => {
    expect(emailConForma('juan.perez@example.com')).toBe(true)
    expect(emailConForma('  rita@techacademy.invalid  ')).toBe(true)
  })

  it('rechaza los formatos que el spec enumera', () => {
    for (const email of ['juan@', 'juan.perez', '@example.com', 'juan@example.', '']) {
      expect(emailConForma(email)).toBe(false)
    }
  })
})

describe('dniDigitos', () => {
  it('deja solo los dígitos y descarta puntos, espacios y guiones', () => {
    expect(dniDigitos('30.111.222')).toBe('30111222')
    expect(dniDigitos('30 111 222')).toBe('30111222')
    expect(dniDigitos('30-111-222')).toBe('30111222')
    expect(dniDigitos('')).toBe('')
  })
})

describe('dniConForma', () => {
  it('acepta 7 u 8 dígitos con o sin separadores', () => {
    for (const dni of ['30.111.222', '30 111 222', '30-111-222', '30111222', '3011122']) {
      expect(dniConForma(dni)).toBe(true)
    }
  })

  it('rechaza letras y longitudes que no son 7 u 8', () => {
    for (const dni of ['3011122a', '123456', '301112229', '', '30/111/222']) {
      expect(dniConForma(dni)).toBe(false)
    }
  })
})

describe('componerCuil', () => {
  it('arma los 11 dígitos con el prefijo, el DNI y el verificador', () => {
    expect(componerCuil('27', '30111222', '5')).toBe('27301112225')
  })

  it('completa el DNI de 7 dígitos con un cero a la izquierda', () => {
    expect(componerCuil('20', '3011122', '0')).toBe('20030111220')
    expect(componerCuil('20', '3.011.122', '0')).toBe('20030111220')
  })

  it('devuelve null cuando falta una de las tres piezas', () => {
    expect(componerCuil('', '30111222', '5')).toBeNull()
    expect(componerCuil('27', '30111222', '')).toBeNull()
    expect(componerCuil('27', '', '5')).toBeNull()
    expect(componerCuil('27', '30111222', '55')).toBeNull()
  })

  it('devuelve null con un prefijo que no corresponde a una persona con DNI', () => {
    expect(componerCuil('30', '30111222', '5')).toBeNull()
    expect(PREFIJOS_CUIL).toEqual(['20', '23', '24', '27'])
  })

  it('no calcula el dígito verificador: guarda el que se escribe', () => {
    expect(componerCuil('27', '30111222', '0')).toBe('27301112220')
  })
})

describe('partirCuil', () => {
  it('separa el prefijo y el verificador de un CUIL guardado', () => {
    expect(partirCuil('27301112225')).toEqual({ prefijo: '27', verificador: '5' })
    expect(partirCuil('27-30111222-5')).toEqual({ prefijo: '27', verificador: '5' })
  })

  it('trata como vacío lo que no es un CUIL de 11 dígitos con prefijo permitido', () => {
    for (const cuil of [null, undefined, '', '2730111222', '30301112225', 'no-es-un-cuil']) {
      expect(partirCuil(cuil)).toEqual({ prefijo: '', verificador: '' })
    }
  })
})

describe('formatearCuil', () => {
  it('muestra el CUIL con guiones', () => {
    expect(formatearCuil('27301112225')).toBe('27-30111222-5')
  })

  it('deja el valor crudo cuando no tiene 11 dígitos', () => {
    expect(formatearCuil('2730111222')).toBe('2730111222')
    expect(formatearCuil(null)).toBe('')
  })
})
