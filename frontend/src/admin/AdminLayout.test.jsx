import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend } from '../test/support'
import {
  CHIP_ROL,
  CHIP_SEDE,
  PERIODO_LECTIVO,
  PIE_NOMBRE,
  PIE_TERMINAL,
  SECCIONES_ADMIN,
} from './navegacion'

/**
 * Armazón del shell de Administración (9.1).
 *
 * Se verifica el orden de los ítems del menú y las etiquetas literales del armazón. El orden es
 * requisito del spec, no una preferencia: por eso se compara la lista completa contra la que
 * espera, en vez de contar que hay seis.
 */

const ETIQUETAS_ESPERADAS = [
  'Dashboard',
  'Cursos y Comisiones',
  'Docentes',
  'Alumnos e Inscripciones',
  'Cobranzas e Ingresos',
  'Habilitación de Accesos',
]

async function entrar(ruta = '/admin') {
  resetDataSource()
  stubBackend()
  renderAppAs('ADMIN', ruta)
  await screen.findByRole('navigation', { name: 'MENÚ OPERATIVO' })
}

describe('armazón del shell de Administración', () => {
  beforeEach(async () => {
    await entrar()
  })

  it('muestra el panel lateral con su título', () => {
    expect(screen.getByRole('navigation', { name: 'MENÚ OPERATIVO' })).toBeInTheDocument()
  })

  it('muestra los ítems del menú en el orden que fija el spec', () => {
    const enlaces = screen.getAllByRole('link')

    expect(enlaces.map((enlace) => enlace.textContent)).toEqual(ETIQUETAS_ESPERADAS)
  })

  it('deja el orden del menú en un solo lugar, el de navegación', () => {
    expect(SECCIONES_ADMIN.map((seccion) => seccion.etiqueta)).toEqual(ETIQUETAS_ESPERADAS)
  })

  it('muestra el chip de la sede y el período lectivo en la barra superior', () => {
    expect(screen.getByText(CHIP_SEDE)).toHaveTextContent('Sede Constituciones')
    expect(screen.getByText(PERIODO_LECTIVO)).toHaveTextContent('Período Lectivo 2026')
  })

  it('identifica el rol siempre como Secretaría, aunque el rol sea ADMIN', () => {
    expect(screen.getByText(CHIP_ROL)).toHaveTextContent('Secretaría')
  })

  it('muestra el pie con el nombre y la terminal', () => {
    // Se busca dentro del pie: el nombre de la sesión también es `Secretaria BA` y aparece en la
    // barra superior, así que el texto solo no distingue uno de otro.
    const pie = screen.getByRole('contentinfo')

    expect(pie).toHaveTextContent(PIE_NOMBRE)
    expect(pie).toHaveTextContent(PIE_TERMINAL)
  })

  it('deja el ítem de la sección actual destacado', () => {
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('navegación del menú', () => {
  it('lleva a cada sección y cambia la URL', async () => {
    const user = userEvent.setup()
    await entrar('/admin')

    await user.click(screen.getByRole('link', { name: 'Docentes' }))

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Docentes' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Padrón de Docentes' })).toBeInTheDocument()
  })

  it('deja la pantalla de habilitación de accesos sin rol ajeno', async () => {
    const user = userEvent.setup()
    await entrar('/admin')

    await user.click(screen.getByRole('link', { name: 'Alumnos e Inscripciones' }))
    await waitFor(() => expect(screen.getByText('Padrón de Alumnos Regulares')).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Habilitación de Accesos' }))
    await waitFor(() =>
      expect(screen.getByText('Buscador de Alumnos y Cuentas Corporativas')).toBeInTheDocument(),
    )
  })
})
