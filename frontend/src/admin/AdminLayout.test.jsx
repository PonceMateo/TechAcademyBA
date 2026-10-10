import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { accountForRole, renderAppAs, resetDataSource, stubBackend } from '../test/support'
import { PERIODO_LECTIVO, SECCIONES_ADMIN } from './navegacion'

/**
 * Armazón del shell de Administración (9.1).
 *
 * Se verifica el orden de los ítems del menú y las etiquetas literales del armazón. El orden es
 * requisito del spec, no una preferencia: por eso se compara la lista completa contra la que
 * espera, en vez de contar que hay seis.
 *
 * **El pie ya no lleva la persona y el nombre de la cuenta se mudó a la barra superior.** Desde el
 * change `ui-figma-dashboards` el armazón muestra el tagline, el período lectivo y la marca de
 * actualización en el pie, y la cuenta —nombre, rol y `Cerrar sesión`— en el bloque de perfil de la
 * barra superior. Por eso el pie se prueba también por lo que **no** tiene: un nombre que quedó
 * duplicado haría creer que hay dos cuentas.
 */

const ETIQUETAS_ESPERADAS = [
  'Dashboard',
  'Cursos y Comisiones',
  'Docentes',
  'Alumnos e Inscripciones',
  'Cobranzas e Ingresos',
  'Habilitación de Accesos',
]

const TAGLINE = 'TechAcademy BA · Aprendemos, crecemos, conectamos.'
const ULTIMA_ACTUALIZACION = 'Última actualización: 09:41'
const NOMBRE_CUENTA = accountForRole('ADMIN').nombre

/**
 * La barra superior del armazón, ubicada por el armazón y no por el rol `banner`: la cabecera del
 * tablero también es un `<header>` y también se anuncia como banner.
 */
function barraSuperior() {
  return within(document.querySelector('[data-ui="shell-frame"] header'))
}

/** El bloque de perfil es el único botón con menú de la barra superior. */
function perfil() {
  return screen.getByRole('button', { name: new RegExp(NOMBRE_CUENTA) })
}

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

  it('muestra el panel lateral con su nombre accesible', () => {
    expect(screen.getByRole('navigation', { name: 'MENÚ OPERATIVO' })).toBeInTheDocument()
  })

  it('no dibuja el título del panel como texto visible', () => {
    // El diseño no muestra títulos de sección: el nombre queda solo como nombre accesible, para
    // que un lector de pantalla siga sabiendo de qué panel se trata.
    expect(screen.queryByText('MENÚ OPERATIVO')).not.toBeInTheDocument()
  })

  it('muestra los ítems del menú en el orden que fija el spec', () => {
    const enlaces = screen.getAllByRole('link')

    expect(enlaces.map((enlace) => enlace.textContent)).toEqual(ETIQUETAS_ESPERADAS)
  })

  it('deja el orden del menú en un solo lugar, el de navegación', () => {
    expect(SECCIONES_ADMIN.map((seccion) => seccion.etiqueta)).toEqual(ETIQUETAS_ESPERADAS)
  })

  it('muestra el breadcrumb con la sección abierta', () => {
    const barra = barraSuperior()

    expect(barra.getByRole('navigation', { name: 'Ubicación' })).toHaveTextContent('Mi espacio')
    expect(barra.getByText('Dashboard')).toBeInTheDocument()
  })

  it('no muestra la sede ni el período lectivo en la barra superior', () => {
    const barra = barraSuperior()

    // La sede desaparece del armazón y el período lectivo vive en el pie: el prototipo los tenía
    // en la barra y el spec los saca de ahí a propósito.
    expect(barra.queryByText('Sede Constituciones')).not.toBeInTheDocument()
    expect(barra.queryByText(PERIODO_LECTIVO)).not.toBeInTheDocument()
    expect(screen.queryByText('Sede Constituciones')).not.toBeInTheDocument()
  })

  it('identifica el rol siempre como Secretaría, aunque el rol sea ADMIN', () => {
    expect(perfil()).toHaveTextContent(NOMBRE_CUENTA)
    expect(perfil()).toHaveTextContent('Secretaría')
  })

  it('abre el menú de perfil con el cierre de sesión como única entrada', async () => {
    const user = userEvent.setup()

    await user.click(perfil())

    const menu = await screen.findByRole('menu', { name: 'Opciones de la cuenta' })
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(1)
    expect(within(menu).getByRole('menuitem', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('muestra el pie con el tagline, el período lectivo y la última actualización', () => {
    const pie = screen.getByRole('contentinfo')

    expect(pie).toHaveTextContent(TAGLINE)
    expect(pie).toHaveTextContent(PERIODO_LECTIVO)
    expect(pie).toHaveTextContent(ULTIMA_ACTUALIZACION)
  })

  it('no deja el nombre de la cuenta ni la terminal en el pie', () => {
    // El nombre y el rol viven en el bloque de perfil: el pie no repite la cuenta.
    const pie = screen.getByRole('contentinfo')

    expect(pie).not.toHaveTextContent(NOMBRE_CUENTA)
    expect(pie).not.toHaveTextContent('Terminal Interna 04')
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
    // El breadcrumb sigue a la pantalla abierta, no a la ruta inicial.
    expect(barraSuperior().getByText('Docentes')).toBeInTheDocument()
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
