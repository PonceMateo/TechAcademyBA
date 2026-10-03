import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend } from '../test/support'
import {
  CHIP_ROL,
  PERIODO_LECTIVO,
  PIE_AVATAR,
  PIE_NOMBRE,
  PIE_ROL,
  SECCIONES_ALUMNO,
  TITULO_MENU,
} from './navegacion'

/**
 * Armazón del shell de Alumno (11.1).
 *
 * Se verifica el orden del menú —con los dos ítems Won't en su lugar y sin enlace— y que el acento
 * sea distinguible de los otros dos shells. La comparación de acento mira la clase del panel lateral
 * de cada sección: si dos compartieran color, el menú no las distinguiría.
 */

const ETIQUETAS_ESPERADAS = [
  'Mis Cursos',
  'Mis Pagos',
  'Pagar la cuota',
  'Certificados',
  'Mi Perfil',
]

async function entrar(ruta = '/alumno') {
  resetDataSource()
  stubBackend()
  renderAppAs('ALUMNO', ruta)
  await screen.findByRole('navigation', { name: TITULO_MENU })
}

describe('armazón del shell de Alumno', () => {
  // La flecha es necesaria: `beforeEach(entrar)` le pasaría a `entrar` el contexto del test como ruta.
  beforeEach(async () => {
    await entrar()
  })

  it('muestra el panel lateral con el título ESPACIO ALUMNO', () => {
    expect(TITULO_MENU).toBe('ESPACIO ALUMNO')
    expect(screen.getByRole('navigation', { name: 'ESPACIO ALUMNO' })).toBeInTheDocument()
  })

  it('muestra los ítems del menú en el orden que fija el spec', () => {
    const menu = within(screen.getByRole('navigation', { name: TITULO_MENU }))
    const items = menu.getAllByRole('listitem').map((item) => item.textContent)

    expect(items.map((texto) => texto.replace('Próximamente', '').trim())).toEqual(
      ETIQUETAS_ESPERADAS,
    )
    expect(SECCIONES_ALUMNO.map((seccion) => seccion.etiqueta)).toEqual(ETIQUETAS_ESPERADAS)
  })

  it('deja los dos ítems deshabilitados sin enlace y con Próximamente', () => {
    expect(screen.queryByRole('link', { name: 'Pagar la cuota' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Certificados' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Próximamente')).toHaveLength(2)
  })

  it('muestra el chip de rol y el período lectivo en la barra superior', () => {
    expect(screen.getByText(CHIP_ROL)).toHaveTextContent('Rol Alumno · Solo mi información')
    expect(screen.getByText(PERIODO_LECTIVO)).toHaveTextContent('Período Lectivo 2026')
  })

  it('muestra el pie con el avatar, el nombre y el rol', () => {
    const pie = screen.getByRole('contentinfo')

    expect(pie).toHaveTextContent(PIE_AVATAR)
    expect(pie).toHaveTextContent(PIE_NOMBRE)
    expect(pie).toHaveTextContent(PIE_ROL)
  })

  it('dibuja el armazón con el mismo componente compartido que el resto de los shells', () => {
    expect(document.querySelectorAll('[data-ui="shell-frame"]')).toHaveLength(1)
  })
})

describe('el acento del shell de Alumno', () => {
  // La flecha es necesaria: `beforeEach(entrar)` le pasaría a `entrar` el contexto del test como ruta.
  beforeEach(async () => {
    await entrar()
  })

  it('usa terracota, y no el celeste ni el verde azulado de los otros shells', () => {
    const panel = screen.getByRole('navigation', { name: TITULO_MENU }).className

    expect(panel).toContain('bg-orange-900')
    expect(panel).not.toContain('bg-slate-900')
    expect(panel).not.toContain('bg-teal-900')
  })

  it('pinta el chip de rol con el mismo acento que el panel', () => {
    expect(screen.getByText(CHIP_ROL).className).toContain('orange')
  })
})
