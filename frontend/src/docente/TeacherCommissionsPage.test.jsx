import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  accountForRole,
  renderAppAs,
  resetDataSource,
  stubBackend,
  stubDataSource,
} from '../test/support'
import { formatFechaLarga } from '../utils/formato'

/**
 * Tablero del docente (H/U 56).
 *
 * La comisión se muestra como tarjeta accionable y no como fila de tabla. Los cuatro indicadores se
 * derivan de esa misma lista y de sus encuentros; el test fija ambos para comprobar que el
 * indicador y la tarjeta no se contradicen. La campana concentra los avisos con cantidades reales,
 * y lo que el Figma inventaba —entregas, mensajes, asistencia promedio— no existe.
 */

const SALUDO = `Buen día, ${accountForRole('DOCENTE').nombre}`

const COMISION = {
  codigo: 'CUR-101-1',
  nombre_curso: 'Python Inicial',
  docente_nombre: 'Profe Martín',
  horario: 'Mar y Jue · 19 a 21 hs',
  proxima_clase: 'Hoy · 19:00',
  proximos_encuentros: [
    {
      fecha: '2026-05-25',
      horario: '19:00-21:00',
      tema: 'Introducción a Python',
    },
  ],
  estado: 'Vigente',
  habilitados: 4,
  bloqueados: 1,
}

function tarjeta(rotulo) {
  return screen.getByText(rotulo, { selector: 'p' }).closest('section')
}

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  stubDataSource({ obtenerComisionesAsignadas: async () => [COMISION] })
  renderAppAs('DOCENTE', '/docente')
  await screen.findByRole('heading', { name: SALUDO })
  await screen.findByText('CUR-101-1')
})

describe('encabezado e indicadores', () => {
  it('muestra la fecha real del día', () => {
    expect(
      screen.getByText(`${formatFechaLarga()} · Tu agenda y tus comisiones en un solo lugar.`),
    ).toBeInTheDocument()
  })

  it('deriva los cuatro indicadores de las comisiones', () => {
    expect(tarjeta('COMISIONES ACTIVAS')).toHaveTextContent('1')
    expect(tarjeta('ALUMNOS HABILITADOS')).toHaveTextContent('4')
    expect(tarjeta('BLOQUEADOS')).toHaveTextContent('1')
    expect(tarjeta('PRÓXIMA CLASE')).toHaveTextContent('25/05/2026')
    expect(tarjeta('PRÓXIMA CLASE')).toHaveTextContent('Python Inicial')
  })
})

