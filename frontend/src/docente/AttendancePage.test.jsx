import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend } from '../test/support'

/**
 * Asistencia de la clase del día (10.4).
 *
 * Se verifican las dos mitades del requisito: las columnas por clase con los rótulos del spec —y que
 * las fechas correspondan a los días que la comisión declara— y que la única editable sea la del día
 * corriente. Lo segundo se comprueba contando los selectores y mirando que ninguno esté en una
 * columna anterior.
 */

const COLUMNAS = ['ALUMNO', 'MAR 12/05', 'JUE 14/05', 'HOY · JUE 21/05']

async function entrar() {
  resetDataSource()
  stubBackend()
  renderAppAs('DOCENTE', '/docente/asistencia')
  await screen.findByRole('heading', { name: 'Asistencia' })
  await screen.findByText('Juan Ignacio Pérez')
}

// La flecha es necesaria: `beforeEach(entrar)` le pasaría a `entrar` el contexto del test como ruta.
beforeEach(() => entrar())

describe('encabezado de la pantalla', () => {
  it('muestra el chip de la comisión y el botón de guardado', () => {
    expect(screen.getByText('CUR-101 · Python Inicial')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar asistencia' })).toBeInTheDocument()
  })

  it('muestra la barra de la sesión con el día y el horario de la comisión', () => {
    // La comisión imparte martes y jueves, y la clase del ejemplo es un jueves.
    expect(screen.getByText('Jueves · 19 a 21 hs')).toBeInTheDocument()
  })

  it('muestra los contadores de presentes y ausentes del día', () => {
    expect(screen.getByText('1 presente · 1 ausente')).toBeInTheDocument()
  })

  it('no muestra un contador de avance de cursada, porque el cliente no lo declara', () => {
    expect(screen.queryByText(/Clase \d+ de \d+/)).not.toBeInTheDocument()
  })
})

describe('tabla de asistencia', () => {
  it('muestra las columnas en el orden que fija el spec', () => {
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(COLUMNAS)
  })

  it('muestra las dos filas del padrón de CUR-101', () => {
    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1)

    expect(filas.map((fila) => fila.cells[0].textContent)).toEqual([
      'Juan Ignacio Pérez',
      'Agustina Benítez',
    ])
  })

  it('muestra las clases ya dictadas como texto, sin control', () => {
    const fila = within(screen.getByRole('table'))
      .getAllByRole('row')
      .find((candidata) => candidata.cells[0].textContent === 'Juan Ignacio Pérez')

    expect(within(fila.cells[1]).queryByRole('combobox')).not.toBeInTheDocument()
    expect(within(fila.cells[2]).queryByRole('combobox')).not.toBeInTheDocument()
    expect(within(fila.cells[1]).getByText('Ausente')).toBeInTheDocument()
  })
})

describe('la columna del día', () => {
  it('es la única editable: hay un selector por alumno y solo en la última columna', () => {
    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    const selectores = screen.getAllByRole('combobox')

    expect(selectores).toHaveLength(filas.length)

    for (const fila of filas) {
      const celdas = within(fila).getAllByRole('cell')
      expect(within(celdas[celdas.length - 1]).getByRole('combobox')).toBeInTheDocument()
    }
  })

  it('recalcula los contadores de la barra cuando el docente marca un ausente', async () => {
    const user = userEvent.setup()

    await user.selectOptions(
      screen.getByRole('combobox', { name: /Asistencia de Juan Ignacio Pérez/ }),
      'AUSENTE',
    )

    await waitFor(() => expect(screen.getByText('0 presentes · 2 ausentes')).toBeInTheDocument())
  })

  it('no cambia el estado de habilitación de ningún alumno al guardar', async () => {
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Guardar asistencia' }))

    expect(
      await screen.findByText('Asistencia del día guardada en el maquetado.'),
    ).toBeInTheDocument()
    // La pantalla no dice una palabra sobre habilitación: el acceso lo decide la secretaría con el
    // comprobante del alumno, no una lista de asistencia.
    expect(screen.queryByText(/habilit/i)).not.toBeInTheDocument()
  })
})
