import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend, stubDataSource } from '../test/support'

/**
 * Cobranzas e ingresos (9.6).
 *
 * La pantalla tiene que separar dos cosas que el prototipo mezclaba: quién pagó y a quién se le
 * imputa. El caso del 19/05/2026 lo demuestra —el titular es un familiar, el alumno imputado es
 * Agustina Benítez y el importe no se pudo leer—, así que esa fila se verifica entera, con el
 * importe vacío.
 */

const COLUMNAS = [
  'FECHA',
  'TITULAR DEL PAGO',
  'ALUMNO IMPUTADO',
  'MEDIO',
  'FACTURA A',
  'IMPORTE',
  'ESTADO GESTIÓN',
]

const MEDIOS = ['Transferencia', 'Efectivo', 'Cheque', 'Tarjeta', 'Billetera', 'Otro']

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  renderAppAs('ADMIN', '/admin/cobranzas')
  await screen.findByRole('heading', { name: 'Historial de Ingresos Registrados' })
  await screen.findByText('10/05/2026')
})

function filas() {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1)
}

describe('formulario de registro', () => {
  it('va embebido en la pantalla y no en un modal', () => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Registrar Cobranza Manual' })).toBeInTheDocument()
  })

  it('muestra el titular y el alumno imputado como campos distintos', () => {
    expect(screen.getByLabelText(/Titular del Comprobante/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Alumno a Imputar Pago/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Titular del Comprobante/)).not.toBe(
      screen.getByLabelText(/Alumno a Imputar Pago/),
    )
  })

  it('busca y elige al alumno en un único combobox', async () => {
    const user = userEvent.setup()
    const campo = screen.getByLabelText(/Alumno a Imputar Pago/)

    expect(campo).toHaveAttribute('role', 'combobox')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    await user.type(campo, 'Valeria')
    const opciones = within(screen.getByRole('listbox')).getAllByRole('option')

    expect(opciones).toHaveLength(1)
    expect(opciones[0]).toHaveTextContent('Valeria Rossi')

    await user.click(opciones[0])

    const bloque = screen.getByRole('button', { name: 'Cambiar' }).parentElement
    expect(within(bloque).getByText('Valeria Rossi')).toBeInTheDocument()
    expect(within(bloque).getByText('DNI 36.778.990')).toBeInTheDocument()
  })

  it('vuelve al buscador con Cambiar sin perder el resto del formulario', async () => {
    const user = userEvent.setup()
    const campo = screen.getByLabelText(/Alumno a Imputar Pago/)

    await user.type(screen.getByLabelText(/Titular del Comprobante/), 'Familiar de Valeria')
    await user.type(campo, 'Valeria')
    await user.click(screen.getByRole('option', { name: /Valeria Rossi/ }))
    await user.click(screen.getByRole('button', { name: 'Cambiar' }))

    expect(screen.getByLabelText(/Alumno a Imputar Pago/)).toHaveFocus()
    expect(screen.getByLabelText(/Titular del Comprobante/)).toHaveValue('Familiar de Valeria')
    expect(screen.queryByRole('button', { name: 'Cambiar' })).not.toBeInTheDocument()
  })

  it('ofrece los mismos medios de pago que la columna MEDIO del historial', () => {
    const opciones = within(screen.getByLabelText(/Medio de Pago/))
      .getAllByRole('option')
      .map((opcion) => opcion.textContent)

    expect(opciones.slice(1)).toEqual(MEDIOS)
  })

  it('no registra el cobro sin fecha, importe o medio de pago', async () => {
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Registrar Cobro' }))

    // Cada campo muestra su error y abajo hay un resumen: se busca el resumen por texto para no
    // depender de cuántos `role="alert"` hay en pantalla.
    const aviso = await screen.findByText(/Faltan datos obligatorios/)
    expect(aviso).toHaveTextContent('Fecha Pago')
    expect(aviso).toHaveTextContent('Importe Cobrado (AR$)')
    expect(aviso).toHaveTextContent('Medio de Pago')
    expect(filas()).toHaveLength(6)
  })

  it('agrega la fila registrada al historial', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/Fecha Pago/), '2026-06-01')
    await user.type(screen.getByLabelText(/Importe Cobrado/), '45000')
    await user.selectOptions(screen.getByLabelText(/Medio de Pago/), 'EFECTIVO')
    await user.type(screen.getByLabelText(/Titular del Comprobante/), 'Juan Ignacio Pérez')
    await user.type(screen.getByLabelText(/Alumno a Imputar Pago/), 'Juan')
    await user.click(await screen.findByRole('option', { name: /Juan Ignacio Pérez/ }))
    // La inscripción se resuelve de forma asíncrona: con una sola se selecciona sola.
    await screen.findByText(/Se imputará a CUR-101/)
    await user.click(screen.getByRole('button', { name: 'Registrar Cobro' }))

    await waitFor(() => expect(filas()).toHaveLength(7))
    const nueva = filas()[0]

    expect(nueva.cells[0]).toHaveTextContent('01/06/2026')
    expect(nueva.cells[1]).toHaveTextContent('Juan Ignacio Pérez')
    expect(nueva.cells[2]).toHaveTextContent('Juan Ignacio Pérez')
    expect(nueva.cells[3]).toHaveTextContent('Efectivo')
    // Sin Factura A solicitada la columna muestra el guion, no una B inventada.
    expect(nueva.cells[4].textContent).toBe('—')
    expect(nueva.cells[5]).toHaveTextContent('$45.000')
    expect(nueva.cells[6]).toHaveTextContent('ACREDITADO')
  })

  it('busca por nombre, apellido, DNI o email con coincidencias parciales', async () => {
    const user = userEvent.setup()
    const campo = screen.getByLabelText(/Alumno a Imputar Pago/)

    async function coincidencias(texto) {
      await user.clear(campo)
      await user.type(campo, texto)
      return within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .map((opcion) => opcion.textContent)
    }

    // Sin tildes: `Pérez` se encuentra escribiendo `perez`.
    expect(await coincidencias('perez')).toEqual([expect.stringContaining('Juan Ignacio Pérez')])
    expect(await coincidencias('Rossi')).toEqual([expect.stringContaining('Valeria Rossi')])
    expect(await coincidencias('36.778')).toEqual([expect.stringContaining('Valeria Rossi')])
    expect(await coincidencias('valerossi')).toEqual([expect.stringContaining('Valeria Rossi')])
  })

  it('permite elegir una coincidencia con el teclado', async () => {
    const user = userEvent.setup()
    const campo = screen.getByLabelText(/Alumno a Imputar Pago/)

    await user.type(campo, 'Juan')
    await user.keyboard('{ArrowDown}{Enter}')

    const bloque = screen.getByRole('button', { name: 'Cambiar' }).parentElement
    expect(within(bloque).getByText('Juan Ignacio Pérez')).toBeInTheDocument()
    expect(within(bloque).getByText('DNI 38.456.789')).toBeInTheDocument()
  })

  it('avisa cuando ningún alumno coincide con la búsqueda', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/Alumno a Imputar Pago/), 'zzzz')

    expect(
      within(screen.getByRole('listbox')).getByText('No hay alumnos que coincidan.'),
    ).toBeInTheDocument()
  })
})