describe('comisiones asignadas', () => {
  it('muestra la comisión como tarjeta accionable, con estado y contadores', () => {
    expect(screen.getByRole('link', { name: /CUR-101-1/ })).toHaveAttribute(
      'href',
      '/docente/alumnos/CUR-101-1',
    )
    expect(screen.getAllByText('Python Inicial').length).toBeGreaterThan(0)
    expect(screen.getByText('Mar y Jue · 19 a 21 hs')).toBeInTheDocument()
    expect(screen.getByText('Vigente')).toBeInTheDocument()
    expect(screen.getByText('4 alumnos habilitados')).toBeInTheDocument()
    expect(screen.getByText('1 bloqueado')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Acceso habilitado de CUR-101-1' }))
      .toHaveAttribute('aria-valuenow', '80')
    expect(screen.getByRole('link', { name: /Ver comisión/ })).toHaveAttribute(
      'href',
      '/docente/alumnos/CUR-101-1',
    )
    expect(screen.queryByText('RESTRICCIONES')).not.toBeInTheDocument()
  })

  it('no inventa entregas, mensajes ni asistencia promedio', () => {
    expect(screen.queryByText(/Entregas por corregir/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Correcciones pendientes/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Asistencia promedio/)).not.toBeInTheDocument()
  })

  it('ordena las comisiones activas por próxima clase y oculta las finalizadas', async () => {
    cleanup()
    stubDataSource({
      obtenerComisionesAsignadas: async () => [
        {
          ...COMISION,
          codigo: 'CUR-103-1',
          nombre_curso: 'Curso tardío',
          proxima_clase: '10/06/2026 · 19:00',
          proximos_encuentros: [
            { fecha: '2026-06-10', horario: '19:00-21:00', tema: 'Tema tardío' },
          ],
        },
        {
          ...COMISION,
          codigo: 'CUR-102-1',
          nombre_curso: 'Curso cercano',
          proxima_clase: '25/05/2026 · 19:00',
          proximos_encuentros: [
            { fecha: '2026-05-25', horario: '19:00-21:00', tema: 'Tema cercano' },
          ],
        },
        {
          ...COMISION,
          codigo: 'CUR-101-1',
          nombre_curso: 'Curso finalizado',
          estado: 'Finalizada',
          proximos_encuentros: [],
        },
      ],
    })
    renderAppAs('DOCENTE', '/docente')

    await screen.findByText('Curso cercano', { selector: 'h3' })
    const tarjetas = Array.from(document.querySelectorAll('[data-comision]'))

    expect(tarjetas).toHaveLength(2)
    expect(tarjetas[0]).toHaveTextContent('CUR-102-1')
    expect(tarjetas[1]).toHaveTextContent('CUR-103-1')
    expect(screen.queryByText('Curso finalizado')).not.toBeInTheDocument()
    expect(tarjeta('COMISIONES ACTIVAS')).toHaveTextContent('2')
  })

  it('ofrece flechas para recorrer las comisiones', () => {
    expect(screen.getByRole('button', { name: 'Comisión anterior' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comisión siguiente' })).toBeInTheDocument()
  })
})

describe('agenda y avisos', () => {
  it('muestra la clase con fecha, horario, curso y tema', () => {
    expect(screen.getByText('25/05/2026 · 19:00-21:00')).toBeInTheDocument()
    expect(screen.getByText('Python Inicial · CUR-101-1')).toBeInTheDocument()
    expect(screen.getByText('Introducción a Python')).toBeInTheDocument()
  })

  it('abre la campana con los alumnos bloqueados', async () => {
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Notificaciones, 1 pendiente' }))

    expect(screen.getByRole('link', { name: /Alumnos bloqueados/ })).toHaveAttribute(
      'href',
      '/docente/alumnos',
    )
  })

  it('limita la agenda a cinco encuentros y avisa cuántos quedan', async () => {
    cleanup()
    const encuentros = Array.from({ length: 7 }, (_, indice) => ({
      fecha: `2026-05-${String(25 + indice).padStart(2, '0')}`,
      horario: '19:00-21:00',
      tema: `Tema ${indice + 1}`,
    }))
    stubDataSource({
      obtenerComisionesAsignadas: async () => [{ ...COMISION, proximos_encuentros: encuentros }],
    })
    renderAppAs('DOCENTE', '/docente')

    expect(await screen.findByText('Mostrando 5 de 7 encuentros.')).toBeInTheDocument()
    expect(screen.getByText('Tema 5')).toBeInTheDocument()
    expect(screen.queryByText('Tema 6')).not.toBeInTheDocument()
  })
})

describe('casos vacíos y de error', () => {
  it('no muestra las comisiones finalizadas', async () => {
    cleanup()
    stubDataSource({
      obtenerComisionesAsignadas: async () => [
        { ...COMISION, estado: 'Finalizada', proxima_clase: null, proximos_encuentros: [] },
      ],
    })
    renderAppAs('DOCENTE', '/docente')

    await screen.findByText('No tenés comisiones activas en este período lectivo.')
    expect(screen.queryByText('Finalizada')).not.toBeInTheDocument()
    expect(screen.queryByText('Sin próxima clase en el período.')).not.toBeInTheDocument()
    expect(screen.getByText('No tenés clases programadas en este período.')).toBeInTheDocument()
    expect(tarjeta('COMISIONES ACTIVAS')).toHaveTextContent('0')
    expect(tarjeta('PRÓXIMA CLASE')).toHaveTextContent('—')
  })

  it('sin comisiones muestra ceros reales y el vacío de cada bloque', async () => {
    cleanup()
    stubDataSource({ obtenerComisionesAsignadas: async () => [] })
    renderAppAs('DOCENTE', '/docente')

    await screen.findByText('No tenés comisiones asignadas en este período lectivo.')
    expect(tarjeta('COMISIONES ACTIVAS')).toHaveTextContent('0')
    expect(tarjeta('ALUMNOS HABILITADOS')).toHaveTextContent('0')
    expect(tarjeta('BLOQUEADOS')).toHaveTextContent('0')
    expect(tarjeta('PRÓXIMA CLASE')).toHaveTextContent('—')
    expect(screen.getByText('No tenés clases programadas en este período.')).toBeInTheDocument()
  })

  it('si la lectura falla lo informa y deja los indicadores en —', async () => {
    cleanup()
    stubDataSource({
      obtenerComisionesAsignadas: async () => {
        throw new Error('No pudimos conectar con el servidor.')
      },
    })
    renderAppAs('DOCENTE', '/docente')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos cargar tus comisiones. Volvé a intentar en un momento.',
    )
    expect(tarjeta('COMISIONES ACTIVAS')).toHaveTextContent('—')
  })
})
