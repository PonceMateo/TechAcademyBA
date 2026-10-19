import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend, stubDataSource } from '../test/support'

/**
 * Mis alumnos (10.3, primera parte del camino).
 *
 * La pantalla lista las comisiones del docente para poder entrar al padrón de la elegida. Sin
 * endpoint la lectura falla; lo que se verifica es que la tabla quede en su estado vacío y no con
 * un rechazo sin manejar.
 */
describe('mis alumnos sin endpoint', () => {
  it('muestra el estado vacío cuando la lectura de comisiones falla', async () => {
    resetDataSource()
    stubBackend()
    stubDataSource({
      obtenerComisionesAsignadas: async () => {
        throw new Error('No pudimos conectar con el servidor.')
      },
    })
    renderAppAs('DOCENTE', '/docente/alumnos')

    expect(
      await screen.findByText('No tenés comisiones asignadas en este período lectivo.'),
    ).toBeInTheDocument()
  })
})
