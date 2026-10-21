import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { accountForRole, currentPath, renderApp, renderAppAs, stubBackend } from '../test/support'

/**
 * D45 — pantalla de cambio obligatorio en el primer ingreso.
 *
 * Lo que se prueba acá es la parte que no depende de la red: la cuenta pendiente no entra a su
 * sección, el formulario no deja mandar una contraseña corta ni una confirmación distinta, y una
 * cuenta que ya cambió la contraseña no vuelve a ver esta pantalla.
 */
describe('cambio obligatorio de contraseña', () => {
  beforeEach(() => {
    stubBackend([accountForRole('ALUMNO', { must_change_password: true })])
  })

  it('se muestra a la cuenta pendiente y no la deja entrar a su sección', async () => {
    renderAppAs('ALUMNO', '/alumno')

    expect(await screen.findByRole('heading', { name: 'Cambiá tu contraseña' })).toBeInTheDocument()
    expect(currentPath()).toBe('/cambiar-contrasena')
  })

  it('no envía una contraseña nueva corta', async () => {
    const user = userEvent.setup()
    renderAppAs('ALUMNO', '/cambiar-contrasena')
    await screen.findByRole('heading', { name: 'Cambiá tu contraseña' })

    await user.type(screen.getByLabelText('Contraseña actual'), 'Demo2026!')
    await user.type(screen.getByLabelText('Contraseña nueva'), 'corta')
    await user.type(screen.getByLabelText('Repetí la contraseña nueva'), 'corta')
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('al menos 8 caracteres')
    expect(currentPath()).toBe('/cambiar-contrasena')
  })

  it('no envía el cambio si la confirmación no coincide', async () => {
    const user = userEvent.setup()
    renderAppAs('ALUMNO', '/cambiar-contrasena')
    await screen.findByRole('heading', { name: 'Cambiá tu contraseña' })

    await user.type(screen.getByLabelText('Contraseña actual'), 'Demo2026!')
    await user.type(screen.getByLabelText('Contraseña nueva'), 'ClaveNueva2026!')
    await user.type(screen.getByLabelText('Repetí la contraseña nueva'), 'OtraClave2026!')
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('no coinciden')
    expect(currentPath()).toBe('/cambiar-contrasena')
  })

  it('redirige a la sección cuando la cuenta ya no tiene el cambio pendiente', async () => {
    stubBackend()
    renderAppAs('ALUMNO', '/cambiar-contrasena')

    expect(await screen.findByRole('button', { name: /Agustina Benítez/ })).toBeInTheDocument()
    expect(currentPath()).toBe('/alumno')
  })

  it('sin sesión vuelve al login', async () => {
    renderApp('/cambiar-contrasena')

    expect(await screen.findByLabelText('Correo electrónico')).toBeInTheDocument()
    expect(currentPath()).toBe('/login')
  })
})
