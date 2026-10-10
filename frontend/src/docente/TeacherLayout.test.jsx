import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { accountForRole, renderAppAs, resetDataSource, stubBackend } from '../test/support'
import { PERIODO_LECTIVO, SECCIONES_DOCENTE, TITULO_MENU } from './navegacion'

/**
 * Armazón del shell de Docente (10.1).
 *
 * Se verifica el orden del menú y que el shell use el acento de su rol. Desde el change
 * `ui-figma-dashboards` el acento no se pinta con clases de color en el armazón: `ShellFrame`
 * publica `data-acento` y `index.css` traduce ese nombre al color, así que la prueba compara los
 * dos armazones por el acento que declaran y no por la clase con la que se ven.
 */

const ETIQUETAS_ESPERADAS = [
  'Mis Comisiones',
  'Mis Alumnos',
  'Asistencia',
  'Notas y Certificación',
  'Mi Perfil',
]

const TAGLINE = 'TechAcademy BA · Aprendemos, crecemos, conectamos.'
const ULTIMA_ACTUALIZACION = 'Última actualización: 09:41'
const NOMBRE_CUENTA = accountForRole('DOCENTE').nombre

function armazon() {
  return document.querySelector('[data-ui="shell-frame"]')
}

/**
 * La barra superior del armazón, ubicada por el armazón y no por el rol `banner`: la cabecera del
 * tablero también es un `<header>` y también se anuncia como banner.
 */
function barraSuperior() {
  return within(document.querySelector('[data-ui="shell-frame"] header'))
}

async function entrar(ruta = '/docente') {
  resetDataSource()
  stubBackend()
  renderAppAs('DOCENTE', ruta)
  await screen.findByRole('navigation', { name: TITULO_MENU })
}

describe('armazón del shell de Docente', () => {
  // La flecha es necesaria: `beforeEach(entrar)` le pasaría a `entrar` el contexto del test como ruta.
  beforeEach(async () => {
    await entrar()
  })

  it('muestra el panel lateral con el nombre accesible ESPACIO DOCENTE', () => {
    expect(TITULO_MENU).toBe('ESPACIO DOCENTE')
    expect(screen.getByRole('navigation', { name: 'ESPACIO DOCENTE' })).toBeInTheDocument()
  })

  it('no dibuja el título del panel como texto visible', () => {
    expect(screen.queryByText('ESPACIO DOCENTE')).not.toBeInTheDocument()
  })

  it('muestra los ítems del menú en el orden que fija el spec', () => {
    const menu = within(screen.getByRole('navigation', { name: TITULO_MENU }))
    const items = menu.getAllByRole('listitem').map((item) => item.textContent)

    expect(items.map((texto) => texto.replace('Próximamente', '').trim())).toEqual(
      ETIQUETAS_ESPERADAS,
    )
    expect(SECCIONES_DOCENTE.map((seccion) => seccion.etiqueta)).toEqual(ETIQUETAS_ESPERADAS)
  })

  it('muestra el rol y el nombre de la cuenta en el bloque de perfil', () => {
    const perfil = screen.getByRole('button', { name: new RegExp(NOMBRE_CUENTA) })

    expect(perfil).toHaveTextContent(NOMBRE_CUENTA)
    expect(perfil).toHaveTextContent('Docente')
  })

  it('no muestra el chip de rol ni el período lectivo en la barra superior', () => {
    const barra = barraSuperior()

    expect(barra.queryByText('Rol Docente · Solo mis comisiones')).not.toBeInTheDocument()
    expect(barra.queryByText(PERIODO_LECTIVO)).not.toBeInTheDocument()
  })

  it('muestra el pie con el tagline, el período lectivo y la última actualización', () => {
    const pie = screen.getByRole('contentinfo')

    expect(pie).toHaveTextContent(TAGLINE)
    expect(pie).toHaveTextContent(PERIODO_LECTIVO)
    expect(pie).toHaveTextContent(ULTIMA_ACTUALIZACION)
  })

  it('no deja la persona del maquetado en el pie', () => {
    // El avatar `PM`, el nombre `Profe Martín` y el rol `DOCENTE` salieron del pie: la identidad del
    // armazón es la cuenta de la sesión y vive en la barra superior.
    const pie = screen.getByRole('contentinfo')

    expect(pie).not.toHaveTextContent('PM')
    expect(pie).not.toHaveTextContent('Profe Martín')
    expect(pie).not.toHaveTextContent('DOCENTE')
  })

  it('muestra con qué cuenta se entró en la barra superior', () => {
    // La cuenta que está abierta es la de la sesión, que no es la del prototype (M25).
    expect(screen.getByRole('button', { name: new RegExp(NOMBRE_CUENTA) })).toBeInTheDocument()
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
  beforeEach(async () => {
    await entrar()
  })

  it('declara el acento verde del rol y no el azul de Administración', () => {
    expect(armazon()).toHaveAttribute('data-acento', 'docente')
    expect(armazon()).not.toHaveAttribute('data-acento', 'secretaria')
  })

  it('cambia de acento al cambiar de sección', async () => {
    resetDataSource()
    stubBackend()
    renderAppAs('ADMIN', '/admin')
    await screen.findByRole('navigation', { name: 'MENÚ OPERATIVO' })

    // El esquema de acento es del shell, no de la pantalla: al entrar a Secretaría, el armazón
    // declara su propio acento.
    const armazones = document.querySelectorAll('[data-ui="shell-frame"]')
    expect(armazones[armazones.length - 1]).toHaveAttribute('data-acento', 'secretaria')
  })

  it('no pinta el color a mano en el lateral', () => {
    const panel = screen.getByRole('navigation', { name: TITULO_MENU }).className

    expect(panel).not.toContain('bg-teal-900')
    expect(panel).not.toContain('bg-emerald-')
    expect(panel).not.toContain('bg-slate-900')
  })
})
