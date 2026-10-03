import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend } from '../test/support'

/**
 * Detalle de comisión con su padrón (10.3).
 *
 * Lo que se verifica es el par de reglas que el spec hace contradictorias entre sí: el padrón es de
 * solo lectura y, a la vez, el link de la clase se carga. La fila bloqueada se comprueba por lo que
 * **no** tiene —ningún botón, ningún enlace— porque un control de más es exactamente el error que
 * el spec quiere evitar.
 */

const COLUMNAS = ['ALUMNO', 'EMAIL', 'ESTADO DE HABILITACIÓN']

async function entrar() {
  resetDataSource()
  stubBackend()
  renderAppAs('DOCENTE', '/docente/alumnos/CUR-101')
  await screen.findByRole('heading', { name: 'Python Inicial · CUR-101' })
}

// La flecha es necesaria: `beforeEach(entrar)` le pasaría a `entrar` el contexto del test como ruta.
beforeEach(() => entrar())

describe('encabezado del detalle', () => {
  it('muestra el nombre de la curso con su código y el horario', () => {
    expect(screen.getByRole('heading', { name: 'Python Inicial · CUR-101' })).toBeInTheDocument()
    expect(screen.getByText('Mar y Jue · 19 a 21 hs')).toBeInTheDocument()
  })

  it('muestra el chip de solo lectura al lado del título', () => {
    expect(screen.getByText('Solo lectura')).toBeInTheDocument()
  })

  it('avisa cuántos correos se van a copiar antes de copiar', () => {
    expect(
      screen.getByText('Se copiará 1 email para que puedas enviar el link de Zoom.'),
    ).toBeInTheDocument()
  })
})

describe('padrón de alumnos', () => {
  it('muestra las tres columnas en el orden literal del spec', () => {
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(COLUMNAS)
  })

  it('muestra solo los dos alumnos que el cliente nombra', () => {
    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1)

    expect(filas).toHaveLength(2)
    expect(filas[0].cells[0]).toHaveTextContent('Juan Ignacio Pérez')
    expect(filas[0].cells[1]).toHaveTextContent('juan.perez@gmail.com')
    expect(filas[1].cells[0]).toHaveTextContent('Agustina Benítez')
    expect(filas[1].cells[1]).toHaveTextContent('agus.benitez@gmail.com')
  })

  it('muestra el estado bloqueado en rojo junto a la causa', () => {
    const bloqueado = screen.getByText('BLOQUEADO')

    expect(bloqueado.className).toContain('red')
    expect(screen.getByText('comprobante ilegible')).toBeInTheDocument()
  })

  it('no ofrece ningún control para cambiar el estado de un alumno', () => {
    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1)

    for (const fila of filas) {
      expect(within(fila).queryByRole('button')).not.toBeInTheDocument()
      expect(within(fila).queryByRole('textbox')).not.toBeInTheDocument()
      expect(within(fila).queryByRole('combobox')).not.toBeInTheDocument()
    }
    expect(
      screen.queryByRole('button', { name: /habilitar|bloquear|editar/i }),
    ).not.toBeInTheDocument()
  })
})

describe('la fila de un alumno bloqueado', () => {
  it('no ofrece ninguna forma de obtener el link de la clase', () => {
    const filaAgustina = within(screen.getByRole('table'))
      .getAllByRole('row')
      .find((fila) => fila.textContent.includes('Agustina Benítez'))

    // El link se reparte por correo a los habilitados: no hay botón ni enlace en ninguna fila, y en
    // la bloqueada menos todavía.
    expect(within(filaAgustina).queryByRole('button')).not.toBeInTheDocument()
    expect(within(filaAgustina).queryByRole('link')).not.toBeInTheDocument()
  })
})

describe('copia de emails habilitados', () => {
  it('copia solo el correo del alumno habilitado', async () => {
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Copiar emails habilitados' }))

    const lista = await screen.findByRole('list', { name: 'Correos copiados' })
    expect(
      within(lista)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['juan.perez@gmail.com'])
    expect(
      screen.getByText(
        'Se copiaron los correos de los alumnos habilitados de CUR-101. Los bloqueados no van en la lista.',
      ),
    ).toBeInTheDocument()
  })
})

describe('carga del link de la clase', () => {
  it('rechaza un valor que no es una URL, avisa y no guarda', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Link de la clase'), 'el link de mañana')
    await user.click(screen.getByRole('button', { name: 'Guardar link de la clase' }))

    const error = await screen.findByRole('alert')
    expect(error).toHaveTextContent('El link de la clase tiene que ser una URL válida')
    expect(
      screen.queryByText(
        'Link de la clase cargado. Queda disponible para los alumnos habilitados.',
      ),
    ).not.toBeInTheDocument()
  })

  it('rechaza un dominio sin esquema, porque no se sabe desde dónde se entra', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Link de la clase'), 'zoom.us/j/123')
    await user.click(screen.getByRole('button', { name: 'Guardar link de la clase' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('URL válida')
  })

  it('confirma la carga de una URL válida', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Link de la clase'), 'https://zoom.us/j/99887766')
    await user.click(screen.getByRole('button', { name: 'Guardar link de la clase' }))

    await waitFor(() =>
      expect(
        screen.getByText(
          'Link de la clase cargado. Queda disponible para los alumnos habilitados.',
        ),
      ).toBeInTheDocument(),
    )
    expect(screen.getByLabelText('Link de la clase')).toHaveValue('https://zoom.us/j/99887766')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('aclara que el chip de solo lectura no cubre el campo del link', () => {
    expect(
      screen.getByText(/El chip `Solo lectura` limita su alcance al padrón de alumnos/),
    ).toBeInTheDocument()
  })
})

describe('selección de la comisión', () => {
  it('abre el padrón desde Mis Alumnos', async () => {
    const user = userEvent.setup()

    cleanup()
    resetDataSource()
    stubBackend()
    renderAppAs('DOCENTE', '/docente/alumnos')
    await screen.findByRole('heading', { name: 'Mis Alumnos' })

    await user.click(await screen.findByRole('link', { name: 'Ver alumnos' }))

    expect(
      await screen.findByRole('heading', { name: 'Python Inicial · CUR-101' }),
    ).toBeInTheDocument()
  })

  it('informa cuando el código no corresponde a ninguna comisión', async () => {
    cleanup()
    resetDataSource()
    stubBackend()
    renderAppAs('DOCENTE', '/docente/alumnos/CUR-999')

    expect(await screen.findByText('No hay ninguna comisión con ese código.')).toBeInTheDocument()
  })
})
