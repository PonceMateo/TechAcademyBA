import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend } from '../test/support'

/**
 * Alumnos e inscripciones (9.5).
 *
 * Lo que se prueba es lo que el prototipo no tenía: las cuatro categorías con su color y los dos
 * bloqueos con su causa. Si la causa no aparece al lado del estado, la pantalla vuelve a ser la del
 * prototipo y el cliente pierde la diferencia entre "no pagó" y "no se pudo leer el comprobante".
 */

const COLUMNAS_ALUMNOS = [
  'DNI',
  'NOMBRE',
  'EMAIL',
  'COMISIÓN ASIGNADA',
  'CATEGORÍA ARANCELARIA',
  'ACCESO PLATAFORMA',
]

const COLUMNAS_EMPRESAS = ['RAZÓN SOCIAL', 'CUIT', 'PREFERENCIA FACTURA', 'NÓMINA DE EMPLEADOS']

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  renderAppAs('ADMIN', '/admin/alumnos')
  await screen.findByRole('heading', { name: 'Padrón de Alumnos Regulares' })
  await screen.findByText('Juan Ignacio Pérez')
})

function tablaAlumnos() {
  // La pantalla tiene dos tablas: el padrón de alumnos y las cuentas corporativas. Se toma la
  // primera, que es la del padrón.
  return screen.getAllByRole('table')[0]
}

function filaDe(nombre) {
  return within(tablaAlumnos())
    .getAllByRole('row')
    .find((fila) => fila.cells[1].textContent === nombre)
}

describe('padrón de alumnos', () => {
  it('muestra el buscador con el placeholder del spec', () => {
    expect(screen.getByPlaceholderText('Buscar por DNI o Nombre…')).toBeInTheDocument()
  })

  it('muestra las columnas en el orden que fija el spec', () => {
    const [primeraTabla] = screen.getAllByRole('table')

    expect(
      within(primeraTabla)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(COLUMNAS_ALUMNOS)
  })

  it('muestra las seis filas del maquetado', () => {
    expect(
      within(tablaAlumnos())
        .getAllByRole('row')
        .slice(1)
        .map((fila) => fila.cells[1].textContent),
    ).toEqual([
      'Juan Ignacio Pérez',
      'Camila Rodríguez',
      'Matías Fernández',
      'Nicolás Castro',
      'Agustina Benítez',
      'Valeria Rossi',
    ])
  })

  it('deja el documento del alumno del exterior tal como lo registra el cliente', () => {
    expect(filaDe('Nicolás Castro').cells[0]).toHaveTextContent('Sin DNI (alumno exterior)')
  })

  it('muestra la categoría con su color', () => {
    expect(filaDe('Juan Ignacio Pérez').cells[4].textContent).toContain('PARTICULAR')
    expect(filaDe('Juan Ignacio Pérez').cells[4].querySelector('.text-slate-700')).not.toBeNull()
    expect(filaDe('Agustina Benítez').cells[4].textContent).toContain('BECADO PARCIAL')
    expect(filaDe('Agustina Benítez').cells[4].querySelector('.text-violet-800')).not.toBeNull()
  })

  it('muestra el porcentaje de descuento del becado parcial', () => {
    expect(filaDe('Camila Rodríguez').cells[4]).toHaveTextContent('50% de descuento')
    expect(filaDe('Agustina Benítez').cells[4]).toHaveTextContent('50% de descuento')
  })

  it('deja las categorías con colores distintos entre sí', () => {
    // BECADO TOTAL y CORPORATIVO son del enum y del spec, pero el padrón del maquetado no tiene
    // filas de esas dos. Lo verificable acá es que las dos que aparecen no comparten color.
    const colorDe = (nombre) => {
      const insignia = filaDe(nombre).cells[4].querySelector('[data-ui="badge"]')
      return insignia.className
    }

    expect(colorDe('Juan Ignacio Pérez')).toContain('text-slate-700')
    expect(colorDe('Agustina Benítez')).toContain('text-violet-800')
    expect(colorDe('Juan Ignacio Pérez')).not.toBe(colorDe('Agustina Benítez'))
  })

  it('muestra HABILITADO en verde para los cuatro accesos al día', () => {
    const habilitados = screen.getAllByText('HABILITADO')

    expect(habilitados).toHaveLength(4)
    for (const habilitado of habilitados) {
      expect(habilitado.className).toContain('text-green-800')
    }
  })

  it('muestra cada bloqueo con su causa al lado del estado', () => {
    const bloqueos = screen.getAllByText('BLOQUEADO')

    expect(bloqueos).toHaveLength(2)
    for (const bloqueo of bloqueos) {
      expect(bloqueo.className).toContain('text-red-800')
    }

    expect(filaDe('Agustina Benítez').cells[5]).toHaveTextContent('comprobante ilegible')
    expect(filaDe('Valeria Rossi').cells[5]).toHaveTextContent('debe saldo')
  })

  it('informa que la búsqueda no arrojó resultados', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Buscar alumno'), 'DNI que no existe')

    expect(await screen.findByText('No se encontraron resultados.')).toBeInTheDocument()
  })

  it('filtra por nombre', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Buscar alumno'), 'Valeria')

    await waitFor(() => expect(screen.queryByText('Juan Ignacio Pérez')).not.toBeInTheDocument())
    expect(screen.getByText('Valeria Rossi')).toBeInTheDocument()
  })
})

describe('cuentas corporativas', () => {
  it('muestra las columnas del bloque, en el orden del spec', () => {
    const [, segundaTabla] = screen.getAllByRole('table')

    expect(
      within(segundaTabla)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(COLUMNAS_EMPRESAS)
  })

  it('muestra las dos cuentas con su CUIT y el badge de factura A', () => {
    expect(screen.getByText('Tech Solutions S.A.')).toBeInTheDocument()
    expect(screen.getByText('Banco Federal (Capacitaciones)')).toBeInTheDocument()
    expect(screen.getByText('30-71665544-9')).toBeInTheDocument()
    expect(screen.getByText('30-50001234-4')).toBeInTheDocument()
    expect(screen.getAllByText('A')).toHaveLength(2)
  })

  it('aclara en la nómina de cada empresa lo que falta', () => {
    expect(
      screen.getByText(
        'Grupo 5 (Data Analytics) y Grupo 2 (Python Inicial), segunda tanda de empleados',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('10 personas, falta enviar la nómina')).toBeInTheDocument()
  })
})
