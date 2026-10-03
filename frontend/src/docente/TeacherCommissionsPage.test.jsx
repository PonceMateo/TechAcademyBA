import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend, stubDataSource } from '../test/support'
import { obtenerComisionesAsignadas } from '../services/dataService'

/**
 * Comisiones asignadas del docente (10.2).
 *
 * Lo que se verifica es el par de cosas que el spec ata entre sí: los tres indicadores tienen que
 * coincidir con el padrón de la única comisión, y los contadores tienen que hablar en singular o en
 * plural según la cantidad. El caso de los cuatro bloqueados no existe en los datos del cliente —la
 * comisión del maqueteado tiene uno— así que se renderiza con la fuente de datos sustituida, que es
 * para lo que existe: ver un estado que el ejemplo no tiene sin inventar filas de ejemplo.
 */

const COLUMNAS = ['CÓDIGO', 'CURSO', 'DOCENTE', 'HORARIO', 'PRÓXIMA CLASE', 'ACCESO']

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  renderAppAs('DOCENTE', '/docente')
  await screen.findByRole('heading', { name: 'Mis Comisiones' })
  await screen.findByText('CUR-101')
})

describe('indicadores', () => {
  it('muestra los cuatro indicadores con los rótulos del spec', () => {
    const rotulos = ['COMISIONES ACTIVAS', 'ALUMNOS HABILITADOS', 'BLOQUEADOS', 'PRÓXIMA CLASE']

    for (const rotulo of rotulos) {
      // El selector `p` desambigua: `PRÓXIMA CLASE` es también el título de una columna de la tabla.
      expect(screen.getByText(rotulo, { selector: 'p' })).toBeInTheDocument()
    }
  })

  it('muestra los valores que pide el spec', () => {
    expect(
      screen.getByText('COMISIONES ACTIVAS', { selector: 'p' }).parentElement,
    ).toHaveTextContent('1')
    expect(
      screen.getByText('ALUMNOS HABILITADOS', { selector: 'p' }).parentElement,
    ).toHaveTextContent('1')
    expect(screen.getByText('BLOQUEADOS', { selector: 'p' }).parentElement).toHaveTextContent('1')
    expect(screen.getByText('PRÓXIMA CLASE', { selector: 'p' }).parentElement).toHaveTextContent(
      'Hoy · 19:00',
    )
  })

  it('no muestra el avance de cursada, porque la fuente no declara cuántas clases tiene', () => {
    expect(screen.queryByText(/Clase \d+ de \d+/)).not.toBeInTheDocument()
  })
})

describe('comisiones asignadas', () => {
  it('muestra las columnas en el orden que fija el spec, con ACCESO y no RESTRICCIONES', () => {
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(COLUMNAS)
    expect(screen.queryByText('RESTRICCIONES')).not.toBeInTheDocument()
  })

  it('muestra una sola fila, la del cliente, sin completar el bloque', () => {
    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1)

    expect(filas).toHaveLength(1)
    expect(filas[0].cells[0]).toHaveTextContent('CUR-101')
    expect(filas[0].cells[1]).toHaveTextContent('Python Inicial')
    expect(filas[0].cells[2]).toHaveTextContent('Profe Martín')
    expect(filas[0].cells[3]).toHaveTextContent('Mar y Jue · 19 a 21 hs')
    expect(filas[0].cells[4]).toHaveTextContent('Hoy · 19:00')
  })

  it('muestra el habilitado en verde y el bloqueado en rojo', () => {
    const habilitado = screen.getByText('1 habilitado')
    const bloqueado = screen.getByText('1 bloqueado')

    expect(habilitado.className).toContain('green')
    expect(bloqueado.className).toContain('red')
  })
})

describe('singular y plural de los contadores', () => {
  /**
   * Renderiza la pantalla con una comisión que tiene cuatro de cada clase. La del ejemplo tiene una
   * de cada, así que sin sustituir la fuente el plural no llegaría a verse nunca.
   */
  async function renderCon(cantidades) {
    cleanup()
    const [comision] = await obtenerComisionesAsignadas()

    stubDataSource({
      obtenerComisionesAsignadas: async () => [{ ...comision, ...cantidades }],
    })
    renderAppAs('DOCENTE', '/docente')

    await screen.findByRole('heading', { name: 'Mis Comisiones' })
  }

  it('usa el plural cuando la cantidad no es uno', async () => {
    await renderCon({ habilitados: 4, bloqueados: 4 })

    // El encabezado se dibuja antes de que lleguen las comisiones: hay que esperar al dato.
    expect(await screen.findByText('4 habilitados')).toBeInTheDocument()
    expect(screen.getByText('4 bloqueados')).toBeInTheDocument()
  })

  it('usa el singular cuando la cantidad es uno', () => {
    expect(screen.getByText('1 habilitado')).toBeInTheDocument()
    expect(screen.queryByText('1 habilitados')).not.toBeInTheDocument()
  })

  it('usa el plural con cero, porque en español el cero no es singular', async () => {
    await renderCon({ habilitados: 0, bloqueados: 0 })

    await waitFor(() => expect(screen.getByText('0 bloqueados')).toBeInTheDocument())
  })
})
