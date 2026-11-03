import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listarCobranzas } from '../services/dataService'
import { renderAppAs, resetDataSource, stubBackend, stubDataSource } from '../test/support'

/**
 * Historial y envío de comprobantes (11.4 y HU 52).
 *
 * Lo que importa acá es el aislamiento del historial, que el formulario valide antes de mandar y
 * que el envío **no** se presente como un pago acreditado: el comprobante queda pendiente de
 * revisión hasta que Secretaría lo mire.
 */

const PENDIENTE = {
  id: 10,
  estado: 'PENDIENTE_REVISION',
  fecha_pago: '2026-06-01',
  importe: 31000,
  medio: 'TRANSFERENCIA',
  titular: null,
  factura_a_solicitada: false,
  cuit: null,
  archivo_nombre: 'comprobante.pdf',
  archivo_mime: 'application/pdf',
  archivo_bytes: 1200,
  enviado_at: '2026-06-02T14:30:00-03:00',
  inscripcion: { id: 1, codigo: 'CUR-102', nombre_curso: 'Desarrollo Web Full Stack' },
}

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  renderAppAs('ALUMNO', '/alumno/pagos')
  await screen.findByRole('heading', { name: 'Mis Pagos' })
  await screen.findByText('11/05/2026')
})

/** Completa el formulario con datos válidos; el archivo es un PDF de contenido simbólico. */
async function completarFormulario(
  user,
  { archivo = new File(['%PDF-1.4'], 'comprobante.pdf') } = {},
) {
  await user.selectOptions(screen.getByLabelText(/^Inscripción a imputar/), '1')
  fireEvent.change(screen.getByLabelText(/^Fecha del pago/), { target: { value: '2026-06-01' } })
  await user.type(screen.getByLabelText(/^Importe/), '31000')
  await user.selectOptions(screen.getByLabelText(/^Medio de pago/), 'TRANSFERENCIA')
  await user.upload(screen.getByLabelText(/Adjuntar comprobante/), archivo, {
    applyAccept: false,
  })
}

describe('historial de comprobantes acreditados', () => {
  it('muestra la única fila del alumno con fecha, importe, medio y estado', () => {
    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1)

    expect(filas).toHaveLength(1)
    expect(filas[0].cells[0]).toHaveTextContent('11/05/2026')
    expect(filas[0].cells[1]).toHaveTextContent('$31.000')
    expect(filas[0].cells[2]).toHaveTextContent('Transferencia')
    expect(filas[0].cells[3]).toHaveTextContent('Acreditado')
  })

  it('no muestra pagos de empresas ni cheques sin alumno imputado', () => {
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
  })
})

describe('comprobantes enviados', () => {
  it('muestra el estado Pendiente de revisión', async () => {
    cleanup()
    stubDataSource({ listarComprobantesAlumno: async () => [PENDIENTE] })
    renderAppAs('ALUMNO', '/alumno/pagos')

    expect(await screen.findByText('Pendiente de revisión')).toBeInTheDocument()
    expect(screen.getAllByText('$31.000')).toHaveLength(2)
  })

  it('avisa cuando todavía no envió ninguno', async () => {
    expect(await screen.findByText('Todavía no enviaste comprobantes.')).toBeInTheDocument()
  })
})

