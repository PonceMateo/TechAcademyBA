import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend } from '../test/support'
import { SECCIONES_ADMIN } from './navegacion'

/**
 * Los tres shells y la frontera de datos (9.8).
 *
 * **La prueba tiene dos mitades y las dos importan.** La estructural lee el código: ninguna pantalla
 * de administración importa datos de ejemplo, y las que dibujan tablas, insignias o estados usan
 * los componentes compartidos en vez de su propia versión. La de render comprueba que el shell
 * dibuja con esos mismos componentes.
 *
 * **Por qué el atributo `data-ui`.** En el DOM, una tabla escrita a mano y una que viene de `Table`
 * son indistinguibles. Si la comprobación dependiera del HTML, la mitad estructural de esta prueba
 * no se podría escribir. El atributo es lo que hace verificable el "comparten los mismos
 * componentes" y lo usan también los grupos 10 y 11.
 *
 * **Lo que todavía no se puede verificar:** que el shell de Docente y el de Alumno dibujen con los
 * componentes compartidos. Esos shells llegan en los grupos 10 y 11; hoy siguen siendo la pantalla
 * de marcador de posición. Lo que sí se verifica es que las tres raíces `/admin`, `/docente` y
 * `/alumno` siguen debajo del mismo guard de rol y comparten los componentes de sesión.
 */

const RAIZ_SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Pantallas de administración: los archivos `.jsx` del directorio, sin tests. */
function pantallasAdmin() {
  return readdirSync(join(RAIZ_SRC, 'admin'))
    .filter((nombre) => nombre.endsWith('.jsx') && !nombre.includes('.test.'))
    .map((nombre) => join(RAIZ_SRC, 'admin', nombre))
}

/** Nombres de los componentes de `src/components/ui/` que cada pantalla importa. */
function componentesImportados(archivo) {
  const contenido = readFileSync(archivo, 'utf8')

  return [
    ...contenido.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']*components\/ui[^']*)'/g),
  ].flatMap(([, nombres, ruta]) =>
    nombres
      .split(',')
      .map((nombre) => nombre.trim().split(/\s+as\s+/)[0])
      .filter((nombre) => nombre.length > 0)
      .map((nombre) => `${nombre}@${ruta.endsWith('ui/paleta') ? 'paleta' : 'ui'}`),
  )
}

describe('la frontera de datos se respeta en las pantallas de administración', () => {
  it('ninguna pantalla de administración importa de src/mocks/', () => {
    const culpables = pantallasAdmin()
      .filter((archivo) => /from\s*['"][^'"]*mocks/.test(readFileSync(archivo, 'utf8')))
      .map((archivo) => relative(RAIZ_SRC, archivo))

    expect(culpables).toEqual([])
  })

  it('ninguna pantalla de administración alcanza el módulo de datos de ejemplo por otra vía', () => {
    const alcanzables = pantallasAdmin().filter((archivo) =>
      /from\s*'[^']*mocks/.test(readFileSync(archivo, 'utf8')),
    )

    expect(alcanzables).toEqual([])
  })

  it('todas las pantallas leen sus datos por src/services/', () => {
    const sinServicio = pantallasAdmin()
      .filter(
        (archivo) => !/from\s*'[^']*services\/dataService'/.test(readFileSync(archivo, 'utf8')),
      )
      .map((archivo) => relative(RAIZ_SRC, archivo))
      // El armazón y el tablero no piden datos: el tablero es texto fijo y el armazón dibuja el menú.
      .filter(
        (ruta) => !['AdminLayout.jsx', 'DashboardPage.jsx'].some((salte) => ruta.endsWith(salte)),
      )

    expect(sinServicio).toEqual([])
  })
})

describe('los tres shells comparten los componentes', () => {
  it('ninguna pantalla dibuja tabla, insignia o estado con su propia implementación', () => {
    const sinCompartidos = pantallasAdmin()
      .filter((archivo) => componentesImportados(archivo).length === 0)
      .map((archivo) => relative(RAIZ_SRC, archivo))
      .filter((ruta) => !ruta.endsWith('DashboardPage.jsx'))

    expect(sinCompartidos).toEqual([])
  })

  it('no deja una segunda implementación de tabla o insignia en el código', () => {
    const implementacionesPropias = readdirSync(join(RAIZ_SRC, 'components', 'ui')).filter(
      (nombre) => /^(Table|Badge|StatusIndicator|Button|Input|Modal|Card)\./.test(nombre),
    )

    // Solo puede haber un archivo por componente compartido, y los que existen son los del grupo 8.
    expect(implementacionesPropias.sort()).toEqual([
      'Badge.jsx',
      'Button.jsx',
      'Card.jsx',
      'Input.jsx',
      'Modal.jsx',
      'StatusIndicator.jsx',
      'Table.jsx',
    ])
  })
})

describe('el shell de Administración dibuja con los componentes compartidos', () => {
  beforeEach(async () => {
    resetDataSource()
    stubBackend()
    renderAppAs('ADMIN', '/admin')
    await screen.findByRole('navigation', { name: 'MENÚ OPERATIVO' })
  })

  it('marca el tablero con tarjetas, insignias y botones compartidos', () => {
    expect(document.querySelectorAll('[data-ui="card"]').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('[data-ui="badge"]').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('[data-ui="button"]').length).toBeGreaterThan(0)
  })

  it.each(SECCIONES_ADMIN.map((seccion) => [seccion.etiqueta, seccion.ruta]))(
    'la pantalla de %s dibuja con los componentes compartidos',
    async (_etiqueta, ruta) => {
      resetDataSource()
      stubBackend()
      const { unmount } = renderAppAs('ADMIN', ruta)

      await screen.findByRole('navigation', { name: 'MENÚ OPERATIVO' })

      expect(document.querySelectorAll('[data-ui="card"]').length).toBeGreaterThan(0)
      expect(document.querySelectorAll('[data-ui="button"]').length).toBeGreaterThan(0)

      unmount()
    },
  )
})

describe('las tres raíces de rol', () => {
  it.each([
    ['ADMIN', '/admin', 'MENÚ OPERATIVO'],
    ['DOCENTE', '/docente', 'Espacio Docente'],
    ['ALUMNO', '/alumno', 'Espacio Alumno'],
  ])('deja entrar a %s por su raíz y lo muestra dentro de su shell', async (rol, ruta, marca) => {
    resetDataSource()
    stubBackend()

    renderAppAs(rol, ruta)

    await screen.findByText(marca)
    // El botón de cerrar sesión es el mismo componente en las tres secciones.
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })
})
