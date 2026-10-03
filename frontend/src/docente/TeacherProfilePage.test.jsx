import { cleanup, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend } from '../test/support'
import { TITULO_MENU } from './navegacion'

/**
 * Perfil del docente (10.5).
 *
 * La pantalla se verifica por lo que **no** tiene: un campo editable o un botón de guardado
 * convertirían un perfil de solo lectura en un formulario que no guarda nada. Y el ítem de notas y
 * certificación se verifica por lo que tampoco tiene: no hay ruta detrás, así que la comprobación
 * fuerte es pedir esa dirección y ver el 404.
 */

const COLUMNAS = ['CÓDIGO', 'CURSO', 'HORARIO', 'ESTADO']

async function entrar(ruta = '/docente/perfil') {
  resetDataSource()
  stubBackend()
  renderAppAs('DOCENTE', ruta)
  await screen.findByRole('heading', { name: 'Mi Perfil' })
  // El encabezado se dibuja antes de que lleguen los datos: esperar la especialidad espera de
  // verdad a que el perfil se haya cargado.
  await screen.findByText('Programación')
}

// La flecha es necesaria: `beforeEach(entrar)` le pasaría a `entrar` el contexto del test como ruta.
beforeEach(() => entrar())

describe('tarjeta de identidad', () => {
  it('muestra el avatar, el nombre, el chip de permisos y la nota', () => {
    // El nombre también está en el pie del shell: se afirma sobre la tarjeta de identidad para no
    // depender de cuál de los dos encuentra la consulta.
    const identidad = within(screen.getByRole('heading', { name: 'Identidad' }).closest('section'))

    expect(identidad.getByText('PM')).toBeInTheDocument()
    expect(identidad.getByText('Profe Martín')).toBeInTheDocument()
    expect(identidad.getByText('DOCENTE · PERMISOS REDUCIDOS')).toBeInTheDocument()
    expect(
      identidad.getByText('Los cambios administrativos deben solicitarse a Secretaría BA.'),
    ).toBeInTheDocument()
  })
})

describe('datos de contacto', () => {
  it('muestra la especialidad y la sede de referencia', () => {
    expect(screen.getByText('Especialidad')).toBeInTheDocument()
    expect(screen.getByText('Programación')).toBeInTheDocument()
    expect(screen.getByText('Sede de referencia')).toBeInTheDocument()
    expect(screen.getByText('Sede Constituciones')).toBeInTheDocument()
  })

  it('no muestra correo ni teléfono, porque el cliente no los registra para los docentes', () => {
    // Los dos datos existen en el padrón de docentes y esta pantalla no los inventa.
    expect(screen.queryByText('profe.martin@techacademy.invalid')).not.toBeInTheDocument()
    expect(screen.queryByText('+54 11 4455-1020')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/tel/i)).not.toBeInTheDocument()
  })
})

describe('comisiones asignadas', () => {
  it('muestra las cuatro columnas en el orden del spec', () => {
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(COLUMNAS)
  })

  it('muestra CUR-101 con su horario y el estado Activa en verde', () => {
    const fila = within(screen.getByRole('table')).getAllByRole('row')[1]

    expect(fila.cells[0]).toHaveTextContent('CUR-101')
    expect(fila.cells[1]).toHaveTextContent('Python Inicial')
    expect(fila.cells[2]).toHaveTextContent('Mar y Jue · 19 a 21 hs')

    const estado = within(fila.cells[3]).getByText('Activa')
    expect(estado.className).toContain('green')
  })
})

describe('pantalla de solo lectura', () => {
  it('no ofrece ningún campo editable ni botón de guardado', () => {
    const main = within(screen.getByRole('main'))

    expect(main.queryByRole('textbox')).not.toBeInTheDocument()
    expect(main.queryByRole('combobox')).not.toBeInTheDocument()
    expect(main.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(main.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('notas y certificación', () => {
  it('es un ítem deshabilitado del menú, con Próximamente y sin enlace', () => {
    expect(screen.queryByRole('link', { name: 'Notas y Certificación' })).not.toBeInTheDocument()
    expect(screen.getByText('Notas y Certificación')).toBeInTheDocument()
    expect(screen.getAllByText('Próximamente')).toHaveLength(1)
  })

  it('no tiene pantalla detrás: la ruta da 404', async () => {
    cleanup()

    resetDataSource()
    stubBackend()
    renderAppAs('DOCENTE', '/docente/notas')

    expect(await screen.findByText('No encontramos esa página')).toBeInTheDocument()

    // Tampoco hay tabla de notas, campo de carga ni control de certificación en el shell.
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('absorbe el seguimiento de clases dictadas y no lo abre como ítem aparte', () => {
    const menu = within(screen.getByRole('navigation', { name: TITULO_MENU }))
    const items = menu.getAllByRole('listitem').map((item) => item.textContent)

    expect(items.join(' ')).not.toContain('Clases dictadas')
    expect(items.join(' ')).toContain('Notas y Certificación')
  })
})
