import { render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { API_MODE, configurarFuenteDeDatos, createDataSource } from './dataSourceFactory'
import { createMockDataSource } from './mockDataSource'
import {
  buscarAlumnoReactivable,
  buscarDocentes,
  crearAlumno,
  editarAlumno,
  eliminarAlumno,
  listarAlumnos,
  listarComisiones,
  reactivarAlumno,
  restablecerPasswordAlumno,
} from './dataService'

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

  it('filtra el padrón de docentes por prefijo de palabra, orden y campo', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    expect((await buscarDocentes('santi')).map((d) => d.id)).toEqual([3])
    expect((await buscarDocentes('martin')).map((d) => d.id)).toEqual([1])
    expect((await buscarDocentes('30.665')).map((d) => d.id)).toEqual([5])
    expect((await buscarDocentes('profemartin')).map((d) => d.id)).toEqual([1])
    expect((await buscarDocentes('rios')).map((d) => d.id)).toEqual([4])
    expect((await buscarDocentes('RÍOS')).map((d) => d.id)).toEqual([4])
    expect(await buscarDocentes('no existe')).toHaveLength(0)

    // Una sola letra busca al comienzo de una palabra, no en el medio.
    expect((await buscarDocentes('a')).map((d) => d.id)).toEqual([3])

    // Las palabras conservan su orden.
    expect((await buscarDocentes('santi ads')).map((d) => d.id)).toEqual([3])
    expect(await buscarDocentes('ads santi')).toHaveLength(0)

    // El DNI también se busca por prefijo, no por cualquier fragmento.
    expect(await buscarDocentes('665')).toHaveLength(0)
  })

  it('devuelve las comisiones reales del ejemplo y su conte derivado', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    const [santi] = await buscarDocentes('santi')
    expect(santi.comisiones).toEqual([
      { id: 5, codigo: 'CUR-103', nombre: 'Marketing Digital & Ads' },
    ])
    expect(santi.comisiones_asignadas).toBe(1)

    const [laura] = await buscarDocentes('laura')
    expect(laura.comisiones).toEqual([])
    expect(laura.comisiones_asignadas).toBe(0)
  })

  it('agrega el alumno dado de alta al padrón de ejemplo, sin inscripción', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    const creado = await crearAlumno({
      documento: '30.111.222',
      nombre: 'Rocío Álvarez',
      email: 'rocio.alvarez@techacademy.invalid',
      telefono: null,
    })

    expect(creado).toMatchObject({
      nombre: 'Rocío Álvarez',
      documento: '30.111.222',
      tipo_documento: 'DNI',
      comision: null,
      categoria: null,
      porcentaje_beca: null,
      acceso: null,
      password_inicial: 'rocio30111222',
    })
    expect((await listarAlumnos()).map((alumno) => alumno.nombre)).toContain('Rocío Álvarez')
  })

  it('edita, restablece la contraseña y da de baja en el padrón de ejemplo', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    const editado = await editarAlumno(1, {
      documento: '38.456.789',
      nombre: 'Juan Pérez Editado',
      email: 'juan.editado@techacademy.invalid',
      telefono: null,
    })
    expect(editado).toMatchObject({ id: 1, nombre: 'Juan Pérez Editado' })

    await restablecerPasswordAlumno(1, 'NuevaClave2026')
    const dadoDeBaja = await eliminarAlumno(1)
    expect(dadoDeBaja.activo).toBe(false)

    const restantes = await listarAlumnos()
    expect(restantes.map((alumno) => alumno.id)).not.toContain(1)
    expect(restantes).toHaveLength(5)
  })

  it('reactiva el mismo alumno dado de baja y le renueva la contraseña inicial', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    await eliminarAlumno(1)
    const reactivable = await buscarAlumnoReactivable({
      documento: '38.456.789',
      email: 'juan.perez@gmail.com',
    })
    expect(reactivable).toMatchObject({ id: 1, activo: false })

    const reactivado = await reactivarAlumno(1, {
      documento: '38.456.789',
      nombre: 'Juan Ignacio Pérez',
      email: 'juan.perez@gmail.com',
      telefono: null,
    })
    expect(reactivado).toMatchObject({
      id: 1,
      activo: true,
      password_inicial: 'juan38456789',
    })

    const activos = await listarAlumnos()
    expect(activos.map((alumno) => alumno.id)).toContain(1)
    expect(activos).toHaveLength(6)
  })

  it('no ofrece reactivar un alumno que sigue activo', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    const reactivable = await buscarAlumnoReactivable({
      documento: '38.456.789',
      email: 'juan.perez@gmail.com',
    })

    expect(reactivable).toBeNull()
  })

  it('agrega la cobranza registrada al historial', async () => {
    const fuente = createMockDataSource()
    const antes = await fuente.listarCobranzas()

    await fuente.registrarCobranza({
      fecha: '2026-06-01',
      titular: 'Juan Ignacio Pérez',
      medio: 'EFECTIVO',
      factura_a_solicitada: false,
      importe: 45000,
      estado: 'ACREDITADO',
      alumno_id: 1,
      inscripcion_id: 1,
    })

    const despues = await fuente.listarCobranzas()
    expect(despues).toHaveLength(antes.length + 1)
    expect(despues[0].fecha).toBe('2026-06-01')
    expect(despues[0].imputacion.nombre).toBe('Juan Ignacio Pérez')
    // HU 21: sin solicitud no se inventa una Factura B.
    expect(despues[0].factura).toBeNull()
    expect(despues[0].factura_a_solicitada).toBe(false)
  })

  it('deja la causa vacía cuando el cobro queda acreditado', async () => {
    const fuente = createMockDataSource()

    const cobranza = await fuente.registrarCobranza({
      fecha: '2026-06-02',
      titular: 'Alguien',
      medio: 'CHEQUE',
      factura_a_solicitada: true,
      cuit_titular: '30-12345678-1',
      importe: 1000,
      estado: 'ACREDITADO',
      alumno_id: 1,
      inscripcion_id: 1,
    })

    expect(cobranza.causa).toBeNull()
    expect(cobranza.factura).toBe('A')
  })

  it('busca en el historial por coincidencia parcial del titular', async () => {
    const fuente = createMockDataSource()

    const coincidencias = await fuente.listarCobranzas('rodríguez')
    expect(coincidencias.length).toBeGreaterThan(0)
    expect(
      coincidencias.every((fila) => fila.pagador.nombre.toLowerCase().includes('rodríguez')),
    ).toBe(true)

    expect(await fuente.listarCobranzas('nadie con ese nombre')).toHaveLength(0)
  })

  it('devuelve la inscripción del alumno para elegir a dónde imputar', async () => {
    const fuente = createMockDataSource()

    const inscripciones = await fuente.listarInscripcionesDeAlumno(1)
    expect(inscripciones).toHaveLength(1)
    expect(inscripciones[0].estado).toBe('ACTIVA')
    expect(inscripciones[0].comision.codigo).toBe('CUR-101')
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
