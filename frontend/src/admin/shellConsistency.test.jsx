import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { accountForRole, renderAppAs, resetDataSource, stubBackend } from '../test/support'
import { SECCIONES_ALUMNO } from '../alumno/navegacion'
import { SECCIONES_DOCENTE } from '../docente/navegacion'
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
 * componentes" y lo usan los grupos 10 y 11.
 *
 * **Qué mira ahora.** Con los tres shells montados, la prueba afirma dos cosas más: que las
 * pantallas de los tres directorios —`admin`, `docente` y `alumno`— leen sus datos por el servicio y
 * no por los mocks, y que los tres armazones salen del mismo `ShellFrame`. Lo segundo es lo que
 * hace que "los tres shells comparten los mismos componentes" sea una afirmación sobre el código y
 * no una impresión mirando la pantalla.
 *
 * **El botón compartido ya no está siempre a la vista.** Antes el pie del armazón mostraba el botón
 * de cerrar sesión en todas las pantallas, así que afirmar "toda pantalla tiene un `Button`" salía
 * gratis. Desde el change `ui-figma-dashboards` el cierre de sesión vive en el menú de perfil, que
 * se dibuja al abrirlo, así que la afirmación se parte en dos: cada pantalla dibuja tarjetas del
 * componente compartido, y el armazón de las tres secciones sigue cerrando sesión con ese botón.
 */

const RAIZ_SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Los tres directorios de pantallas, con la etiqueta que los identifica en los mensajes. */
const SHELLS = Object.freeze([
  { etiqueta: 'administración', directorio: 'admin' },
  { etiqueta: 'docente', directorio: 'docente' },
  { etiqueta: 'alumno', directorio: 'alumno' },
])

/** Pantallas de un shell: los archivos `.jsx` del directorio, sin tests. */
function pantallasDe(directorio) {
  const ruta = join(RAIZ_SRC, directorio)

  if (!existsSync(ruta)) {
    return []
  }

  return readdirSync(ruta)
    .filter((nombre) => nombre.endsWith('.jsx') && !nombre.includes('.test.'))
    .map((nombre) => join(ruta, nombre))
}

