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
  'ACCIONES',
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

describe('edición del estado de una cobranza', () => {
  /** Abre el modal de la fila de esa fecha y devuelve el diálogo. */
  async function abrirEdicion(user, fecha) {
    const fila = filas().find((candidata) => candidata.cells[0].textContent === fecha)
    await user.click(within(fila).getByRole('button', { name: 'Editar estado' }))
    return screen.getByRole('dialog', { name: 'Editar estado de la cobranza' })
  }

  async function completarJustificacion(user) {
    await user.selectOptions(screen.getByLabelText(/Nuevo estado/), 'ACREDITADO')
    await user.type(
      screen.getByLabelText(/Justificación del cambio/),
      'El banco confirmó la acreditación.',
    )
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
  }

  it('ofrece Editar estado en todas las filas del historial', () => {
    const tabla = within(screen.getByRole('table'))

    expect(tabla.getAllByRole('button', { name: 'Editar estado' })).toHaveLength(6)
  })

  it('ofrece solo los destinos válidos según el estado actual', async () => {
    const user = userEvent.setup()

    const observada = await abrirEdicion(user, '21/05/2026')
    expect(
      within(observada)
        .getAllByRole('option')
        .map((opcion) => opcion.textContent),
    ).toEqual(['Seleccionar…', 'ACREDITADO', 'RECHAZADO'])

    await user.click(within(observada).getByRole('button', { name: 'Cancelar' }))

    const acreditada = await abrirEdicion(user, '10/05/2026')
    expect(
      within(acreditada)
        .getAllByRole('option')
        .map((opcion) => opcion.textContent),
    ).toEqual(['Seleccionar…', 'OBSERVADO', 'RECHAZADO'])
  })

  it('abre un modal con el titular, el alumno imputado, el importe, la fecha y el estado', async () => {
    const user = userEvent.setup()

    const dialogo = await abrirEdicion(user, '16/05/2026')

    expect(within(dialogo).getByText('Banco Federal')).toBeInTheDocument()
    expect(within(dialogo).getByText('Sin imputar')).toBeInTheDocument()
    expect(within(dialogo).getByText('$390.000')).toBeInTheDocument()
    expect(within(dialogo).getByText('16/05/2026')).toBeInTheDocument()
    expect(within(dialogo).getAllByText('OBSERVADO').length).toBeGreaterThan(0)
  })

  it('exige la justificación y pide confirmación antes de guardar', async () => {
    const user = userEvent.setup()
    const dialogo = await abrirEdicion(user, '21/05/2026')
    const continuar = within(dialogo).getByRole('button', { name: 'Continuar' })

    expect(continuar).toBeDisabled()

    await user.selectOptions(screen.getByLabelText(/Nuevo estado/), 'ACREDITADO')
    expect(continuar).toBeDisabled()

    await user.type(screen.getByLabelText(/Justificación del cambio/), 'Se acreditó el cheque.')
    expect(continuar).toBeEnabled()

    await user.click(continuar)

    expect(within(dialogo).getByText(/Vas a pasar la cobranza de/)).toBeInTheDocument()
    expect(within(dialogo).getByText('Se acreditó el cheque.')).toBeInTheDocument()

    const sinCambios = filas().find((fila) => fila.cells[0].textContent === '21/05/2026')
    expect(sinCambios.cells[6]).toHaveTextContent('OBSERVADO')
  })

  it('actualiza la fila del historial con la respuesta del backend', async () => {
    const user = userEvent.setup()

    await abrirEdicion(user, '16/05/2026')
    await completarJustificacion(user)
    await user.click(screen.getByRole('button', { name: 'Confirmar y guardar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const actualizada = filas().find((fila) => fila.cells[0].textContent === '16/05/2026')
    expect(actualizada.cells[6]).toHaveTextContent('ACREDITADO')
    expect(within(actualizada).getByRole('button', { name: 'Editar estado' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Estado actualizado a Acreditado.')
    expect(screen.getByRole('status')).not.toHaveTextContent('Se registró el cobro')
  })

  it('corrige una cobranza acreditada por error y muestra la causa del rechazo', async () => {
    const user = userEvent.setup()

    await abrirEdicion(user, '10/05/2026')
    await user.selectOptions(screen.getByLabelText(/Nuevo estado/), 'RECHAZADO')
    await user.type(
      screen.getByLabelText(/Justificación del cambio/),
      'El banco devolvió la transferencia.',
    )
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar y guardar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const actualizada = filas().find((fila) => fila.cells[0].textContent === '10/05/2026')
    expect(actualizada.cells[6]).toHaveTextContent('RECHAZADO')
    expect(actualizada.cells[6]).toHaveTextContent('El banco devolvió la transferencia.')
    expect(screen.getByRole('status')).toHaveTextContent('Estado actualizado a Rechazado.')
    expect(screen.getByRole('status')).not.toHaveTextContent('Se registró el cobro')

    cleanup()
    renderAppAs('ADMIN', '/admin/cobranzas')
    await screen.findByText('10/05/2026')

    const recargada = filas().find((fila) => fila.cells[0].textContent === '10/05/2026')
    expect(recargada.cells[6]).toHaveTextContent('RECHAZADO')
  })

  it('avisa el estado nuevo y no habla de un cobro registrado', async () => {
    const user = userEvent.setup()

    await abrirEdicion(user, '10/05/2026')
    await user.selectOptions(screen.getByLabelText(/Nuevo estado/), 'OBSERVADO')
    await user.type(
      screen.getByLabelText(/Justificación del cambio/),
      'El comprobante llegó ilegible.',
    )
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar y guardar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const aviso = screen.getByRole('status')
    expect(aviso).toHaveTextContent('Estado actualizado a Observado.')
    expect(aviso).not.toHaveTextContent('Se registró')
    expect(aviso).not.toHaveTextContent('Se acreditó')
  })

  it('conserva el estado nuevo después de recargar la pantalla', async () => {
    const user = userEvent.setup()

    await abrirEdicion(user, '21/05/2026')
    await completarJustificacion(user)
    await user.click(screen.getByRole('button', { name: 'Confirmar y guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    cleanup()
    renderAppAs('ADMIN', '/admin/cobranzas')
    await screen.findByText('10/05/2026')

    const recargada = filas().find((fila) => fila.cells[0].textContent === '21/05/2026')
    expect(recargada.cells[6]).toHaveTextContent('ACREDITADO')
  })

  it('muestra el error del backend y no cambia la fila', async () => {
    stubDataSource({
      actualizarEstadoCobranza: async () => {
        throw new Error('La cobranza ya está acreditada.')
      },
    })
    const user = userEvent.setup()

    await abrirEdicion(user, '19/05/2026')
    await completarJustificacion(user)
    await user.click(screen.getByRole('button', { name: 'Confirmar y guardar' }))

    expect(await screen.findByText('La cobranza ya está acreditada.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    const sinCambios = filas().find((fila) => fila.cells[0].textContent === '19/05/2026')
    expect(sinCambios.cells[6]).toHaveTextContent('OBSERVADO')
  })
})

/**
 * HU 23: una cobranza se reparte entre varios alumnos o queda sin imputar, y el saldo se imputa
 * después desde el historial. La cobranza es una sola en todos los casos.
 */
describe('HU 23: distribución entre varios alumnos', () => {
  async function cargarDatosBase(user, importe = '120000') {
    await user.type(screen.getByLabelText(/Fecha Pago/), '2026-06-01')
    await user.type(screen.getByLabelText(/Importe Cobrado/), importe)
    await user.selectOptions(screen.getByLabelText(/Medio de Pago/), 'EFECTIVO')
    await user.type(screen.getByLabelText(/Titular del Comprobante/), 'Familiar de los tres')
  }

  const JUAN = { busqueda: 'Juan', nombre: 'Juan Ignacio Pérez' }
  const CAMILA = { busqueda: 'Camila', nombre: 'Camila Rodríguez' }
  const VALERIA = { busqueda: 'Valeria', nombre: 'Valeria Rossi' }

  /** El buscador de la fila filtra al escribir y la coincidencia se elige en la misma lista. */
  async function elegirAlumno(user, indice, alumno) {
    await user.type(screen.getByLabelText(new RegExp(`Alumno ${indice}`)), alumno.busqueda)
    await user.click(await screen.findByRole('option', { name: new RegExp(alumno.nombre) }))
  }

  async function escribirMonto(user, indice, monto) {
    await user.type(screen.getAllByLabelText(/Importe imputado/)[indice - 1], String(monto))
  }

  async function agregarFila(user, indice, alumno, monto) {
    await user.click(screen.getByRole('button', { name: 'Agregar otro alumno' }))
    await elegirAlumno(user, indice, alumno)
    await escribirMonto(user, indice, monto)
  }

  async function completarDosAlumnos(user, montos = [50000, 70000], alumnos = [JUAN, CAMILA]) {
    await user.click(screen.getByLabelText('Varios alumnos'))
    await cargarDatosBase(user)
    await elegirAlumno(user, 1, alumnos[0])
    await elegirAlumno(user, 2, alumnos[1])
    await escribirMonto(user, 1, montos[0])
    await escribirMonto(user, 2, montos[1])
  }

  it('arranca con dos filas y no habilita el registro hasta completar dos alumnos distintos', async () => {
    const user = userEvent.setup()

    await user.click(screen.getByLabelText('Varios alumnos'))
    await cargarDatosBase(user)

    expect(screen.getAllByLabelText(/Alumno \d/)).toHaveLength(2)
    const registrar = screen.getByRole('button', { name: 'Registrar Cobro' })
    expect(registrar).toBeDisabled()

    await elegirAlumno(user, 1, JUAN)
    await escribirMonto(user, 1, 50000)
    expect(registrar).toBeDisabled()

    // El mismo alumno dos veces no es un reparto.
    await elegirAlumno(user, 2, JUAN)
    await escribirMonto(user, 2, 70000)
    expect(screen.getByText('Cada alumno tiene que ser distinto.')).toBeInTheDocument()
    expect(registrar).toBeDisabled()

    await user.click(
      within(screen.getByRole('group', { name: 'Alumno 2' })).getByRole('button', {
        name: 'Cambiar',
      }),
    )
    await elegirAlumno(user, 2, CAMILA)
    expect(registrar).toBeEnabled()
  })

  it('busca al alumno de cada fila por nombre, DNI o email', async () => {
    const user = userEvent.setup()

    await user.click(screen.getByLabelText('Varios alumnos'))
    await cargarDatosBase(user)
    await elegirAlumno(user, 1, { busqueda: '36.778.990', nombre: 'Valeria Rossi' })
    await elegirAlumno(user, 2, { busqueda: 'cami_rod@hotmail.com', nombre: 'Camila Rodríguez' })

    expect(
      within(screen.getByRole('group', { name: 'Alumno 1' })).getByText('Valeria Rossi'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('group', { name: 'Alumno 2' })).getByText('Camila Rodríguez'),
    ).toBeInTheDocument()

    await escribirMonto(user, 1, 60000)
    await escribirMonto(user, 2, 60000)
    expect(screen.getByRole('button', { name: 'Registrar Cobro' })).toBeEnabled()
  })

  it('reparte $120.000 entre tres alumnos en una sola cobranza', async () => {
    const user = userEvent.setup()

    await completarDosAlumnos(user, [50000, 40000])
    await agregarFila(user, 3, VALERIA, 30000)

    expect(screen.getByText('Distribuido').closest('dl')).toHaveTextContent('Sin imputar$0')

    await user.click(screen.getByRole('button', { name: 'Registrar Cobro' }))

    await waitFor(() => expect(filas()).toHaveLength(7))
    expect(filas()[0].cells[2]).toHaveTextContent('Juan Ignacio Pérez +2')
    expect(filas()[0].cells[5]).toHaveTextContent('$120.000')
    expect(screen.getByRole('status')).toHaveTextContent('Se registró el cobro del 01/06/2026.')
  })

  it('permite quitar filas y una distribución parcial pide confirmación', async () => {
    const user = userEvent.setup()

    await completarDosAlumnos(user, [50000, 20000])

    expect(screen.getByText('Distribuido').closest('dl')).toHaveTextContent('Sin imputar$50.000')
    expect(screen.getByText(/Quedan \$50\.000 sin imputar/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Registrar Cobro' }))
    expect(filas()).toHaveLength(6)
    expect(screen.getByText(/¿Registrar la cobranza/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Volver' }))
    expect(screen.queryByText(/¿Registrar la cobranza/)).not.toBeInTheDocument()
    expect(filas()).toHaveLength(6)

    await user.click(screen.getByRole('button', { name: 'Registrar Cobro' }))
    await user.click(screen.getByRole('button', { name: 'Sí, registrar con saldo pendiente' }))

    await waitFor(() => expect(filas()).toHaveLength(7))
    expect(filas()[0].cells[2]).toHaveTextContent('Juan Ignacio Pérez +1')
  })

  it('no deja repartir más que el importe cobrado', async () => {
    const user = userEvent.setup()

    await completarDosAlumnos(user, [100000, 30000])

    expect(screen.getByRole('button', { name: 'Registrar Cobro' })).toBeDisabled()
    expect(screen.getByText(/supera el importe recibido en \$10\.000/)).toBeInTheDocument()
    expect(filas()).toHaveLength(6)
  })

  it('muestra los alumnos y los importes en el detalle del historial', async () => {
    const user = userEvent.setup()

    await completarDosAlumnos(user, [50000, 70000])
    await user.click(screen.getByRole('button', { name: 'Registrar Cobro' }))
    await waitFor(() => expect(filas()).toHaveLength(7))

    const nueva = filas()[0]
    await user.click(within(nueva).getByRole('button', { name: 'Ver imputaciones' }))

    const detalle = screen.getByText('Importe total').closest('dl').parentElement
    expect(detalle).toHaveTextContent('Juan Ignacio Pérez')
    expect(detalle).toHaveTextContent('$50.000')
    expect(detalle).toHaveTextContent('Camila Rodríguez')
    expect(detalle).toHaveTextContent('$70.000')
    expect(within(detalle).getByText('Total imputado').closest('div')).toHaveTextContent('$120.000')
    expect(within(detalle).getByText('Saldo disponible').closest('div')).toHaveTextContent('$0')

    // Con saldo $0 se puede consultar, pero no hay nada más que imputar.
    expect(
      within(nueva).queryByRole('button', { name: 'Agregar imputación' }),
    ).not.toBeInTheDocument()

    await user.click(within(nueva).getByRole('button', { name: 'Ocultar detalle' }))
    expect(screen.queryByText('Importe total')).not.toBeInTheDocument()
  })

  it('registra sin imputar y después reparte el saldo desde el historial', async () => {
    const user = userEvent.setup()

    await user.click(screen.getByLabelText('Sin imputar'))
    await cargarDatosBase(user)
    await user.click(screen.getByRole('button', { name: 'Registrar Cobro' }))
    await waitFor(() => expect(filas()).toHaveLength(7))
    expect(filas()[0].cells[2]).toHaveTextContent('')

    await user.click(within(filas()[0]).getByRole('button', { name: 'Agregar imputación' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('Todavía no tiene imputaciones.')).toBeInTheDocument()
    expect(within(dialogo).getByText('Saldo sin imputar').closest('div')).toHaveTextContent(
      '$120.000',
    )

    await user.click(within(dialogo).getByRole('button', { name: 'Agregar alumno' }))
    await user.type(within(dialogo).getByLabelText(/Alumno 1/), 'Juan')
    await user.click(await within(dialogo).findByRole('option', { name: /Juan Ignacio Pérez/ }))
    await user.type(within(dialogo).getByLabelText(/Importe imputado/), '70000')
    await user.click(within(dialogo).getByRole('button', { name: 'Imputar saldo' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(filas()[0].cells[2]).toHaveTextContent('Juan Ignacio Pérez')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Se agregó una imputación a la cobranza del 01/06/2026.',
    )

    await user.click(within(filas()[0]).getByRole('button', { name: 'Agregar imputación' }))
    const reabierto = await screen.findByRole('dialog')
    expect(within(reabierto).getByText('Juan Ignacio Pérez')).toBeInTheDocument()
    expect(within(reabierto).getByText('Imputado').closest('div')).toHaveTextContent('$70.000')
    expect(within(reabierto).getByText('Saldo sin imputar').closest('div')).toHaveTextContent(
      '$50.000',
    )
  })

  it('reparte en partes iguales con el botón', async () => {
    const user = userEvent.setup()

    await completarDosAlumnos(user, [0, 0])
    await user.click(screen.getByRole('button', { name: 'Distribuir en partes iguales' }))

    expect(screen.getAllByLabelText(/Importe imputado/).map((campo) => campo.value)).toEqual([
      '60000',
      '60000',
    ])
    expect(screen.getByText('Distribuido').closest('dl')).toHaveTextContent('Sin imputar$0')
  })

  it('no ofrece imputar una cobranza que ya está completa', async () => {
    await screen.findByText('10/05/2026')
    const completa = filas().find((fila) => fila.cells[0].textContent === '10/05/2026')

    expect(
      within(completa).queryByRole('button', { name: 'Agregar imputación' }),
    ).not.toBeInTheDocument()
  })

  it('solo ofrece ver el detalle cuando hay varios alumnos imputados', async () => {
    await screen.findByText('10/05/2026')
    const unAlumno = filas().find((fila) => fila.cells[0].textContent === '10/05/2026')
    const sinImputar = filas().find((fila) => fila.cells[0].textContent === '16/05/2026')

    expect(
      within(unAlumno).queryByRole('button', { name: 'Ver imputaciones' }),
    ).not.toBeInTheDocument()
    expect(
      within(sinImputar).queryByRole('button', { name: 'Ver imputaciones' }),
    ).not.toBeInTheDocument()

    const user = userEvent.setup()
    await completarDosAlumnos(user, [50000, 70000])
    await user.click(screen.getByRole('button', { name: 'Registrar Cobro' }))
    await waitFor(() => expect(filas()).toHaveLength(7))

    expect(within(filas()[0]).getByRole('button', { name: 'Ver imputaciones' })).toBeInTheDocument()
  })
})

/**
 * Un comprobante que se registró sin titular queda como "Sin identificar". Desde `Editar estado`
 * se puede completar sin necesidad de cambiar el estado; un titular ya identificado no se edita.
 */
describe('completar el titular desde Editar estado', () => {
  async function registrarSinTitular(user) {
    await user.type(screen.getByLabelText(/Fecha Pago/), '2026-06-02')
    await user.type(screen.getByLabelText(/Importe Cobrado/), '15000')
    await user.selectOptions(screen.getByLabelText(/Medio de Pago/), 'EFECTIVO')
    await user.click(screen.getByRole('button', { name: 'Registrar Cobro' }))
    await waitFor(() => expect(filas()).toHaveLength(7))
  }

  it('permite completar el titular sin cambiar el estado', async () => {
    const user = userEvent.setup()
    await registrarSinTitular(user)

    expect(filas()[0].cells[1]).toHaveTextContent('Sin identificar')

    await user.click(within(filas()[0]).getByRole('button', { name: 'Editar estado' }))
    const dialogo = screen.getByRole('dialog', { name: 'Editar estado de la cobranza' })
    const continuar = within(dialogo).getByRole('button', { name: 'Continuar' })

    // No hace falta elegir estado ni escribir una justificación: alcanza con el titular.
    await user.type(within(dialogo).getByLabelText(/Titular del comprobante/), 'María López')
    expect(continuar).toBeEnabled()
    await user.click(continuar)

    expect(
      within(dialogo).getByText('No vas a cambiar el estado de la cobranza.'),
    ).toBeInTheDocument()
    expect(within(dialogo).getByText(/Vas a completar el titular como/)).toBeInTheDocument()
    expect(within(dialogo).queryByText(/Justificación:/)).not.toBeInTheDocument()

    await user.click(within(dialogo).getByRole('button', { name: 'Confirmar y guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(screen.getByRole('status')).toHaveTextContent('Se completó el titular del comprobante.')
    expect(filas()[0].cells[1]).toHaveTextContent('María López')
    expect(filas()[0].cells[6]).toHaveTextContent('ACREDITADO')

    // Ya identificado, el modal vuelve a mostrar el titular como dato de solo lectura.
    await user.click(within(filas()[0]).getByRole('button', { name: 'Editar estado' }))
    const reabierto = screen.getByRole('dialog', { name: 'Editar estado de la cobranza' })
    expect(within(reabierto).queryByLabelText(/Titular del comprobante/)).not.toBeInTheDocument()
    expect(within(reabierto).getByText('María López')).toBeInTheDocument()
  })

  it('no ofrece editar el titular de una cobranza ya identificada', async () => {
    const user = userEvent.setup()
    const fila = filas().find((candidata) => candidata.cells[0].textContent === '10/05/2026')

    await user.click(within(fila).getByRole('button', { name: 'Editar estado' }))
    const dialogo = screen.getByRole('dialog', { name: 'Editar estado de la cobranza' })

    expect(within(dialogo).queryByLabelText(/Titular del comprobante/)).not.toBeInTheDocument()
    expect(within(dialogo).getByText('Titular del pago').closest('div')).toHaveTextContent(
      'Juan Ignacio Pérez',
    )
  })
})
