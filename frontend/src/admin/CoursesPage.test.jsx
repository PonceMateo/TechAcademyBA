import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend } from '../test/support'

/**
 * Cursos y comisiones (9.3).
 *
 * Las columnas se comparan contra la lista completa y en orden, porque el spec las fija literales
 * y en ese orden. Y la regla de la `Sede` se prueba en las dos direcciones: presencial sin sede no
 * guarda, virtual sin sede sí, que es lo que evita que la validación se convierta en un veto
 * generalizado que nadie entiende.
 */

const COLUMNAS = [
  'CÓDIGO',
  'CURSO / PROGRAMA',
  'DOCENTE',
  'HORARIO',
  'CUPO MÁX.',
  'VACANTES',
  'ARANCEL',
]

async function abrir() {
  resetDataSource()
  stubBackend()
  renderAppAs('ADMIN', '/admin/cursos')
  await screen.findByRole('heading', { name: 'Comisiones Activas' })
  await screen.findByText('CUR-101')
}

async function abrirModal(user) {
  await user.click(screen.getByRole('button', { name: '+ Nueva Comisión' }))
  await screen.findByRole('dialog', { name: 'Crear Nueva Comisión' })
}

beforeEach(async () => {
  await abrir()
})

describe('listado de comisiones', () => {
  it('muestra el chip del catálogo y la acción de alta', () => {
    expect(screen.getByText('10 en el catálogo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Nueva Comisión' })).toBeInTheDocument()
  })

  it('muestra las columnas en el orden que fija el spec', async () => {
    const encabezados = screen.getAllByRole('columnheader').map((th) => th.textContent)

    expect(encabezados).toEqual(COLUMNAS)
  })

  it('muestra las cinco comisiones del maquetado con su arancel formateado', async () => {
    const tabla = screen.getByRole('table')
    const filas = within(tabla).getAllByRole('row').slice(1)

    expect(filas.map((fila) => fila.cells[0].textContent)).toEqual([
      'CUR-101',
      'CUR-104',
      'CUR-108',
      'CUR-110',
      'CUR-103',
    ])
    expect(within(tabla).getByText('$45.000')).toBeInTheDocument()
    expect(within(tabla).getByText('$52.000')).toBeInTheDocument()
  })

  it('marca la comisión sin vacantes con el chip LLENO en rojo', async () => {
    const tabla = screen.getByRole('table')
    const filaLlena = within(tabla)
      .getAllByRole('row')
      .find((fila) => fila.cells[0].textContent === 'CUR-104')

    const chip = within(filaLlena).getByText('LLENO')
    expect(chip.className).toContain('text-red-800')
  })

  it('deja las otras comisiones con sus vacantes y sin chip', async () => {
    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    const vacantesDe = (codigo) =>
      filas.find((fila) => fila.cells[0].textContent === codigo).cells[5]

    // `VACANTES` es la sexta columna: el chip `LLENO` va dentro de la celda, al lado del 0.
    expect(vacantesDe('CUR-101').textContent).toBe('7')
    expect(vacantesDe('CUR-108').textContent).toBe('30')
    expect(vacantesDe('CUR-110').textContent).toBe('40')
    expect(vacantesDe('CUR-103').textContent).toBe('40')
    expect(within(screen.getByRole('table')).getAllByText('LLENO')).toHaveLength(1)
  })

  it('no ofrece ningún control de edición de comisión', () => {
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /modificar/i })).not.toBeInTheDocument()
  })
})

describe('modal de alta', () => {
  it('abre con los campos en el orden del spec y los dos botones', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    const etiquetas = screen
      .getAllByText(
        /^(Curso \/ Programa|Código Comisión|Docente Asignado|Días y Horarios|Cupo Máximo|Valor de Arancel de Comisión \(AR\$\)|Modalidad|Sede)\*?$/,
      )
      // El asterisco marca los campos obligatorios y va `aria-hidden`, así que el rótulo del
      // spec es el texto sin él.
      .map((elemento) => elemento.textContent.replace('*', ''))

    expect(etiquetas).toEqual([
      'Curso / Programa',
      'Código Comisión',
      'Docente Asignado',
      'Días y Horarios',
      'Cupo Máximo',
      'Valor de Arancel de Comisión (AR$)',
      'Modalidad',
      'Sede',
    ])

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar Comisión' })).toBeInTheDocument()
  })

  it('muestra los placeholders del prototipo', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    expect(screen.getByPlaceholderText('Ej: CUR-111')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Buscar docente…')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ej: Mar y Jue 19 a 21 hs')).toBeInTheDocument()
  })

  it('ofrece las tres modalidades del dominio', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    const opciones = within(screen.getByLabelText(/^Modalidad/))
      .getAllByRole('option')
      .map((opcion) => opcion.textContent)

    expect(opciones).toEqual(['Seleccionar…', 'Virtual', 'Presencial', 'Híbrido'])
  })

  it('no deja guardar una modalidad presencial sin sede', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await user.selectOptions(screen.getByLabelText(/^Modalidad/), 'PRESENCIAL')
    await user.selectOptions(screen.getByLabelText(/^Curso \/ Programa/), 'CUR-101')
    await user.type(screen.getByLabelText(/Código Comisión/), 'CUR-111')
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    expect(
      await screen.findByText('El campo Sede es obligatorio para modalidad Presencial o Híbrido.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Crear Nueva Comisión' })).toBeInTheDocument()
  })

  it('tampoco deja guardar una modalidad híbrida sin sede', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await user.selectOptions(screen.getByLabelText(/^Modalidad/), 'HIBRIDO')
    await user.selectOptions(screen.getByLabelText(/^Curso \/ Programa/), 'CUR-101')
    await user.type(screen.getByLabelText(/Código Comisión/), 'CUR-112')
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    expect(
      await screen.findByText('El campo Sede es obligatorio para modalidad Presencial o Híbrido.'),
    ).toBeInTheDocument()
  })

  it('acepta una modalidad virtual sin elegir sede', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await user.selectOptions(screen.getByLabelText(/^Modalidad/), 'VIRTUAL')
    await user.selectOptions(screen.getByLabelText(/^Curso \/ Programa/), 'CUR-101')
    await user.type(screen.getByLabelText(/Código Comisión/), 'CUR-113')
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Crear Nueva Comisión' }),
      ).not.toBeInTheDocument(),
    )
    expect(
      screen.getByText(
        'El maquetado no guarda nada todavía: el alta de comisiones llega con la historia #2.',
      ),
    ).toBeInTheDocument()
  })

  it('exige el código de la comisión', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await user.selectOptions(screen.getByLabelText(/^Modalidad/), 'VIRTUAL')
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    expect(await screen.findByText('El código de la comisión es obligatorio.')).toBeInTheDocument()
  })

  it('cierra sin guardar cuando se cancela', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Crear Nueva Comisión' }),
      ).not.toBeInTheDocument(),
    )
  })
})
