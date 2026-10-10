import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TOKEN_STORAGE_KEY } from './tokenStorage'
import {
  DEMO_ACCOUNTS,
  accountForRole,
  currentPath,
  fillLoginForm,
  renderApp,
  seedStoredToken,
  stubBackend,
} from '../test/support'

/**
 * El contexto de sesión (7.2): guarda la sesión cuando el login sirve y no la guarda cuando
 * no. La segunda mitad importa más que la primera: un token guardado de más significa que
 * la pantalla siguiente le creyó a la interfaz y no al backend.
 */
describe('contexto de sesión', () => {
  beforeEach(() => {
    stubBackend()
  })

  it('guarda la sesión cuando el login es válido', async () => {
    renderApp('/login')

    await fillLoginForm(accountForRole('ADMIN'))

    await waitFor(() => {
      expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBe('token-ADMIN')
    })
    // El nombre de la cuenta se muestra en el bloque de perfil de la barra superior del shell de
    // Secretaría, que desde el change `ui-figma-dashboards` es el único lugar del armazón donde
    // vive la identidad.
    const perfil = await screen.findByRole('button', { name: /Secretaria BA/ })
    expect(perfil).toHaveTextContent('Secretaria BA')
  })

  it('no guarda la sesión cuando las credenciales no sirven', async () => {
    renderApp('/login')

    await fillLoginForm(accountForRole('ADMIN'), { password: 'no-es-la-clave' })

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas.')
    expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    expect(currentPath()).toBe('/login')
  })

  it('relee la identidad con el token guardado en vez de volver a iniciar sesión', async () => {
    seedStoredToken('DOCENTE')

    renderApp('/')

    // El nombre aparece en el saludo del tablero y en el perfil de la barra superior: se busca el
    // botón de perfil, que es el dato del armazón.
    expect(await screen.findByRole('button', { name: /Rita Molina/ })).toBeInTheDocument()
    expect(currentPath()).toBe('/docente')
    // La sesión se restauró con `GET /auth/me`: no aparece el formulario de login.
    expect(screen.queryByLabelText('Correo electrónico')).not.toBeInTheDocument()
  })

  it('descarta el token guardado cuando el backend ya no lo acepta', async () => {
    // Un token de otra cuenta, o de una cuenta dada de baja: criptográficamente puede ser
    // válido y el backend igual lo rechaza (M7). La interfaz tiene que entender esa
    // respuesta y quedarse sin sesión.
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, 'token-que-no-existe')

    renderApp('/')

    await waitFor(() => {
      expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    })
    expect(await screen.findByLabelText('Correo electrónico')).toBeInTheDocument()
    expect(currentPath()).toBe('/login')
  })

  it('no llama al backend si no hay token guardado', () => {
    const fetchMock = stubBackend()

    renderApp('/')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('avisa que la contraseña está pendiente, sin ofrecer un flujo que todavía no existe', async () => {
    vi.unstubAllGlobals()
    stubBackend([accountForRole('ALUMNO', { must_change_password: true })])

    renderApp('/login')
    await fillLoginForm(DEMO_ACCOUNTS.find((account) => account.rol === 'ALUMNO'))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('pendiente el cambio de contraseña')
    expect(alert).toHaveTextContent('no está disponible')
  })

  it('no da por pendiente una contraseña que ya se cambió', async () => {
    renderApp('/login')

    await fillLoginForm(accountForRole('ALUMNO'))

    expect(await screen.findByRole('button', { name: /Agustina Benítez/ })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('deja el formulario listo para escribir de nuevo después de un error', async () => {
    renderApp('/login')

    await fillLoginForm(accountForRole('ALUMNO'), { password: 'no-es-la-clave' })
    await screen.findByRole('alert')

    expect(screen.getByLabelText('Correo electrónico')).toHaveValue(
      'agustina.benitez@techacademy.invalid',
    )
    expect(screen.getByLabelText('Contraseña')).toHaveValue('')
  })
})