/** Pantallas de los tres shells, con la ruta relativa a `src/` para los mensajes. */
function pantallasDeTodosLosShells() {
  return SHELLS.flatMap(({ etiqueta, directorio }) =>
    pantallasDe(directorio).map((archivo) => ({ etiqueta, archivo })),
  )
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

/**
 * Los armazones y los tableros no piden datos: un armazón dibuja el menú y el tablero de
 * Administración es texto fijo. Son las únicas pantallas de las tres secciones con esa excepción, y
 * las dos existen solo porque el tablero no tiene historia que la cubra.
 */
const SIN_DATOS_POR_DISENO = [
  'AdminLayout.jsx',
  'DashboardPage.jsx',
  'TeacherLayout.jsx',
  'StudentLayout.jsx',
]

describe('la frontera de datos se respeta en las pantallas de los tres shells', () => {
  it.each(SHELLS.map((shell) => [shell.etiqueta, shell.directorio]))(
    'ninguna pantalla de %s importa de src/mocks/',
    (_etiqueta, directorio) => {
      const culpables = pantallasDe(directorio)
        .filter((archivo) => /from\s*['"][^'"]*mocks/.test(readFileSync(archivo, 'utf8')))
        .map((archivo) => relative(RAIZ_SRC, archivo))

      expect(culpables).toEqual([])
    },
  )

  it('ninguna pantalla alcanza el módulo de datos de ejemplo por otra vía', () => {
    const alcanzables = pantallasDeTodosLosShells()
      .filter(({ archivo }) => /from\s*'[^']*mocks/.test(readFileSync(archivo, 'utf8')))
      .map(({ etiqueta, archivo }) => `${etiqueta}: ${relative(RAIZ_SRC, archivo)}`)

    expect(alcanzables).toEqual([])
  })

  it('todas las pantallas leen sus datos por src/services/', () => {
    const sinServicio = pantallasDeTodosLosShells()
      .filter(
        ({ archivo }) => !/from\s*'[^']*services\/dataService'/.test(readFileSync(archivo, 'utf8')),
      )
      .map(({ etiqueta, archivo }) => `${etiqueta}: ${relative(RAIZ_SRC, archivo)}`)
      .filter((descripcion) => !SIN_DATOS_POR_DISENO.some((salte) => descripcion.endsWith(salte)))

    expect(sinServicio).toEqual([])
  })
})

describe('los tres shells comparten los componentes', () => {
  it('ninguna pantalla dibuja tabla, insignia o estado con su propia implementación', () => {
    const sinCompartidos = pantallasDeTodosLosShells()
      .filter(({ archivo }) => componentesImportados(archivo).length === 0)
      .map(({ etiqueta, archivo }) => `${etiqueta}: ${relative(RAIZ_SRC, archivo)}`)
      // El tablero de Administración es texto fijo y los armazones no dibujan nada: dibujan el menú y
      // le pasan la pantalla al armazón compartido. Que los tres armazones usen `ShellFrame` lo
      // afirma la prueba de abajo.
      .filter(
        (descripcion) =>
          !descripcion.endsWith('DashboardPage.jsx') && !descripcion.includes('Layout.jsx'),
      )

    expect(sinCompartidos).toEqual([])
  })

  it('los tres armazones salen del mismo componente compartido', () => {
    const armazones = [
      'admin/AdminLayout.jsx',
      'docente/TeacherLayout.jsx',
      'alumno/StudentLayout.jsx',
    ].map((ruta) => join(RAIZ_SRC, ruta))

    // Con los tres shells montados, los tres tienen que usar `ShellFrame`: es lo que convierte "los
    // shells comparten los mismos componentes" en una afirmación sobre el código y no en una
    // impresión mirando la pantalla.
    expect(armazones).toHaveLength(3)
    for (const armazon of armazones) {
      expect(existsSync(armazon), `${armazon} no existe`).toBe(true)
      expect(readFileSync(armazon, 'utf8')).toMatch(/import\s*\{\s*ShellFrame\s*\}/)
    }
  })

  it('no deja una segunda implementación de tabla, insignia ni avatar en el código', () => {
    const implementacionesPropias = readdirSync(join(RAIZ_SRC, 'components', 'ui')).filter(
      (nombre) => /^(Table|Badge|StatusIndicator|Button|Input|Modal|Card|Avatar)\./.test(nombre),
    )

    // Solo puede haber un archivo por componente compartido. `Avatar` llegó con los shells de
    // docente y de alumno, que muestran las iniciales en el pie y en la ficha de perfil.
    expect(implementacionesPropias.sort()).toEqual([
      'Avatar.jsx',
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

describe('el tablero de Administración dibuja con los componentes compartidos', () => {
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
})

describe('las pantallas de cada shell dibujan con los componentes compartidos', () => {
  it.each([
    ['ADMIN', 'MENÚ OPERATIVO', SECCIONES_ADMIN.map((seccion) => seccion.ruta)],
    [
      'DOCENTE',
      'ESPACIO DOCENTE',
      SECCIONES_DOCENTE.filter((seccion) => seccion.ruta).map((seccion) => seccion.ruta),
    ],
    [
      'ALUMNO',
      'ESPACIO ALUMNO',
      SECCIONES_ALUMNO.filter((seccion) => seccion.ruta).map((seccion) => seccion.ruta),
    ],
  ])(
    'la sección de %s marca sus pantallas con tarjetas y botones compartidos',
    async (rol, tituloMenu, rutas) => {
      for (const ruta of rutas) {
        resetDataSource()
        stubBackend()
        const { unmount } = renderAppAs(rol, ruta)

        await screen.findByRole('navigation', { name: tituloMenu })

        // Las pantallas piden sus datos por el servicio, así que el armazón aparece antes que la
        // pantalla: hay que esperar a que la pantalla haya dibujado.
        await waitFor(() =>
          expect(
            document.querySelectorAll('[data-ui="card"]').length,
            `${ruta} sin tarjetas`,
          ).toBeGreaterThan(0),
        )

        unmount()
      }
    },
  )

  it.each([
    ['ADMIN', 'MENÚ OPERATIVO'],
    ['DOCENTE', 'ESPACIO DOCENTE'],
    ['ALUMNO', 'ESPACIO ALUMNO'],
  ])(
    'la sección de %s cierra la sesión con el botón compartido del menú de perfil',
    async (rol, tituloMenu) => {
      resetDataSource()
      stubBackend()
      renderAppAs(rol, rol === 'ADMIN' ? '/admin' : `/${rol.toLowerCase()}`)
      await screen.findByRole('navigation', { name: tituloMenu })

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: new RegExp(accountForRole(rol).nombre) }))

      expect(await screen.findByRole('menuitem', { name: 'Cerrar sesión' })).toBeInTheDocument()
      expect(document.querySelectorAll('[data-ui="button"]').length).toBeGreaterThan(0)
    },
  )
})

describe('navegación por teclado en los tres armazones (6.2)', () => {
  it.each([
    ['ADMIN', '/admin', 'MENÚ OPERATIVO'],
    ['DOCENTE', '/docente', 'ESPACIO DOCENTE'],
    ['ALUMNO', '/alumno', 'ESPACIO ALUMNO'],
  ])('deja llegar al perfil con Tab y abrir su menú con Enter en %s', async (rol, ruta, marca) => {
    resetDataSource()
    stubBackend()
    renderAppAs(rol, ruta)
    await screen.findByRole('navigation', { name: marca })

    const user = userEvent.setup()
    // El lateral va primero en el DOM (ocupa toda la altura a la izquierda): las primeras paradas
    // son sus enlaces y el perfil llega después. La búsqueda `⌘ K` y la campana son composición
    // inerte y no reciben foco.
    const enlaces = within(screen.getByRole('navigation', { name: marca })).getAllByRole('link')
    await user.tab()
    expect(document.activeElement).toBe(enlaces[0])
    for (let i = 1; i < enlaces.length; i += 1) {
      await user.tab()
    }
    await user.tab()
    const perfil = screen.getByRole('button', { name: new RegExp(accountForRole(rol).nombre) })
    expect(document.activeElement).toBe(perfil)

    await user.keyboard('{Enter}')
    expect(await screen.findByRole('menuitem', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('deja cerrar la sesión solo con el teclado', async () => {
    resetDataSource()
    stubBackend()
    renderAppAs('ADMIN', '/admin')
    await screen.findByRole('navigation', { name: 'MENÚ OPERATIVO' })

    const user = userEvent.setup()
    // El perfil llega después del lateral: se atraviesan sus enlaces antes de abrir el menú.
    const enlaces = within(
      screen.getByRole('navigation', { name: 'MENÚ OPERATIVO' }),
    ).getAllByRole('link')
    for (let i = 0; i < enlaces.length + 1; i += 1) {
      await user.tab()
    }
    await user.keyboard('{Enter}')
    await user.tab()

    const salir = screen.getByRole('menuitem', { name: 'Cerrar sesión' })
    expect(document.activeElement).toBe(salir)

    await user.keyboard('{Enter}')
    // La sesión se cierra y vuelve el acceso, sin haber usado el mouse.
    expect(await screen.findByLabelText('Correo electrónico')).toBeInTheDocument()
  })
})

describe('los tres acentos de la identidad', () => {
  it('declara un bloque de acento por rol, y los tres son distintos', () => {
    const css = readFileSync(join(RAIZ_SRC, 'index.css'), 'utf8')

    const acentos = ['secretaria', 'docente', 'alumno'].map((rol) => {
      const bloque = new RegExp(`\\[data-acento='${rol}'\\]\\s*\\{[^}]*\\}`).exec(css)
      expect(bloque, `sin bloque de acento para ${rol}`).not.toBeNull()
      return bloque[0]
    })

    // El color es del rol y no de la pantalla: si dos bloques fueran iguales, dos shells se verían
    // iguales y el menú no distinguiría la sección en la que se está.
    expect(new Set(acentos).size).toBe(3)
  })
})

describe('las tres raíces de rol', () => {
  it.each([
    ['ADMIN', '/admin', 'MENÚ OPERATIVO'],
    ['DOCENTE', '/docente', 'ESPACIO DOCENTE'],
    ['ALUMNO', '/alumno', 'ESPACIO ALUMNO'],
  ])('deja entrar a %s por su raíz y lo muestra dentro de su shell', async (rol, ruta, marca) => {
    resetDataSource()
    stubBackend()

    renderAppAs(rol, ruta)

    // La marca de la sección es el nombre accesible de su panel: el título dejó de dibujarse
    // cuando el diseño sacó los rótulos de sección.
    await screen.findByRole('navigation', { name: marca })
    // Con esa marca montada, el armazón ya dibujó la barra superior y su bloque de perfil.
    expect(
      screen.getByRole('button', { name: new RegExp(accountForRole(rol).nombre) }),
    ).toBeInTheDocument()
  })

  it.each([
    ['DOCENTE', '/admin'],
    ['DOCENTE', '/alumno'],
    ['ALUMNO', '/admin'],
    ['ALUMNO', '/docente'],
  ])('rechaza con 403 que %s entre por %s', async (rol, rutaAjena) => {
    resetDataSource()
    stubBackend()

    renderAppAs(rol, rutaAjena)

    expect(
      await screen.findByRole('heading', { name: 'No tenés acceso a esta sección' }),
    ).toBeInTheDocument()
  })
})
