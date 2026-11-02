import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDataSource, stubDataSource } from '../test/support'
import { ComprobantesAlumnoCard } from './ComprobantesAlumnoCard'

/**
 * Bandeja de comprobantes pendientes de Secretaría (HU 52).
 *
 * No modifica nada: lista lo que envió el alumno y abre el adjunto con la sesión de quien mira. Los
 * tests comprueban esas dos cosas y que la bandeja vacía se explique con un mensaje.
 */

const PENDIENTE = {
  id: 7,
  estado: 'PENDIENTE_REVISION',
  fecha_pago: '2026-06-01',
  importe: 31000,
  medio: 'TRANSFERENCIA',
  titular: null,
  factura_a_solicitada: true,
  cuit: '30123456781',
  archivo_nombre: 'comprobante.pdf',
  archivo_mime: 'application/pdf',
  archivo_bytes: 1200,
  enviado_at: '2026-06-02T14:30:00-03:00',
  inscripcion: { id: 1, codigo: 'CUR-102', nombre_curso: 'Desarrollo Web Full Stack' },
  alumno: 'Agustina Benítez',
  alumno_email: 'agustina.benitez@techacademy.invalid',
  alumno_documento: '38111222',
}

beforeEach(() => {
  resetDataSource()
})

describe('comprobantes pendientes', () => {
  it('muestra los datos del comprobante y del alumno', async () => {
    stubDataSource({ listarComprobantesPendientes: async () => [PENDIENTE] })
    render(<ComprobantesAlumnoCard />)

    expect(await screen.findByText('Agustina Benítez')).toBeInTheDocument()
    expect(screen.getByText('Desarrollo Web Full Stack · CUR-102')).toBeInTheDocument()
    expect(screen.getByText('01/06/2026')).toBeInTheDocument()
    expect(screen.getByText('$31.000')).toBeInTheDocument()
    expect(screen.getByText('02/06/2026 14:30')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver comprobante' })).toBeInTheDocument()
  })

  it('explica cuando no hay pendientes', async () => {
    stubDataSource({ listarComprobantesPendientes: async () => [] })
    render(<ComprobantesAlumnoCard />)

    expect(
      await screen.findByText('No hay comprobantes pendientes de revisión.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('muestra el error cuando la consulta falla', async () => {
    stubDataSource({
      listarComprobantesPendientes: async () => {
        throw new Error('No pudimos consultar los comprobantes pendientes.')
      },
    })
    render(<ComprobantesAlumnoCard />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos consultar los comprobantes pendientes.',
    )
  })

  it('abre el adjunto descargado con la sesión', async () => {
    const user = userEvent.setup()
    const descargar = vi.fn(async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' }))
    stubDataSource({
      listarComprobantesPendientes: async () => [PENDIENTE],
      descargarArchivoComprobante: descargar,
    })
    URL.createObjectURL = vi.fn(() => 'blob:comprobante')
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null)

    render(<ComprobantesAlumnoCard />)
    await screen.findByText('Agustina Benítez')
    await user.click(screen.getByRole('button', { name: 'Ver comprobante' }))

    await waitFor(() => expect(descargar).toHaveBeenCalledWith(7))
    expect(abrir).toHaveBeenCalledWith('blob:comprobante', '_blank', 'noopener,noreferrer')
  })
})
