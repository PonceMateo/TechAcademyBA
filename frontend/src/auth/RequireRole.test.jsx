import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { currentPath, renderApp, seedStoredToken, stubBackend } from '../test/support'

/**
 * Rutas protegidas y pantallas de error (7.4).
 *
 * **Lo que se prueba acá es que la interfaz no muestre lo que no corresponde.** Que el
 * backend además lo rechace es otra historia: la verifica la suite de autorización del
 * backend, sobre `/auth/probe/*`. Que la interfaz oculte la pantalla no reemplaza eso; si
 * las dos capas fallaran, el rol ajeno igual no podría leer un solo dato.
 */
describe('rutas protegidas por rol', () => {
  beforeEach(() => {
    stubBackend()
  })

  it('manda al login a quien no tiene sesión, aunque la URL sea de una sección', async () => {
    renderApp('/admin')

    expect(await screen.findByLabelText('Correo electrónico')).toBeInTheDocument()
    expect(currentPath()).toBe('/login')
  })

  it('devuelve 403 a un alumno que abre la sección de administración', async () => {
    seedStoredToken('ALUMNO')

    renderApp('/admin')

    await waitFor(() => expect(currentPath()).toBe('/403'))
    expect(await screen.findByText('403')).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'No tenés acceso a esta sección' }),
    ).toBeInTheDocument()
  })

  it('devuelve 403 a un docente que abre la sección de alumno', async () => {
    seedStoredToken('DOCENTE')

    renderApp('/alumno')

    await waitFor(() => expect(currentPath()).toBe('/403'))
    expect(await screen.findByText('403')).toBeInTheDocument()
  })

  it('ofrece desde el 403 volver a la sección del propio rol', async () => {
    seedStoredToken('DOCENTE')

    renderApp('/alumno')
    await screen.findByText('403')

    expect(await screen.findByRole('link', { name: 'Ir a mi inicio' })).toHaveAttribute(
      'href',
      '/docente',
    )
  })

  it('no muestra la pantalla de la sección ajena ni un pedazo de ella', async () => {
    seedStoredToken('ALUMNO')

    renderApp('/admin')

    await screen.findByText('403')
    expect(screen.queryByRole('heading', { name: 'Secretaría' })).not.toBeInTheDocument()
  })

  it('devuelve 404 a una ruta que no existe', async () => {
    seedStoredToken('ADMIN')

    renderApp('/admin/cursos-y-comisiones')

    expect(await screen.findByText('404')).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'No encontramos esa página' }),
    ).toBeInTheDocument()
  })

  it('devuelve 404 también a una ruta suelta, sin sesión', async () => {
    renderApp('/no-existe')

    expect(await screen.findByText('404')).toBeInTheDocument()
  })

  it('deja entrar a cada rol a su propia sección', async () => {
    for (const [role, path] of [
      ['ADMIN', '/admin'],
      ['DOCENTE', '/docente'],
      ['ALUMNO', '/alumno'],
    ]) {
      seedStoredToken(role)

      const view = renderApp(path)

      await waitFor(() => expect(currentPath()).toBe(path))
      expect(screen.queryByText('403')).not.toBeInTheDocument()

      view.unmount()
      window.sessionStorage.clear()
    }
  })
})