describe('historial de ingresos', () => {
  it('muestra las columnas en el orden que fija el spec', () => {
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(COLUMNAS)
  })

  it('muestra las seis filas del maquetado con sus medios y facturas', () => {
    expect(filas().map((fila) => fila.cells[0].textContent)).toEqual([
      '10/05/2026',
      '11/05/2026',
      '12/05/2026',
      '16/05/2026',
      '19/05/2026',
      '21/05/2026',
    ])
    expect(filas()[3].cells[3]).toHaveTextContent('Cheque')
    expect(filas()[5].cells[3]).toHaveTextContent('Efectivo')
  })

  it('deja el comprobante ilegible con el titular que falta, el alumno imputado y el importe vacío', () => {
    const fila = filas().find((f) => f.cells[0].textContent === '19/05/2026')

    expect(fila.cells[1]).toHaveTextContent('Familiar de Agustina Benítez')
    expect(fila.cells[2]).toHaveTextContent('Agustina Benítez')
    expect(fila.cells[5]).toHaveTextContent('')
    expect(fila.cells[5].textContent).toBe('')
    expect(fila.cells[6]).toHaveTextContent('OBSERVADO')
    expect(fila.cells[6]).toHaveTextContent('comprobante ilegible')
  })

  it('deja el cheque pendiente de acreditación sin alumno imputado', () => {
    const fila = filas().find((f) => f.cells[0].textContent === '16/05/2026')

    expect(fila.cells[1]).toHaveTextContent('Banco Federal')
    expect(fila.cells[2].textContent).toBe('')
    expect(fila.cells[5]).toHaveTextContent('$390.000')
    expect(fila.cells[6]).toHaveTextContent('cheque pendiente de acreditación')
  })

  it('muestra el estado de gestión con su color', () => {
    // Se busca dentro de la tabla: el `Estado Inicial` del formulario ofrece los mismos valores
    // como opciones, y contarlos juntos daría un número que no es el del historial.
    const tabla = within(screen.getByRole('table'))
    const estados = (valor) => tabla.queryAllByText(valor)

    expect(estados('ACREDITADO')).toHaveLength(3)
    expect(estados('OBSERVADO')).toHaveLength(3)
    for (const estado of estados('ACREDITADO')) {
      expect(estado.className).toContain('text-green-800')
    }
    for (const estado of estados('OBSERVADO')) {
      expect(estado.className).toContain('text-amber-900')
    }
  })

  it('distingue también el estado RECHAZADO, que el enum define y el historial aún no trae', async () => {
    // El rechazo no aparece en las seis filas del maquetado, así que se registra uno por el
    // formulario para comprobar que la columna no se queda sin color para ese valor.
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/Fecha Pago/), '2026-06-02')
    await user.type(screen.getByLabelText(/Importe Cobrado/), '10000')
    await user.selectOptions(screen.getByLabelText(/Medio de Pago/), 'CHEQUE')
    await user.type(screen.getByLabelText(/Titular del Comprobante/), 'Alguien')
    await user.selectOptions(screen.getByLabelText(/Estado Inicial/), 'RECHAZADO')
    await user.type(screen.getByLabelText(/Causa del comprobante/), 'cheque rechazado')
    await user.click(screen.getByRole('button', { name: 'Registrar Cobro' }))

    await waitFor(() => expect(filas()).toHaveLength(7))
    const rechazada = within(screen.getByRole('table')).getByText('RECHAZADO')
    expect(rechazada.className).toContain('text-red-800')
    expect(filas()[0].cells[6]).toHaveTextContent('cheque rechazado')
  })

  it('exige la causa cuando el cobro no queda acreditado', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/Fecha Pago/), '2026-06-03')
    await user.type(screen.getByLabelText(/Importe Cobrado/), '10000')
    await user.selectOptions(screen.getByLabelText(/Medio de Pago/), 'CHEQUE')
    await user.selectOptions(screen.getByLabelText(/Estado Inicial/), 'OBSERVADO')
    await user.click(screen.getByRole('button', { name: 'Registrar Cobro' }))

    expect(await screen.findByText(/Faltan datos obligatorios/)).toHaveTextContent(
      'Faltan datos obligatorios: Causa del comprobante no acreditado.',
    )
    expect(filas()).toHaveLength(6)
  })

  it('muestra la factura como badge A o B', () => {
    const facturas = filas().map((fila) => fila.cells[4].textContent)

    expect(facturas).toEqual(['B', 'B', 'A', 'A', 'B', 'B'])
  })
})

