import { cleanup, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { forzarBloqueoManual } from '../services/dataService'
import { accountForRole, renderAppAs, resetDataSource, stubBackend, stubDataSource } from '../test/support'

/**
 * Cursos del alumno (11.2).
 *
 * La tarjeta bloqueada se alcanza forzando el bloqueo de la inscripción del ejemplo, que es
 * exactamente lo que hace la secretaría desde `Habilitación de Accesos`: si el shell del alumno se
 * dibujara con una segunda tarjeta de ejemplo, el caso del bloqueo estaría ilustrado con una
 * inscripción que el cliente no tiene.
 *
 * **El tablero abre con el saludo y con los indicadores, no con el título `Mis Cursos`.** Desde el
 * change `ui-figma-dashboards` el índice del alumno tiene la composición del tablero del diseño; el
 * nombre de la sección vive en el ítem del menú y en el breadcrumb del armazón.
 */

/** El tablero abre con el saludo de la cuenta de la sesión. */
const SALUDO = `Buen día, ${accountForRole('ALUMNO').nombre}`

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  renderAppAs('ALUMNO', '/alumno')
  await screen.findByRole('heading', { name: SALUDO })
  await screen.findByText('CUR-102')
})

describe('tarjeta del curso inscripto', () => {
  it('muestra el código, el estado, el título, el docente, el horario y la categoría', () => {
    const tarjeta = screen
      .getByRole('heading', { name: 'Desarrollo Web Full Stack' })
      .closest('section')

    expect(within(tarjeta).getByText('CUR-102')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Docente · Lic. Laura Benítez')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Lun y Miér · 18:30 a 21:30')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Becado parcial 50%')).toBeInTheDocument()
  })

  it('muestra el banner de acceso habilitado en verde y el botón de detalle', () => {
    const banner = screen.getByText('Habilitado', { selector: 'p' })

    expect(banner.className).toContain('text-green-800')
    expect(screen.getByRole('link', { name: 'Ver detalle' })).toHaveAttribute(
      'href',
      '/alumno/cursos/CUR-102',
    )
  })

  it('muestra una sola tarjeta, sin inventar una segunda inscripción', () => {
    expect(screen.getAllByRole('link', { name: 'Ver detalle' })).toHaveLength(1)
    expect(screen.queryByText('CUR-101')).not.toBeInTheDocument()
  })
})

describe('la tarjeta bloqueada', () => {
  beforeEach(async () => {
    await forzarBloqueoManual({
      alumnoId: 2,
      motivo: 'comprobante ilegible',
      usuario: 'Secretaria BA',
      fechaOperacion: '2026-05-21',
    })

    cleanup()
    renderAppAs('ALUMNO', '/alumno')
    await screen.findByRole('heading', { name: 'Desarrollo Web Full Stack' })
  })

  it('muestra el banner bloqueado en rojo con la causa', () => {
    const banner = screen.getByText('Bloqueado', { selector: 'p' })

    expect(banner.className).toContain('text-red-800')
    // La causa aparece dos veces y no es una repetición de más: el indicador `ACCESO A LA CLASE` la
    // lleva como texto de apoyo y el banner de la tarjeta la muestra para que el bloqueo se
    // entienda sin salir de la pantalla.
    expect(screen.getAllByText(/Causa: comprobante ilegible/)).toHaveLength(2)
  })

  it('ofrece una forma de ir a Mis Pagos', () => {
    expect(screen.getByRole('link', { name: 'Ir a Mis Pagos' })).toHaveAttribute(
      'href',
      '/alumno/pagos',
    )
  })

  it('sigue siendo la misma tarjeta y no una segunda', () => {
    expect(screen.getAllByRole('link', { name: 'Ver detalle' })).toHaveLength(1)
  })
})

describe('alumno sin inscripciones', () => {
  it('muestra un mensaje de que no tiene cursos activos', async () => {
    cleanup()
    stubDataSource({ listarInscripcionesAlumno: async () => [] })
    renderAppAs('ALUMNO', '/alumno')

    expect(
      await screen.findByText('No tenés cursos activos en este período lectivo.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ver detalle' })).not.toBeInTheDocument()
  })
})
