import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderApp, stubBackend } from '../test/support'

/**
 * Pantalla de login (7.5): el patrón único del prototipo —correo, contraseña, botón de
 * ingreso y aviso informativo— y nada más.
 *
 * La ausencia de selector de rol es una prueba y no una omisión: es lo que impide que la
 * interfaz sugiera que el rol se elige. El rol sale de la cuenta (D4) y el backend lo lee de
 * la fila, no del pedido (M7).
 */
describe('pantalla de login', () => {
  beforeEach(() => {
    stubBackend()
  })

  it('renderiza el patrón completo del prototipo', () => {
    renderApp('/login')

    expect(screen.getByRole('heading', { name: 'TechAcademy BA' })).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
    expect(screen.getByText(/README/)).toBeInTheDocument()
  })

  it('pide el correo en un campo de correo y la contraseña en un campo de contraseña', () => {
    renderApp('/login')

    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
  })

  it('no tiene selector de rol', () => {
    renderApp('/login')

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    for (const rol of ['ADMIN', 'DOCENTE', 'ALUMNO']) {
      expect(screen.queryByText(rol)).not.toBeInTheDocument()
    }
  })

  it('solo tiene los tres controles del patrón', () => {
    renderApp('/login')

    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('no muestra un error antes de que se intente entrar', () => {
    renderApp('/login')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('muestra el mensaje del backend y deja escribir de nuevo tras un intento fallido', async () => {
    const user = userEvent.setup()

    renderApp('/login')
    await user.type(screen.getByLabelText('Correo electrónico'), 'nadie@techacademy.invalid')
    await user.type(screen.getByLabelText('Contraseña'), 'Demo2026!')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas.')
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled()
  })
})
