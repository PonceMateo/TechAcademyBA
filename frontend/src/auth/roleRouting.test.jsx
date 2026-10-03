import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { TOKEN_STORAGE_KEY } from './tokenStorage'
import {
  accountForRole,
  currentPath,
  fillLoginForm,
  renderApp,
  seedStoredToken,
  stubBackend,
} from '../test/support'

/**
 * Redirección por rol (7.3): dónde aterriza cada uno al entrar, y qué pasa al cerrar sesión.
 *
 * Los tres destinos se prueban con las tres cuentas de demostración, no con tres cadenas
 * inventadas: si el backend cambia el nombre de un rol, la tabla de ruteo deja de estar
 * bien y estos tests lo dicen.
 *
 * **Cada sección se reconoce por su propia marca.** Administración ya tiene el shell del grupo 9,
 * así que su marca es el panel `MENÚ OPERATIVO`; Docente y Alumno siguen con la pantalla de
 * marcador de posición, cuya marca es el título de la sección.
 */
describe('redirección por rol', () => {
  beforeEach(() => {
    stubBackend()
  })

  it('lleva a Administración a su tablero', async () => {
    renderApp('/login')

    await fillLoginForm(accountForRole('ADMIN'))

    await waitFor(() => expect(currentPath()).toBe('/admin'))
    expect(await screen.findByRole('navigation', { name: 'MENÚ OPERATIVO' })).toBeInTheDocument()
  })

  it('lleva a Docente a su sección', async () => {
    renderApp('/login')

    await fillLoginForm(accountForRole('DOCENTE'))

    await waitFor(() => expect(currentPath()).toBe('/docente'))
    expect(await screen.findByRole('heading', { name: 'Espacio Docente' })).toBeInTheDocument()
  })

  it('lleva a Alumno a su sección', async () => {
    renderApp('/login')

    await fillLoginForm(accountForRole('ALUMNO'))

    await waitFor(() => expect(currentPath()).toBe('/alumno'))
    expect(await screen.findByRole('heading', { name: 'Espacio Alumno' })).toBeInTheDocument()
  })

  it('manda a la sección del rol a quien abre la raíz con sesión', async () => {
    seedStoredToken('ALUMNO')

    renderApp('/')

    await waitFor(() => expect(currentPath()).toBe('/alumno'))
  })

  it('manda al login a quien abre la raíz sin sesión', async () => {
    renderApp('/')

    expect(await screen.findByLabelText('Correo electrónico')).toBeInTheDocument()
    expect(currentPath()).toBe('/login')
  })

  it('vuelve al login al cerrar sesión y descarta el token', async () => {
    seedStoredToken('ADMIN')
    renderApp('/admin')

    await screen.findByRole('button', { name: 'Cerrar sesión' })
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    await waitFor(() => {
      expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    })
    expect(await screen.findByLabelText('Correo electrónico')).toBeInTheDocument()
    expect(currentPath()).toBe('/login')
  })

  it('deja volver a entrar después de cerrar sesión', async () => {
    seedStoredToken('DOCENTE')
    renderApp('/docente')
    await screen.findByRole('button', { name: 'Cerrar sesión' })
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await screen.findByLabelText('Correo electrónico')

    await fillLoginForm(accountForRole('DOCENTE'))

    await waitFor(() => expect(currentPath()).toBe('/docente'))
  })

  it('manda al login a quien ya tiene sesión y abre la pantalla de acceso', async () => {
    seedStoredToken('ALUMNO')

    renderApp('/login')

    await waitFor(() => expect(currentPath()).toBe('/alumno'))
  })
})
