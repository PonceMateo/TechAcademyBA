import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { forzarBloqueoManual } from '../services/dataService'
import { renderAppAs, resetDataSource, stubBackend, stubDataSource } from '../test/support'

/**
 * Detalle de curso y acceso a la clase (11.3).
 *
 * **El detalle ya no tiene datos de referencia ni link.** El cronograma, el docente y los
 * encuentros salen del contrato `/alumno`, y el link de la clase no forma parte de él hasta la
 * historia #39: la pantalla no dibuja ningún botón de ingreso y lo dice con un aviso. El bloqueo se
 * alcanza forzando la inscripción del ejemplo, que es lo que hace la secretaría.
 */

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  renderAppAs('ALUMNO', '/alumno/cursos/CUR-102')
  await screen.findByRole('heading', { name: 'Desarrollo Web Full Stack · CUR-102' })
})

describe('información de la comisión', () => {
  it('muestra el docente, el horario y el chip de categoría', () => {
    expect(screen.getByText('Docente · Lic. Laura Benítez')).toBeInTheDocument()
    expect(screen.getByText('Lun y Mié 18:30-21:30hs')).toBeInTheDocument()
    expect(screen.getByText('Categoría: Becado parcial 50%')).toBeInTheDocument()
  })

  it('muestra el cronograma y los próximos encuentros con fecha, horario y tema', () => {
    expect(screen.getByRole('heading', { name: 'Cronograma' })).toBeInTheDocument()

    const cronograma = within(
      screen.getByRole('heading', { name: 'Cronograma' }).closest('section'),
    )
    expect(cronograma.getByText('04/05/2026')).toBeInTheDocument()
    // El contrato del alumno no tiene fecha de fin: la comisión todavía no la define (D60).
    expect(cronograma.queryByText('29/07/2026')).not.toBeInTheDocument()

    const encuentros = within(
      screen.getByRole('heading', { name: 'Próximos encuentros' }).closest('section'),
    )
    expect(encuentros.getByText('25/05/2026')).toBeInTheDocument()
    // Cada encuentro trae la hora de su día: la tabla tiene columna HORARIO, no solo FECHA.
    expect(encuentros.getAllByText('18:30-21:30')).toHaveLength(3)
    expect(encuentros.getByText('Componentes y props')).toBeInTheDocument()
  })

  it('informa que la fecha de fin todavía no está definida', () => {
    const cronograma = within(
      screen.getByRole('heading', { name: 'Cronograma' }).closest('section'),
    )

    expect(cronograma.getByText('Todavía no está definida')).toBeInTheDocument()
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

describe('el link de la clase todavía no se reparte', () => {
  it('no dibuja ningún botón ni enlace de ingreso', () => {
    expect(screen.queryByRole('link', { name: /ingresar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ingresar/i })).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'El profesor todavía no publicó el link de la clase. Te avisamos apenas lo suba.',
      ),
    ).toBeInTheDocument()
  })

  it('no muestra el aviso de datos de referencia', () => {
    expect(screen.queryByText(/de referencia/i)).not.toBeInTheDocument()
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
    expect(screen.queryByRole('link', { name: /ingresar/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Tu acceso a la clase está habilitado.')).not.toBeInTheDocument()
  })
})

describe('curso que no es del alumno', () => {
  it('no abre el curso de otra comisión', async () => {
    cleanup()
    renderAppAs('ALUMNO', '/alumno/cursos/CUR-101')

    expect(
      await screen.findByText('No encontré esa cursada entre tus inscripciones.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Ingresar a la clase por Zoom' }),
    ).not.toBeInTheDocument()
  })
})

describe('navegación desde la tarjeta', () => {
  it('abre el detalle desde Ver detalle', async () => {
    const user = userEvent.setup()
    cleanup()
    renderAppAs('ALUMNO', '/alumno/cursos')
    await screen.findByRole('link', { name: 'Ver detalle' })

    await user.click(screen.getByRole('link', { name: 'Ver detalle' }))

    expect(
      await screen.findByRole('heading', { name: 'Desarrollo Web Full Stack · CUR-102' }),
    ).toBeInTheDocument()
  })
})

describe('detalle sin endpoint', () => {
  it('muestra que no está inscripto y no queda buscando', async () => {
    cleanup()
    stubDataSource({
      obtenerDetalleInscripcion: async () => {
        throw new Error('No pudimos conectar con el servidor.')
      },
    })
    renderAppAs('ALUMNO', '/alumno/cursos/CUR-102')

    expect(
      await screen.findByText('No encontré esa cursada entre tus inscripciones.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Buscando la cursada…')).not.toBeInTheDocument()
  })
})
