import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { forzarBloqueoManual, guardarLinkClase } from '../services/dataService'
import { renderAppAs, resetDataSource, stubBackend } from '../test/support'

/**
 * Detalle de curso y acceso a la clase (11.3).
 *
 * Los tres estados del bloque de acceso se alcanzan con las acciones del maqueteado y no con datos
 * de ejemplo inventados: habilitado sin link es el estado en que arranca, con link se carga desde el
 * lado del docente y bloqueado se fuerza desde la secretaría. Un cuarto estado —alumno que no está
 * inscripto en el curso que pide— se comprueba con un código que no es suyo.
 */

const LINK = 'https://zoom.us/j/11223344'

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  renderAppAs('ALUMNO', '/alumno/cursos/CUR-102')
  await screen.findByRole('heading', { name: 'Desarrollo Web Full Stack · CUR-102' })
})

describe('información de la comisión', () => {
  it('muestra el docente, el horario y el chip de categoría', () => {
    expect(screen.getByText('Docente · Lic. Laura Benítez')).toBeInTheDocument()
    expect(screen.getByText('Lunes y miércoles · 18:30 a 21:30')).toBeInTheDocument()
    expect(screen.getByText('Categoría: Becado parcial 50%')).toBeInTheDocument()
  })

  it('muestra el cronograma y los próximos encuentros con fecha y tema', () => {
    expect(screen.getByRole('heading', { name: 'Cronograma' })).toBeInTheDocument()

    const cronograma = within(
      screen.getByRole('heading', { name: 'Cronograma' }).closest('section'),
    )
    expect(cronograma.getByText('04/05/2026')).toBeInTheDocument()
    expect(cronograma.getByText('29/07/2026')).toBeInTheDocument()

    const encuentros = within(
      screen.getByRole('heading', { name: 'Próximos encuentros' }).closest('section'),
    )
    expect(encuentros.getByText('25/05/2026')).toBeInTheDocument()
    expect(encuentros.getByText('Componentes y props')).toBeInTheDocument()
  })

  it('aclara que el cronograma es material de referencia', () => {
    expect(screen.getByText(/Cronograma y temas de referencia/)).toBeInTheDocument()
  })
})

describe('acceso habilitado sin link cargado', () => {
  it('muestra el chip y el texto de acceso habilitado', () => {
    const chip = screen.getByText('HABILITADO')

    expect(chip.className).toContain('green')
    expect(screen.getByText('Tu acceso a la clase está habilitado.')).toBeInTheDocument()
  })

  it('no muestra el botón de ingreso a la clase', () => {
    expect(
      screen.queryByRole('link', { name: 'Ingresar a la clase por Zoom' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'El profesor todavía no publicó el link de la clase. Te avisamos apenas lo suba.',
      ),
    ).toBeInTheDocument()
  })
})

describe('acceso habilitado con link cargado', () => {
  beforeEach(async () => {
    await guardarLinkClase({ comisionCodigo: 'CUR-102', url: LINK })
    cleanup()
    renderAppAs('ALUMNO', '/alumno/cursos/CUR-102')
    await screen.findByRole('heading', { name: 'Desarrollo Web Full Stack · CUR-102' })
  })

  it('muestra el botón de ingreso con el link que cargó el docente', () => {
    const boton = screen.getByRole('link', { name: 'Ingresar a la clase por Zoom' })

    expect(boton).toHaveAttribute('href', LINK)
    expect(screen.getByText('Tu acceso a la clase está habilitado.')).toBeInTheDocument()
    expect(
      screen.queryByText(
        'El profesor todavía no publicó el link de la clase. Te avisamos apenas lo suba.',
      ),
    ).not.toBeInTheDocument()
  })
})

describe('acceso bloqueado', () => {
  beforeEach(async () => {
    await forzarBloqueoManual({
      alumnoId: 2,
      motivo: 'debe saldo',
      usuario: 'Secretaria BA',
      fechaOperacion: '2026-05-21',
    })
    // Con link cargado y bloqueado a la vez: el bloqueo tiene que tapar el link.
    await guardarLinkClase({ comisionCodigo: 'CUR-102', url: LINK })

    cleanup()
    renderAppAs('ALUMNO', '/alumno/cursos/CUR-102')
    await screen.findByRole('heading', { name: 'Desarrollo Web Full Stack · CUR-102' })
  })

  it('muestra el estado bloqueado con su causa', () => {
    const chip = screen.getByText('BLOQUEADO')

    expect(chip.className).toContain('red')
    expect(screen.getByText('Causa: debe saldo')).toBeInTheDocument()
  })

  it('no muestra ni el link ni el botón de ingreso', () => {
    expect(
      screen.queryByRole('link', { name: 'Ingresar a la clase por Zoom' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: LINK })).not.toBeInTheDocument()
    expect(screen.queryByText('Tu acceso a la clase está habilitado.')).not.toBeInTheDocument()
  })
})

describe('curso que no es del alumno', () => {
  it('no abre el curso de otra comisión', async () => {
    cleanup()
    renderAppAs('ALUMNO', '/alumno/cursos/CUR-101')

    expect(await screen.findByText('No estás inscripto en este curso.')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Ingresar a la clase por Zoom' }),
    ).not.toBeInTheDocument()
  })
})

describe('navegación desde la tarjeta', () => {
  it('abre el detalle desde Ver detalle', async () => {
    const user = userEvent.setup()
    cleanup()
    renderAppAs('ALUMNO', '/alumno')
    await screen.findByRole('link', { name: 'Ver detalle' })

    await user.click(screen.getByRole('link', { name: 'Ver detalle' }))

    expect(
      await screen.findByRole('heading', { name: 'Desarrollo Web Full Stack · CUR-102' }),
    ).toBeInTheDocument()
  })
})
