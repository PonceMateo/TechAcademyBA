import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { accountForRole, renderAppAs, resetDataSource, stubBackend } from '../test/support'
import { PERIODO_LECTIVO, SECCIONES_ALUMNO, TITULO_MENU } from './navegacion'

/**
 * Armazón del shell de Alumno (11.1).
 *
 * Se verifica el orden del menú —con los dos ítems Won't en su lugar y sin enlace— y que el shell
 * use el acento de su rol. Desde el change `ui-figma-dashboards` el acento no se pinta con clases de
 * color en el armazón: `ShellFrame` publica `data-acento` y `index.css` traduce ese nombre al color,
 * así que lo que esta prueba puede afirmar es que cada shell declara el suyo y que los tres son
 * distintos entre sí.
 */

const ETIQUETAS_ESPERADAS = [
  'Mis Cursos',
  'Mis Pagos',
  'Pagar la cuota',
  'Certificados',
  'Mi Perfil',
]

const TAGLINE = 'TechAcademy BA · Aprendemos, crecemos, conectamos.'
const ULTIMA_ACTUALIZACION = 'Última actualización: 09:41'
const NOMBRE_CUENTA = accountForRole('ALUMNO').nombre

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

  it('muestra el panel lateral con el nombre accesible ESPACIO ALUMNO', () => {
    expect(TITULO_MENU).toBe('ESPACIO ALUMNO')
    expect(screen.getByRole('navigation', { name: 'ESPACIO ALUMNO' })).toBeInTheDocument()
  })

  it('no dibuja el título del panel como texto visible', () => {
    expect(screen.queryByText('ESPACIO ALUMNO')).not.toBeInTheDocument()
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

  it('muestra el rol y el nombre de la cuenta en el bloque de perfil', () => {
    const perfil = screen.getByRole('button', { name: new RegExp(NOMBRE_CUENTA) })

    expect(perfil).toHaveTextContent(NOMBRE_CUENTA)
    expect(perfil).toHaveTextContent('Alumno')
  })

  it('no muestra el chip de rol ni el período lectivo en la barra superior', () => {
    const barra = barraSuperior()

    expect(barra.queryByText('Rol Alumno · Solo mi información')).not.toBeInTheDocument()
    expect(barra.queryByText(PERIODO_LECTIVO)).not.toBeInTheDocument()
  })

  it('muestra el pie con el tagline, el período lectivo y la última actualización', () => {
    const pie = screen.getByRole('contentinfo')

    expect(pie).toHaveTextContent(TAGLINE)
    expect(pie).toHaveTextContent(PERIODO_LECTIVO)
    expect(pie).toHaveTextContent(ULTIMA_ACTUALIZACION)
  })

  it('no deja la persona del maquetado en el pie', () => {
    // El avatar `CR`, el nombre `Camila Rodríguez` y el rol `ALUMNO` salieron del pie: la identidad
    // del armazón es la cuenta de la sesión y vive en la barra superior.
    const pie = screen.getByRole('contentinfo')

    expect(pie).not.toHaveTextContent('CR')
    expect(pie).not.toHaveTextContent('Camila Rodríguez')
    expect(pie).not.toHaveTextContent('ALUMNO')
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

  it('declara el acento dorado del rol y ninguno de los otros dos', () => {
    expect(armazon()).toHaveAttribute('data-acento', 'alumno')
    expect(armazon()).not.toHaveAttribute('data-acento', 'secretaria')
    expect(armazon()).not.toHaveAttribute('data-acento', 'docente')
  })

  it('no pinta el color a mano en el lateral', () => {
    // El color vive en `index.css`, por `data-acento`: si el lateral trajera una clase de color
    // propia, cambiar el acento sería cambiar dos lugares.
    const panel = screen.getByRole('navigation', { name: TITULO_MENU }).className

    expect(panel).not.toContain('bg-orange-900')
    expect(panel).not.toContain('bg-yellow-')
    expect(panel).not.toContain('bg-slate-900')
    expect(panel).not.toContain('bg-teal-900')
  })
})
