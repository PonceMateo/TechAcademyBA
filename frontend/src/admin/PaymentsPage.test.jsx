import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend } from '../test/support'

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

  it('explica que el pagador y el beneficiario son cosas distintas', () => {
    expect(screen.getByText(/no se agrega al padrón de alumnos/)).toBeInTheDocument()
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
    await user.selectOptions(screen.getByLabelText(/Alumno a Imputar Pago/), '1')
    await user.click(screen.getByRole('button', { name: 'Registrar Cobro' }))

    await waitFor(() => expect(filas()).toHaveLength(7))
    const nueva = filas()[0]

    expect(nueva.cells[0]).toHaveTextContent('01/06/2026')
    expect(nueva.cells[1]).toHaveTextContent('Juan Ignacio Pérez')
    expect(nueva.cells[2]).toHaveTextContent('Juan Ignacio Pérez')
    expect(nueva.cells[3]).toHaveTextContent('Efectivo')
    expect(nueva.cells[5]).toHaveTextContent('$45.000')
    expect(nueva.cells[6]).toHaveTextContent('ACREDITADO')
  })

  it('filtra el alumno a imputar con su propio buscador', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Buscar alumno para imputar'), 'Valeria')

    const opciones = within(screen.getByLabelText(/Alumno a Imputar Pago/))
      .getAllByRole('option')
      .map((opcion) => opcion.textContent)

    expect(opciones).toEqual(['Seleccionar…', 'Valeria Rossi'])
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