describe('carga de comprobante', () => {
  it('pide los campos del spec y el botón de envío', () => {
    expect(screen.getByLabelText(/^Inscripción a imputar/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Fecha del pago/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Importe/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Medio de pago/)).toBeInTheDocument()
    expect(screen.getByLabelText('Titular (opcional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Solicitar Factura A')).toBeInTheDocument()
    expect(screen.getByLabelText(/Adjuntar comprobante/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar comprobante' })).toBeInTheDocument()
  })

  it('exige los datos obligatorios antes de enviar', async () => {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Enviar comprobante' }))

    const errores = await screen.findByRole('alert')
    expect(errores).toHaveTextContent('Elegí la inscripción a la que corresponde el comprobante.')
    expect(errores).toHaveTextContent('Elegí la fecha del pago.')
    expect(errores).toHaveTextContent('Escribí un importe mayor a cero.')
    expect(errores).toHaveTextContent('Elegí el medio de pago.')
    expect(errores).toHaveTextContent('Adjuntá el comprobante.')
  })

  it('rechaza una fecha futura', async () => {
    const user = userEvent.setup()
    const futuro = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const valor = futuro.toISOString().slice(0, 10)

    await user.selectOptions(screen.getByLabelText(/^Inscripción a imputar/), '1')
    fireEvent.change(screen.getByLabelText(/^Fecha del pago/), { target: { value: valor } })
    await user.type(screen.getByLabelText(/^Importe/), '31000')
    await user.selectOptions(screen.getByLabelText(/^Medio de pago/), 'TRANSFERENCIA')
    await user.upload(
      screen.getByLabelText(/Adjuntar comprobante/),
      new File(['%PDF-1.4'], 'comprobante.pdf'),
      { applyAccept: false },
    )
    await user.click(screen.getByRole('button', { name: 'Enviar comprobante' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La fecha del pago no puede ser futura.',
    )
  })

  it('rechaza un archivo que no es PDF, JPG ni PNG', async () => {
    const user = userEvent.setup()
    await completarFormulario(user)
    // `user.upload` respeta el `accept` del selector y descarta el archivo antes de probar la
    // validación de la pantalla; el cambio se dispara a mano para ejercitar ese camino.
    fireEvent.change(screen.getByLabelText(/Adjuntar comprobante/), {
      target: { files: [new File(['hola'], 'notas.txt', { type: 'text/plain' })] },
    })
    await user.click(screen.getByRole('button', { name: 'Enviar comprobante' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El comprobante tiene que ser un PDF, JPG o PNG.',
    )
  })

  it('rechaza un archivo de más de 5 MB', async () => {
    const user = userEvent.setup()
    await completarFormulario(user, {
      archivo: new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'comprobante.pdf'),
    })
    await user.click(screen.getByRole('button', { name: 'Enviar comprobante' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El comprobante no puede superar los 5 MB.',
    )
  })

  it('exige un CUIT válido cuando se solicita Factura A', async () => {
    const user = userEvent.setup()
    await completarFormulario(user)
    await user.click(screen.getByLabelText('Solicitar Factura A'))
    await user.click(screen.getByRole('button', { name: 'Enviar comprobante' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ingresá un CUIT válido cuando solicitás Factura A.',
    )
  })

  it('envía, confirma que queda pendiente y muestra el comprobante en la lista', async () => {
    const user = userEvent.setup()
    const enviar = vi.fn(async () => PENDIENTE)
    cleanup()
    stubDataSource({ enviarComprobante: enviar })
    renderAppAs('ALUMNO', '/alumno/pagos')
    await screen.findByText('11/05/2026')

    await completarFormulario(user)
    await user.click(screen.getByRole('button', { name: 'Enviar comprobante' }))

    await waitFor(() =>
      expect(
        screen.getByText(
          'Tu comprobante quedó Pendiente de revisión. Todavía no acredita el pago ni cambia tu acceso.',
        ),
      ).toBeInTheDocument(),
    )
    expect(enviar).toHaveBeenCalledTimes(1)
    const [datos, archivo] = enviar.mock.calls[0]
    expect(datos).toMatchObject({
      inscripcion_id: 1,
      fecha_pago: '2026-06-01',
      importe: '31000',
      medio: 'TRANSFERENCIA',
      factura_a_solicitada: false,
    })
    expect(archivo.name).toBe('comprobante.pdf')
    expect(screen.getByText('Pendiente de revisión')).toBeInTheDocument()
    expect(screen.queryByText(/Habilitado/)).not.toBeInTheDocument()
  })

  it('envía el CUIT y el titular cuando corresponden', async () => {
    const user = userEvent.setup()
    const enviar = vi.fn(async () => PENDIENTE)
    cleanup()
    stubDataSource({ enviarComprobante: enviar })
    renderAppAs('ALUMNO', '/alumno/pagos')
    await screen.findByText('11/05/2026')

    await completarFormulario(user)
    await user.type(screen.getByLabelText('Titular (opcional)'), 'Familiar de Agustina')
    await user.click(screen.getByLabelText('Solicitar Factura A'))
    await user.type(screen.getByLabelText(/^CUIT/), '30123456781')
    await user.click(screen.getByRole('button', { name: 'Enviar comprobante' }))

    await waitFor(() => expect(enviar).toHaveBeenCalledTimes(1))
    expect(enviar.mock.calls[0][0]).toMatchObject({
      titular: 'Familiar de Agustina',
      factura_a_solicitada: true,
      cuit: '30123456781',
    })
  })

  it('no envía dos veces por doble clic y deshabilita el botón', async () => {
    const user = userEvent.setup()
    let resolver
    const enviar = vi.fn(
      () =>
        new Promise((resolverPromesa) => {
          resolver = resolverPromesa
        }),
    )
    cleanup()
    stubDataSource({ enviarComprobante: enviar })
    renderAppAs('ALUMNO', '/alumno/pagos')
    await screen.findByText('11/05/2026')

    await completarFormulario(user)
    const boton = screen.getByRole('button', { name: 'Enviar comprobante' })
    await user.click(boton)
    await user.click(boton)

    expect(enviar).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled()
    expect(screen.getByText('Subiendo y verificando el comprobante…')).toBeInTheDocument()

    resolver(PENDIENTE)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Enviar comprobante' })).toBeEnabled(),
    )
  })

  it('muestra el error del backend y no confirma el envío', async () => {
    const user = userEvent.setup()
    cleanup()
    stubDataSource({
      enviarComprobante: async () => {
        throw new Error('El archivo tiene que ser un PDF, JPG o PNG válido.')
      },
    })
    renderAppAs('ALUMNO', '/alumno/pagos')
    await screen.findByText('11/05/2026')

    await completarFormulario(user)
    await user.click(screen.getByRole('button', { name: 'Enviar comprobante' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El archivo tiene que ser un PDF, JPG o PNG válido.',
    )
    expect(screen.queryByText(/quedó Pendiente de revisión/)).not.toBeInTheDocument()
  })

  it('muestra nombre y tamaño del archivo elegido', async () => {
    const user = userEvent.setup()
    await user.upload(
      screen.getByLabelText(/Adjuntar comprobante/),
      new File([new Uint8Array(2048)], 'comprobante.pdf'),
      { applyAccept: false },
    )

    expect(screen.getByText('comprobante.pdf · 2 KB')).toBeInTheDocument()
  })
})

describe('alumno sin inscripciones activas', () => {
  it('explica que no puede enviar el comprobante', async () => {
    cleanup()
    stubDataSource({ listarInscripcionesAlumno: async () => [] })
    renderAppAs('ALUMNO', '/alumno/pagos')

    expect(
      await screen.findByText('No tenés una inscripción activa para imputar el comprobante.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar comprobante' })).not.toBeInTheDocument()
  })
})

describe('resoluciones de Secretaría (HU 54)', () => {
  it('muestra aceptado, observado con su causa y rechazado', async () => {
    cleanup()
    stubDataSource({
      listarComprobantesAlumno: async () => [
        { ...PENDIENTE, id: 21, estado: 'ACEPTADO' },
        {
          ...PENDIENTE,
          id: 22,
          estado: 'OBSERVADO',
          motivo: 'El importe no coincide.',
        },
        {
          ...PENDIENTE,
          id: 23,
          estado: 'RECHAZADO',
          motivo: 'Comprobante apócrifo.',
        },
      ],
    })
    renderAppAs('ALUMNO', '/alumno/pagos')

    const tabla = (await screen.findByText('Aceptado')).closest('table')
    expect(within(tabla).getByText('Observado')).toBeInTheDocument()
    expect(within(tabla).getByText('El importe no coincide.')).toBeInTheDocument()
    expect(within(tabla).getByText('Rechazado')).toBeInTheDocument()
    expect(within(tabla).getByText('Comprobante apócrifo.')).toBeInTheDocument()
  })

  it('solo ofrece reenviar un comprobante observado', async () => {
    cleanup()
    stubDataSource({
      listarComprobantesAlumno: async () => [
        { ...PENDIENTE, id: 21, estado: 'ACEPTADO' },
        { ...PENDIENTE, id: 22, estado: 'OBSERVADO', motivo: 'Falta el sello.' },
        { ...PENDIENTE, id: 23, estado: 'RECHAZADO', motivo: 'Apócrifo.' },
      ],
    })
    renderAppAs('ALUMNO', '/alumno/pagos')

    await screen.findByText('Falta el sello.')
    expect(screen.getAllByRole('button', { name: 'Reenviar' })).toHaveLength(1)
  })

  it('reenvía un observado con un archivo nuevo y deja el original en el historial', async () => {
    const user = userEvent.setup()
    const observado = { ...PENDIENTE, id: 22, estado: 'OBSERVADO', motivo: 'Falta el sello.' }
    const reenviar = vi.fn(async () => ({ ...PENDIENTE, id: 24, comprobante_origen_id: 22 }))
    cleanup()
    stubDataSource({
      listarComprobantesAlumno: async () => [observado],
      reenviarComprobante: reenviar,
    })
    renderAppAs('ALUMNO', '/alumno/pagos')

    await user.click(await screen.findByRole('button', { name: 'Reenviar' }))
    expect(within(screen.getByRole('dialog')).getByText('Falta el sello.')).toBeInTheDocument()

    await user.upload(
      screen.getByLabelText(/Adjuntar comprobante nuevo/),
      new File(['%PDF-1.4'], 'comprobante-nuevo.pdf'),
      { applyAccept: false },
    )
    await user.click(screen.getByRole('button', { name: 'Reenviar comprobante' }))

    await waitFor(() => expect(reenviar).toHaveBeenCalledTimes(1))
    expect(reenviar.mock.calls[0][0]).toBe(22)
    expect(reenviar.mock.calls[0][1].name).toBe('comprobante-nuevo.pdf')
    expect(
      await screen.findByText(
        'Reenviamos tu comprobante y quedó Pendiente de revisión otra vez. El anterior conserva su motivo.',
      ),
    ).toBeInTheDocument()
    // El original sigue en el historial, el reenvío se suma como pendiente y no se ofrece otra vez.
    expect(screen.getByText('Falta el sello.')).toBeInTheDocument()
    expect(screen.getAllByText('Pendiente de revisión')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Reenviar' })).not.toBeInTheDocument()
    expect(screen.getByText('Ya reenviado')).toBeInTheDocument()
  })

  it('no ofrece reenviar un observado que ya tiene un reenvío', async () => {
    cleanup()
    stubDataSource({
      listarComprobantesAlumno: async () => [
        { ...PENDIENTE, id: 22, estado: 'OBSERVADO', motivo: 'Falta el sello.' },
        { ...PENDIENTE, id: 24, comprobante_origen_id: 22 },
      ],
    })
    renderAppAs('ALUMNO', '/alumno/pagos')

    await screen.findByText('Falta el sello.')
    expect(screen.queryByRole('button', { name: 'Reenviar' })).not.toBeInTheDocument()
    expect(screen.getByText('Ya reenviado')).toBeInTheDocument()
  })

  it('exige un archivo válido para reenviar', async () => {
    const user = userEvent.setup()
    const reenviar = vi.fn()
    cleanup()
    stubDataSource({
      listarComprobantesAlumno: async () => [
        { ...PENDIENTE, id: 22, estado: 'OBSERVADO', motivo: 'Falta el sello.' },
      ],
      reenviarComprobante: reenviar,
    })
    renderAppAs('ALUMNO', '/alumno/pagos')

    await user.click(await screen.findByRole('button', { name: 'Reenviar' }))
    await user.click(screen.getByRole('button', { name: 'Reenviar comprobante' }))

    expect(reenviar).not.toHaveBeenCalled()
    expect(await screen.findByText('Adjuntá el comprobante.')).toBeInTheDocument()
  })

  it('no deja al alumno cambiar el estado de un comprobante', async () => {
    cleanup()
    stubDataSource({
      listarComprobantesAlumno: async () => [
        { ...PENDIENTE, id: 22, estado: 'OBSERVADO', motivo: 'Falta el sello.' },
      ],
    })
    renderAppAs('ALUMNO', '/alumno/pagos')

    await screen.findByText('Falta el sello.')
    expect(screen.queryByRole('button', { name: /Aceptar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Rechazar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Observar/ })).not.toBeInTheDocument()
  })
})
