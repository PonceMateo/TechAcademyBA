import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { listarCobranzas } from '../services/dataService'
import { renderAppAs, resetDataSource, stubBackend, stubDataSource } from '../test/support'

/**
 * Historial y carga de comprobantes (11.4).
 *
 * Lo que importa acá es el aislamiento: el historial del alumno no puede mostrar el pago de
 * `Tech Solutions S.A.` ni el cheque de `Banco Federal`, y eso se verifica mirando lo que no
 * aparece. El aviso de tercero no se activa en ninguna fila del ejemplo —el comprobante acreditado lo
 * pagó la propia alumna—, así que se renderiza con la fuente sustituida en vez de agregar una fila
 * que el cliente no registró.
 */

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  renderAppAs('ALUMNO', '/alumno/pagos')
  await screen.findByRole('heading', { name: 'Mis Pagos' })
  await screen.findByText('11/05/2026')
})

describe('historial de comprobantes', () => {
  it('muestra la única fila del alumno con fecha, importe, medio y estado', () => {
    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1)

    expect(filas).toHaveLength(1)
    expect(filas[0].cells[0]).toHaveTextContent('11/05/2026')
    expect(filas[0].cells[1]).toHaveTextContent('$31.000')
    expect(filas[0].cells[2]).toHaveTextContent('Transferencia')
    expect(filas[0].cells[3]).toHaveTextContent('Acreditado')
  })

  it('muestra el estado acreditado en verde', () => {
    expect(within(screen.getByRole('table')).getByText('Acreditado').className).toContain('green')
  })

  it('no muestra pagos de empresas ni cheques sin alumno imputado', () => {
    // Los tres comprobantes de la secretaría que no son de esta alumna.
    expect(screen.queryByText('Tech Solutions S.A.')).not.toBeInTheDocument()
    expect(screen.queryByText('$240.000')).not.toBeInTheDocument()
    expect(screen.queryByText('$390.000')).not.toBeInTheDocument()
  })

  it('no marca la fila como pagada por un tercero, porque la pagó la propia alumna', () => {
    expect(screen.queryByText('Pagado por un tercero')).not.toBeInTheDocument()
  })
})

describe('el aviso de pago de terceros', () => {
  it('lo dice junto al importe cuando el pagador no es el alumno', async () => {
    const cobranzas = await listarCobranzas()
    const propia = cobranzas.find((cobranza) => cobranza.id === 2)

    cleanup()
    stubDataSource({
      listarPagosAlumno: async () => [
        { ...propia, pagado_por_tercero: true },
        { ...propia, id: 99, fecha: '2026-06-01', pagado_por_tercero: false },
      ],
    })
    renderAppAs('ALUMNO', '/alumno/pagos')
    await screen.findByText('11/05/2026')

    const aviso = screen.getByText('Pagado por un tercero')
    // Va junto al importe, en la misma celda.
    expect(aviso.closest('td')).toHaveTextContent('$31.000')
    expect(screen.getAllByText('Pagado por un tercero')).toHaveLength(1)
  })
})

describe('alumno sin pagos', () => {
  it('muestra un mensaje de que no hay pagos registrados', async () => {
    cleanup()
    stubDataSource({ listarPagosAlumno: async () => [] })
    renderAppAs('ALUMNO', '/alumno/pagos')

    expect(await screen.findByText('No tenés pagos registrados.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('carga de comprobante', () => {
  // Los campos obligatorios llevan un asterisco en la etiqueta, así que se buscan por patrón.
  it('pide los campos del spec y tiene el botón de envío', () => {
    expect(screen.getByLabelText(/^Curso/)).toBeInTheDocument()
    expect(screen.getByLabelText('Importe')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Medio de pago/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Adjuntar comprobante/)).toBeInTheDocument()
    expect(screen.getByLabelText('Pagado por (opcional)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar para validación' })).toBeInTheDocument()
  })

  it('confirma el envío cuando el formulario está completo', async () => {
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText(/^Curso/), 'CUR-102')
    await user.type(screen.getByLabelText('Importe'), '31000')
    await user.selectOptions(screen.getByLabelText(/^Medio de pago/), 'TRANSFERENCIA')
    await user.upload(
      screen.getByLabelText(/Adjuntar comprobante/),
      new File(['x'], 'comprobante.pdf'),
    )
    await user.click(screen.getByRole('button', { name: 'Enviar para validación' }))

    await waitFor(() =>
      expect(
        screen.getByText(
          'Recibimos tu comprobante. Queda pendiente de validación de Secretaría BA y no cambia tu acceso a la plataforma.',
        ),
      ).toBeInTheDocument(),
    )
  })

  it('exige el curso, el importe, el medio y el archivo antes de confirmar', async () => {
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Enviar para validación' }))

    const errores = await screen.findByRole('alert')
    expect(errores).toHaveTextContent('Elegí el curso al que corresponde el comprobante.')
    expect(errores).toHaveTextContent('Escribí el importe del comprobante.')
    expect(errores).toHaveTextContent('Elegí el medio de pago.')
    expect(errores).toHaveTextContent('Adjuntá el comprobante.')
  })

  it('no cambia el estado de habilitación al enviar un comprobante', async () => {
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText(/^Curso/), 'CUR-102')
    await user.type(screen.getByLabelText('Importe'), '31000')
    await user.selectOptions(screen.getByLabelText(/^Medio de pago/), 'TRANSFERENCIA')
    await user.upload(
      screen.getByLabelText(/Adjuntar comprobante/),
      new File(['x'], 'comprobante.pdf'),
    )
    await user.click(screen.getByRole('button', { name: 'Enviar para validación' }))

    await waitFor(() =>
      expect(
        screen.getByText(/Recibimos tu comprobante. Queda pendiente de validación/),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByText(/habilit/i)).not.toBeInTheDocument()
  })
})
