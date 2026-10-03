import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend } from '../test/support'

/**
 * Padrón de docentes (9.4).
 *
 * Las columnas se comparan contra la lista completa y en orden, y se verifica el caso que el
 * cliente pidió: el CUIL visible junto al DNI. El ítem deshabilitado de las clases dictadas se
 * comprueba con `disabled`, porque un ítem que "no navega" por no tener onclick y un ítem
 * deshabilitado son cosas distintas y el spec pide la segunda.
 */

const COLUMNAS = [
  'DOCENTE',
  'DNI',
  'CUIL',
  'EMAIL',
  'TELÉFONO',
  'CÁTEDRA O ESPECIALIDAD',
  'COMISIONES ASIGNADAS',
  'ESTADO',
]

const DOCENTES = [
  ['Profe Martín', '28.114.402', 'Programación', '1'],
  ['Lic. Laura Benítez', '31.902.118', 'Desarrollo Web', '1'],
  ['Santi Ads', '33.450.771', 'Marketing', '2'],
  ['Dr. Marcelo Ríos', '26.771.905', 'Datos', '1'],
  ['Ing. González', '30.665.330', 'Programación', '1'],
]

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  renderAppAs('ADMIN', '/admin/docentes')
  await screen.findByRole('heading', { name: 'Padrón de Docentes' })
  await screen.findByText('Profe Martín')
})

describe('listado de docentes', () => {
  it('muestra las columnas en el orden que fija el spec', () => {
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(COLUMNAS)
  })

  it('muestra los cinco docentes con su CUIL junto al DNI', () => {
    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1)

    expect(filas.map((fila) => fila.cells[0].textContent)).toEqual(
      DOCENTES.map(([nombre]) => nombre),
    )

    for (const [, dni] of DOCENTES) {
      const fila = filas.find((f) => f.cells[1].textContent === dni)
      expect(fila.cells[2].textContent).toMatch(/^\d{2}-\d{8}-\d$/)
    }
  })

  it('deja a Santi Ads con dos comisiones y a los otros con una', () => {
    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    const asignadas = (nombre) =>
      filas.find((fila) => fila.cells[0].textContent === nombre).cells[6].textContent

    expect(asignadas('Santi Ads')).toBe('2')
    expect(asignadas('Profe Martín')).toBe('1')
    expect(asignadas('Lic. Laura Benítez')).toBe('1')
    expect(asignadas('Dr. Marcelo Ríos')).toBe('1')
    expect(asignadas('Ing. González')).toBe('1')
  })

  it('muestra el estado Activa en verde en las cinco filas', () => {
    const estados = screen.getAllByText('Activa')

    expect(estados).toHaveLength(5)
    for (const estado of estados) {
      expect(estado.className).toContain('text-green-800')
    }
  })

  it('muestra los datos de contacto de cada docente', () => {
    const correo = 'profe.martin@techacademy.invalid'

    expect(screen.getByText(correo)).toBeInTheDocument()
    expect(screen.getByText('+54 11 4455-1020')).toBeInTheDocument()
  })

  it('no ofrece ningún control de edición de docente', () => {
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
  })
})

describe('buscador', () => {
  it('filtra el listado por nombre', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Buscar docente'), 'Santi')

    await waitFor(() => expect(screen.queryByText('Profe Martín')).not.toBeInTheDocument())
    expect(screen.getByText('Santi Ads')).toBeInTheDocument()
  })

  it('filtra por DNI', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Buscar docente'), '30.665.330')

    await waitFor(() => expect(screen.getByText('Ing. González')).toBeInTheDocument())
    expect(screen.queryByText('Santi Ads')).not.toBeInTheDocument()
  })

  it('informa que no encontró resultados', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Buscar docente'), 'Nadie con ese nombre')

    expect(await screen.findByText('No se encontraron resultados.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('acciones sin contenido detrás', () => {
  it('deja el alta de docente presente y sin formulario', () => {
    expect(screen.getByRole('button', { name: '+ Nuevo Docente' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('muestra el control de clases dictadas deshabilitado y con Próximamente', async () => {
    const user = userEvent.setup()

    const boton = screen.getByRole('button', { name: 'Control de clases dictadas' })
    expect(boton).toBeDisabled()
    expect(screen.getByText('Próximamente')).toBeInTheDocument()

    await user.click(boton)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})
