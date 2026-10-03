import { render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  API_MODE,
  configurarFuenteDeDatos,
  createDataSource,
  resolveApiMode,
} from './dataSourceFactory'
import { createMockDataSource } from './mockDataSource'
import { buscarDocentes, listarComisiones } from './dataService'

/**
 * La frontera de datos (8.2).
 *
 * Lo que se verifica es la promesa de D13 en los dos sentidos: una pantalla pide sus datos por el
 * servicio y no por los mocks, y cambiar de implementación no obliga a tocar esa pantalla. La
 * segunda es la importante: si el probe tuviera que saber de dónde vienen los datos, la frontera
 * no estaría cerrando nada.
 */

const FUENTE_INICIAL = createDataSource({ modo: API_MODE.MOCK })

afterEach(() => {
  configurarFuenteDeDatos(FUENTE_INICIAL)
})

/** Pantalla de prueba: pide comisiones al servicio y dibuja la primera. */
function ComisionesProbe() {
  const [comisiones, setComisiones] = useState([])

  useEffect(() => {
    let vigente = true
    listarComisiones().then((resultado) => {
      if (vigente) {
        setComisiones(resultado)
      }
    })
    return () => {
      vigente = false
    }
  }, [])

  return <p>Cantidad: {comisiones.length}</p>
}

describe('resolución de la implementación', () => {
  it('usa mock salvo que la variable de entorno pida api', () => {
    expect(resolveApiMode({ VITE_API_MODE: 'mock' })).toBe(API_MODE.MOCK)
    expect(resolveApiMode({ VITE_API_MODE: 'api' })).toBe(API_MODE.API)
  })

  it('cae en mock con un valor escrito mal, para no dejar el maquetado sin datos', () => {
    expect(resolveApiMode({ VITE_API_MODE: 'API' })).toBe(API_MODE.MOCK)
    expect(resolveApiMode({})).toBe(API_MODE.MOCK)
    expect(resolveApiMode(undefined)).toBe(API_MODE.MOCK)
  })

  it('rechaza un modo sin implementación con un mensaje que dice cuáles hay', () => {
    expect(() => createDataSource({ modo: 'graphql' })).toThrow(/No hay implementación/)
  })

  it('devuelve una fuente distinta en cada creación, para que una no contamine a la otra', () => {
    const primera = createMockDataSource()
    const segunda = createMockDataSource()

    expect(primera).not.toBe(segunda)
  })
})

describe('la pantalla pide sus datos por el servicio', () => {
  it('muestra lo que devuelve la implementación configurada', async () => {
    render(<ComisionesProbe />)

    await waitFor(() => expect(screen.getByText('Cantidad: 5')).toBeInTheDocument())
  })

  it('no cambia cuando cambia la implementación detrás del mismo servicio', async () => {
    const fuenteFalsa = {
      modo: 'api',
      listarComisiones: async () => [{ codigo: 'CUR-999' }],
    }
    configurarFuenteDeDatos(fuenteFalsa)

    // El mismo componente, sin tocarlo: solo se cambió quién responde.
    render(<ComisionesProbe />)

    await waitFor(() => expect(screen.getByText('Cantidad: 1')).toBeInTheDocument())
  })
})

describe('la implementación de ejemplo', () => {
  it('devuelve las comisiones con las vacantes ya calculadas', async () => {
    const comisiones = await listarComisiones()

    expect(comisiones.map((comision) => comision.codigo)).toEqual([
      'CUR-101',
      'CUR-104',
      'CUR-108',
      'CUR-110',
      'CUR-103',
    ])
    expect(comisiones.find((c) => c.codigo === 'CUR-104').vacantes).toBe(0)
    expect(comisiones.find((c) => c.codigo === 'CUR-101').vacantes).toBe(7)
  })

  it('filtra el padrón de docentes por nombre, DNI o email', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    expect(await buscarDocentes('Santi')).toHaveLength(1)
    expect(await buscarDocentes('30.665.330')).toHaveLength(1)
    expect(await buscarDocentes('gonzalez@')).toHaveLength(1)
    expect(await buscarDocentes('no existe')).toHaveLength(0)
  })

  it('agrega la cobranza registrada al historial', async () => {
    const fuente = createMockDataSource()
    const antes = await fuente.listarCobranzas()

    await fuente.registrarCobranza({
      fecha: '2026-06-01',
      titular: 'Juan Ignacio Pérez',
      medio: 'EFECTIVO',
      facturaTipo: 'B',
      importe: 45000,
      estado: 'ACREDITADO',
      alumnoId: 1,
    })

    const despues = await fuente.listarCobranzas()
    expect(despues).toHaveLength(antes.length + 1)
    expect(despues[0].fecha).toBe('2026-06-01')
    expect(despues[0].imputacion.nombre).toBe('Juan Ignacio Pérez')
  })

  it('deja la causa vacía cuando el cobro queda acreditado', async () => {
    const fuente = createMockDataSource()

    const cobranza = await fuente.registrarCobranza({
      fecha: '2026-06-02',
      titular: 'Alguien',
      medio: 'CHEQUE',
      facturaTipo: 'A',
      importe: 1000,
      estado: 'ACREDITADO',
      alumnoId: 1,
    })

    expect(cobranza.causa).toBeNull()
  })

  it('exige motivo para forzar un bloqueo y anota el usuario con la fecha', async () => {
    const fuente = createMockDataSource()

    await expect(
      fuente.forzarBloqueoManual({ alumnoId: 1, motivo: '   ', usuario: 'Secretaria BA' }),
    ).rejects.toThrow(/motivo es obligatorio/)

    const alumno = await fuente.forzarBloqueoManual({
      alumnoId: 1,
      motivo: 'Revisión de comprobante',
      usuario: 'Secretaria BA',
      fechaOperacion: '2026-06-01',
    })

    expect(alumno.acceso.estado).toBe('BLOQUEADO')
    expect(alumno.acceso.causa).toBe('Revisión de comprobante')
    expect(alumno.acceso.forzado).toEqual({
      usuario: 'Secretaria BA',
      fecha_operacion: '2026-06-01',
      motivo: 'Revisión de comprobante',
    })
  })

  it('copia solo los correos de los alumnos habilitados de la comisión', async () => {
    const fuente = createMockDataSource()

    // CUR-101 tiene a Juan Ignacio Pérez (habilitado) y a Agustina Benítez (bloqueado).
    expect(await fuente.listarEmailsHabilitados('CUR-101')).toEqual(['juan.perez@gmail.com'])
    expect(await fuente.listarEmailsHabilitados('CUR-999')).toEqual([])
  })

  it('encuentra la habilitación por DNI, email, CUIT o razón social', async () => {
    const fuente = createMockDataSource()

    expect((await fuente.buscarHabilitacion('41.332.114')).registro.nombre).toBe('Agustina Benítez')
    expect((await fuente.buscarHabilitacion('valerossi@gmail.com')).registro.nombre).toBe(
      'Valeria Rossi',
    )
    expect((await fuente.buscarHabilitacion('30-71665544-9')).tipo).toBe('EMPRESA')
    expect((await fuente.buscarHabilitacion('Banco Federal')).registro.razon_social).toContain(
      'Banco Federal',
    )
    expect(await fuente.buscarHabilitacion('   ')).toBeNull()
    expect(await fuente.buscarHabilitacion('nadie')).toBeNull()
  })
})