describe('acreditamiento automático', () => {
  it('se muestra deshabilitado y con la etiqueta Próximamente', () => {
    const boton = screen.getByRole('button', { name: 'Acreditar pagos automáticamente' })

    expect(boton).toBeDisabled()
    expect(screen.getByText('Próximamente')).toBeInTheDocument()
  })
})

describe('historial sin endpoint', () => {
  it('deja el historial y el selector vacíos cuando la lectura falla', async () => {
    cleanup()
    stubDataSource({
      listarCobranzas: async () => {
        throw new Error('No pudimos conectar con el servidor.')
      },
      listarAlumnos: async () => {
        throw new Error('No pudimos conectar con el servidor.')
      },
    })
    renderAppAs('ADMIN', '/admin/cobranzas')

    await screen.findByRole('heading', { name: 'Registrar Cobranza Manual' })
    // El historial queda sin tabla y el combobox avisa que no hay padrón para buscar.
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    const campo = screen.getByLabelText(/Alumno a Imputar Pago/)
    await userEvent.type(campo, 'Juan')
    expect(
      within(screen.getByRole('listbox')).getByText('No hay alumnos que coincidan.'),
    ).toBeInTheDocument()
  })
})

describe('HU 21: el alta real contra la API', () => {
  /** Completa el formulario con un pago válido y deja lista la inscripción del alumno 1. */
  async function completarPago(user, { fecha = '2026-06-01', importe = '45000' } = {}) {
    await user.type(screen.getByLabelText(/Fecha Pago/), fecha)
    await user.type(screen.getByLabelText(/Importe Cobrado/), importe)
    await user.selectOptions(screen.getByLabelText(/Medio de Pago/), 'EFECTIVO')
    await user.type(screen.getByLabelText(/Titular del Comprobante/), 'Juan Ignacio Pérez')
    await user.type(screen.getByLabelText(/Alumno a Imputar Pago/), 'Juan')
    await user.click(await screen.findByRole('option', { name: /Juan Ignacio Pérez/ }))
    await screen.findByText(/Se imputará a CUR-101/)
  }

  it('no envía una fecha futura y lo informa sin agregar la fila', async () => {
    const user = userEvent.setup()

    await completarPago(user, { fecha: '2099-01-01' })
    await user.click(screen.getByRole('button', { name: 'Registrar Cobro' }))

    expect(await screen.findByText(/La fecha del pago no puede ser futura/)).toBeInTheDocument()
    expect(filas()).toHaveLength(6)
  })

  it('muestra el motivo del backend y no confirma un alta rechazada', async () => {
    stubDataSource({
      registrarCobranza: async () => {
        throw new Error('La inscripción elegida no está activa.')
      },
    })
    const user = userEvent.setup()

    await completarPago(user)
    await user.click(screen.getByRole('button', { name: 'Registrar Cobro' }))

    expect(await screen.findByText('La inscripción elegida no está activa.')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(filas()).toHaveLength(6)
  })

  it('pide el CUIT solo al solicitar Factura A y guarda la solicitud', async () => {
    const user = userEvent.setup()

    expect(screen.queryByLabelText(/CUIT del Titular/)).not.toBeInTheDocument()

    await user.click(screen.getByLabelText(/El titular solicita Factura tipo A/))
    expect(screen.getByLabelText(/CUIT del Titular/)).toBeInTheDocument()

    await completarPago(user)
    await user.type(screen.getByLabelText(/CUIT del Titular/), '30-12345678-1')
    await user.click(screen.getByRole('button', { name: 'Registrar Cobro' }))

    await waitFor(() => expect(filas()).toHaveLength(7))
    expect(filas()[0].cells[4].textContent).toBe('A')
  })

  it('rechaza un CUIT inválido antes de llamar a la API', async () => {
    const user = userEvent.setup()

    await user.click(screen.getByLabelText(/El titular solicita Factura tipo A/))
    await completarPago(user)
    await user.type(screen.getByLabelText(/CUIT del Titular/), '30-12345678-9')
    await user.click(screen.getByRole('button', { name: 'Registrar Cobro' }))

    expect(await screen.findByText(/Faltan datos obligatorios/)).toHaveTextContent(
      'CUIT del Titular',
    )
    expect(filas()).toHaveLength(6)
  })

  it('conserva el pago después de recargar la pantalla', async () => {
    const user = userEvent.setup()

    await completarPago(user)
    await user.click(screen.getByRole('button', { name: 'Registrar Cobro' }))
    await waitFor(() => expect(filas()).toHaveLength(7))

    cleanup()
    renderAppAs('ADMIN', '/admin/cobranzas')
    await screen.findByText('10/05/2026')

    await waitFor(() => expect(filas()).toHaveLength(7))
    expect(filas()[0].cells[0]).toHaveTextContent('01/06/2026')
    expect(filas()[0].cells[5]).toHaveTextContent('$45.000')
  })

  it('muestra el selector de inscripción cuando el alumno tiene varias', async () => {
    stubDataSource({
      listarInscripcionesDeAlumno: async () => [
        {
          id: 11,
          estado: 'ACTIVA',
          comision: { codigo: 'CUR-101', nombre: 'Python Inicial' },
        },
        {
          id: 12,
          estado: 'ACTIVA',
          comision: { codigo: 'CUR-102', nombre: 'Desarrollo Web Full Stack' },
        },
      ],
    })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/Alumno a Imputar Pago/), 'Juan')
    await user.click(await screen.findByRole('option', { name: /Juan Ignacio Pérez/ }))

    const selector = await screen.findByLabelText(/Inscripción a imputar/)
    const opciones = within(selector)
      .getAllByRole('option')
      .map((opcion) => opcion.textContent)

    expect(opciones).toEqual([
      'Seleccionar…',
      'CUR-101 — Python Inicial',
      'CUR-102 — Desarrollo Web Full Stack',
    ])
  })

  it('bloquea el pago imputado cuando el alumno no tiene inscripciones activas', async () => {
    stubDataSource({ listarInscripcionesDeAlumno: async () => [] })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/Fecha Pago/), '2026-06-01')
    await user.type(screen.getByLabelText(/Importe Cobrado/), '45000')
    await user.selectOptions(screen.getByLabelText(/Medio de Pago/), 'EFECTIVO')
    await user.type(screen.getByLabelText(/Alumno a Imputar Pago/), 'Juan')
    await user.click(await screen.findByRole('option', { name: /Juan Ignacio Pérez/ }))

    expect(
      (await screen.findAllByText(/no tiene una inscripción activa para imputar el pago/)).length,
    ).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Registrar Cobro' }))

    expect(await screen.findByText(/Faltan datos obligatorios/)).toHaveTextContent(
      'Inscripción a imputar',
    )
    expect(filas()).toHaveLength(6)
  })
})
