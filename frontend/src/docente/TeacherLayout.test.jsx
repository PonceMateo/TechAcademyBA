import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend } from '../test/support'
import {
  CHIP_ROL,
  PERIODO_LECTIVO,
  PIE_AVATAR,
  PIE_NOMBRE,
  PIE_ROL,
  SECCIONES_DOCENTE,
  TITULO_MENU,
} from './navegacion'

/**
 * Armazón del shell de Docente (10.1).
 *
 * Se verifica el orden del menú, las etiquetas literales y —lo que el encargo pide— que el armazón
 * se distinga del de Administración. La comparación de acento es entre las dos clases del panel
 * lateral, porque es donde el acento se ve: si dos secciones compartieran color, el menú no las
 * distinguiría y el guard de rol seguiría siendo la única señal de en qué sección se está.
 */

const ETIQUETAS_ESPERADAS = [
  'Mis Comisiones',
  'Mis Alumnos',
  'Asistencia',
  'Notas y Certificación',
  'Mi Perfil',
]

async function entrar(ruta = '/docente') {
  resetDataSource()
  stubBackend()
  renderAppAs('DOCENTE', ruta)
  await screen.findByRole('navigation', { name: TITULO_MENU })
}

describe('armazón del shell de Docente', () => {
  beforeEach(async () => {
    await entrar()
  })

  it('muestra el panel lateral con el título ESPACIO DOCENTE', () => {
    expect(TITULO_MENU).toBe('ESPACIO DOCENTE')
    expect(screen.getByRole('navigation', { name: 'ESPACIO DOCENTE' })).toBeInTheDocument()
  })

  it('muestra los ítems del menú en el orden que fija el spec', () => {
    // Se comparan los `<li>` del panel y no los enlaces: el cuarto ítem está deshabilitado y no es
    // un enlace, igual que en el menú tiene que estar en su lugar.
    const menu = within(screen.getByRole('navigation', { name: TITULO_MENU }))
    const items = menu.getAllByRole('listitem').map((item) => item.textContent)

    expect(items.map((texto) => texto.replace('Próximamente', '').trim())).toEqual(
      ETIQUETAS_ESPERADAS,
    )
  })

  it('deja el orden del menú en un solo lugar, el de navegación', () => {
    expect(SECCIONES_DOCENTE.map((seccion) => seccion.etiqueta)).toEqual(ETIQUETAS_ESPERADAS)
  })

  it('muestra el chip de rol y el período lectivo en la barra superior', () => {
    expect(screen.getByText(CHIP_ROL)).toHaveTextContent('Rol Docente · Solo mis comisiones')
    expect(screen.getByText(PERIODO_LECTIVO)).toHaveTextContent('Período Lectivo 2026')
  })

  it('muestra el pie con el avatar, el nombre y el rol', () => {
    const pie = screen.getByRole('contentinfo')

    expect(pie).toHaveTextContent(PIE_AVATAR)
    expect(pie).toHaveTextContent(PIE_NOMBRE)
    expect(pie).toHaveTextContent(PIE_ROL)
  })

  it('muestra con qué cuenta se entró en la barra superior', () => {
    // El pie muestra la persona del maqueteado y la barra la cuenta que está abierta. Son dos
    // personas distintas solo porque las cuentas de demostración no son las del prototype (M25).
    expect(screen.getByText('Rita Molina')).toBeInTheDocument()
  })

  it('dibuja el armazón con el mismo componente compartido que el resto de los shells', () => {
    expect(document.querySelectorAll('[data-ui="shell-frame"]')).toHaveLength(1)
  })

  it('deja el ítem de la sección actual destacado', () => {
    expect(screen.getByRole('link', { name: 'Mis Comisiones' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

describe('el acento del shell de Docente', () => {
  it('usa verde azulado, y no el celeste del shell de Administración', async () => {
    const { unmount } = renderAppAs('DOCENTE', '/docente')
    await screen.findByRole('navigation', { name: TITULO_MENU })

    const panel = screen.getByRole('navigation', { name: TITULO_MENU }).className
    expect(panel).toContain('bg-teal-900')
    expect(panel).not.toContain('bg-slate-900')
    unmount()

    resetDataSource()
    stubBackend()
    renderAppAs('ADMIN', '/admin')
    const panelAdmin = await screen.findByRole('navigation', { name: 'MENÚ OPERATIVO' })

    expect(panelAdmin.className).toContain('bg-slate-900')
    expect(panelAdmin.className).not.toContain('bg-teal-900')
  })

  it('pinta el chip de rol con el mismo acento que el panel', async () => {
    renderAppAs('DOCENTE', '/docente')
    const chip = await screen.findByText(CHIP_ROL)

    expect(chip.className).toContain('teal')
  })
})
