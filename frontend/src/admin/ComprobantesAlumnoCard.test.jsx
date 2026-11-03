import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDataSource, stubDataSource } from '../test/support'
import { ComprobantesAlumnoCard } from './ComprobantesAlumnoCard'

/**
 * Panel de revisión de comprobantes de Secretaría (HU 52 y HU 54).
 *
 * Lo que se comprueba acá es la pantalla: columnas, filtro, detalle con el adjunto integrado y las
 * tres resoluciones. El orden de los pendientes y los permisos los decide el backend, y es lo que
 * cubren los tests de la API.
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
  motivo: null,
  revisado_at: null,
  revisado_por: null,
  revisado_por_nombre: null,
  cobranza_id: null,
  comprobante_origen_id: null,
  inscripcion: { id: 1, codigo: 'CUR-102', nombre_curso: 'Desarrollo Web Full Stack' },
  alumno: 'Agustina Benítez',
  alumno_email: 'agustina.benitez@techacademy.invalid',
  alumno_documento: '38111222',
}

const ACEPTADO = {
  ...PENDIENTE,
  id: 8,
  estado: 'ACEPTADO',
  motivo: null,
  revisado_at: '2026-06-03T10:00:00-03:00',
  revisado_por: 1,
  revisado_por_nombre: 'Secretaria BA',
  cobranza_id: 21,
}

const OBSERVADO = {
  ...PENDIENTE,
  id: 9,
  estado: 'OBSERVADO',
  motivo: 'El importe no coincide con el comprobante.',
}

const pdf = () => new Blob(['%PDF-1.4'], { type: 'application/pdf' })

beforeEach(() => {
  resetDataSource()
  URL.createObjectURL = vi.fn(() => 'blob:comprobante')
  URL.revokeObjectURL = vi.fn()
})

describe('panel de comprobantes', () => {
  it('muestra los datos del comprobante y del alumno', async () => {
    stubDataSource({ listarComprobantes: async () => [PENDIENTE] })
    render(<ComprobantesAlumnoCard />)

    expect(await screen.findByText('Agustina Benítez')).toBeInTheDocument()
    expect(screen.getByText('Desarrollo Web Full Stack')).toBeInTheDocument()
    expect(screen.getByText('CUR-102')).toBeInTheDocument()
    // Titular nulo es "Sin identificar" y no el nombre del alumno.
    expect(screen.getByText('Sin identificar')).toBeInTheDocument()
    expect(screen.getByText('$31.000')).toBeInTheDocument()
    expect(screen.getByText('01/06/2026')).toBeInTheDocument()
    expect(screen.getByText('Transferencia')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('Pendiente de revisión')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver comprobante' })).toBeInTheDocument()
  })

  it('explica cuando no hay comprobantes para el filtro', async () => {
    stubDataSource({ listarComprobantes: async () => [] })
    render(<ComprobantesAlumnoCard />)

    expect(await screen.findByText('No hay comprobantes para este filtro.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('pide al backend el estado elegido y conserva los resueltos', async () => {
    const user = userEvent.setup()
    const listar = vi.fn(async ({ estado } = {}) => (estado === 'ACEPTADO' ? [ACEPTADO] : [PENDIENTE]))
    stubDataSource({ listarComprobantes: listar })
    render(<ComprobantesAlumnoCard />)

    await screen.findByText('Agustina Benítez')
    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'ACEPTADO')

    await waitFor(() => expect(listar).toHaveBeenLastCalledWith({ estado: 'ACEPTADO' }))
    expect(within(screen.getByRole('table')).getByText('Aceptado')).toBeInTheDocument()
  })

  it('abre el detalle con el PDF integrado', async () => {
    const user = userEvent.setup()
    stubDataSource({
      listarComprobantes: async () => [PENDIENTE],
      obtenerComprobante: async () => PENDIENTE,
      descargarArchivoComprobante: async () => pdf(),
    })
    render(<ComprobantesAlumnoCard />)

    await user.click(await screen.findByRole('button', { name: 'Ver comprobante' }))

    const visor = await screen.findByTitle('Comprobante comprobante.pdf')
    expect(visor.tagName).toBe('IFRAME')
    expect(visor).toHaveAttribute('src', 'blob:comprobante')
    expect(screen.getByText('02/06/2026 14:30')).toBeInTheDocument()
    expect(screen.getByText('CUIT')).toBeInTheDocument()
    expect(screen.getByText('30123456781')).toBeInTheDocument()
  })

  it('muestra el motivo de un comprobante observado', async () => {
    stubDataSource({ listarComprobantes: async () => [OBSERVADO] })
    render(<ComprobantesAlumnoCard />)

    expect(
      await screen.findByText('El importe no coincide con el comprobante.'),
    ).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('Observado')).toBeInTheDocument()
  })

  it('acepta el comprobante después de confirmar', async () => {
    const user = userEvent.setup()
    const aceptar = vi.fn(async () => ({ ...PENDIENTE, estado: 'ACEPTADO', cobranza_id: 21 }))
    stubDataSource({
      listarComprobantes: async () => [PENDIENTE],
      obtenerComprobante: async () => PENDIENTE,
      descargarArchivoComprobante: async () => pdf(),
      aceptarComprobante: aceptar,
    })
    render(<ComprobantesAlumnoCard />)

    await user.click(await screen.findByRole('button', { name: 'Ver comprobante' }))
    await user.click(await screen.findByRole('button', { name: 'Aceptar' }))
    expect(screen.getByText(/Vas a acreditar el pago/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar aceptación' }))

    await waitFor(() => expect(aceptar).toHaveBeenCalledWith(7))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'El comprobante de Agustina Benítez quedó acreditado.',
    )
    expect(within(screen.getByRole('table')).getByText('Aceptado')).toBeInTheDocument()
  })

  it('exige el motivo antes de observar', async () => {
    const user = userEvent.setup()
    const observar = vi.fn(async () => OBSERVADO)
    stubDataSource({
      listarComprobantes: async () => [PENDIENTE],
      obtenerComprobante: async () => PENDIENTE,
      descargarArchivoComprobante: async () => pdf(),
      observarComprobante: observar,
    })
    render(<ComprobantesAlumnoCard />)

    await user.click(await screen.findByRole('button', { name: 'Ver comprobante' }))
    await user.click(await screen.findByRole('button', { name: 'Observar' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar observación' }))

    expect(observar).not.toHaveBeenCalled()
    expect(await screen.findByText('Indicá el motivo de la resolución.')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Motivo de la observación/), 'Falta el sello del banco')
    await user.click(screen.getByRole('button', { name: 'Confirmar observación' }))

    await waitFor(() => expect(observar).toHaveBeenCalledWith(7, 'Falta el sello del banco'))
  })

  it('rechaza con causa y avisa que es definitivo', async () => {
    const user = userEvent.setup()
    const rechazar = vi.fn(async () => ({ ...PENDIENTE, estado: 'RECHAZADO' }))
    stubDataSource({
      listarComprobantes: async () => [PENDIENTE],
      obtenerComprobante: async () => PENDIENTE,
      descargarArchivoComprobante: async () => pdf(),
      rechazarComprobante: rechazar,
    })
    render(<ComprobantesAlumnoCard />)

    await user.click(await screen.findByRole('button', { name: 'Ver comprobante' }))
    await user.click(await screen.findByRole('button', { name: 'Rechazar' }))
    expect(screen.getByText(/El rechazo es definitivo/)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Motivo del rechazo/), 'Comprobante apócrifo')
    await user.click(screen.getByRole('button', { name: 'Confirmar rechazo' }))

    await waitFor(() => expect(rechazar).toHaveBeenCalledWith(7, 'Comprobante apócrifo'))
    expect(await screen.findByRole('status')).toHaveTextContent('quedó rechazado')
  })

  it('avisa cuando otro administrador ya resolvió el comprobante', async () => {
    const user = userEvent.setup()
    const conflicto = Object.assign(
      new Error('Ese comprobante ya fue resuelto por otro administrador.'),
      { status: 409 },
    )
    const listar = vi.fn(async () => [PENDIENTE])
    stubDataSource({
      listarComprobantes: listar,
      obtenerComprobante: async () => PENDIENTE,
      descargarArchivoComprobante: async () => pdf(),
      aceptarComprobante: async () => {
        throw conflicto
      },
    })
    render(<ComprobantesAlumnoCard />)

    await user.click(await screen.findByRole('button', { name: 'Ver comprobante' }))
    await user.click(await screen.findByRole('button', { name: 'Aceptar' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar aceptación' }))

    expect(
      await screen.findByText('Ese comprobante ya fue resuelto por otro administrador.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(listar.mock.calls.length).toBeGreaterThan(1))
  })

  it('muestra el error cuando la consulta falla', async () => {
    stubDataSource({
      listarComprobantes: async () => {
        throw new Error('No pudimos consultar los comprobantes.')
      },
    })
    render(<ComprobantesAlumnoCard />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos consultar los comprobantes.',
    )
  })
})
