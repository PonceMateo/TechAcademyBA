import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * D13, verificado sobre el código (8.4).
 *
 * **Por qué una búsqueda de texto y no una prueba de render:** la regla que importa no es que las
 * pantallas no importen datos de ejemplo hoy, sino que el día que aparezca la API no haya que
 * reescribirlas. Eso se rompe con una sola importación colada y no lo detecta ningún test de
 * render. La única forma de vigilarlo es mirando qué importa qué.
 *
 * El alcance es `src/**`: cualquier archivo del frontend que cite `mocks` tiene que estar en la
 * capa de servicios o dentro de la propia capa de datos de ejemplo.
 */

const RAIZ_SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

function archivosDeSrc(directorio = RAIZ_SRC) {
  const encontrados = []

  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    const ruta = join(directorio, entrada.name)
    if (entrada.isDirectory()) {
      encontrados.push(...archivosDeSrc(ruta))
    } else if (/\.(js|jsx)$/.test(entrada.name) && !entrada.name.endsWith('.test.js')) {
      encontrados.push(ruta)
    }
  }

  return encontrados
}

/** Importaciones de `src/mocks/` que encuentra en un archivo. */
function importacionesDeMocks(contenido) {
  const patron = /from\s+['"]([^'"]*mocks[^'"]*)['"]/g
  const rutas = []

  for (const coincidencia of contenido.matchAll(patron)) {
    rutas.push(coincidencia[1])
  }

  return rutas
}

function esRutaDeMocks(ruta) {
  return ruta.includes(`mocks${sep}`) || ruta.endsWith('mocks')
}

describe('la frontera de datos', () => {
  const archivos = archivosDeSrc()
  const importaciones = []

  for (const archivo of archivos) {
    for (const ruta of importacionesDeMocks(readFileSync(archivo, 'utf8'))) {
      if (esRutaDeMocks(ruta)) {
        importaciones.push({ archivo: relative(RAIZ_SRC, archivo), ruta })
      }
    }
  }

  it('solo la capa de servicios y los propios datos de ejemplo importan de los mocks', () => {
    const fueraDeCapa = importaciones.filter(
      ({ archivo }) => !archivo.startsWith(`services${sep}`) && !archivo.startsWith(`mocks${sep}`),
    )

    expect(fueraDeCapa).toEqual([])
  })

  it('tiene la capa de servicios importando los mocks, y no al revés', () => {
    const desdeServicios = importaciones.filter(({ archivo }) =>
      archivo.startsWith(`services${sep}`),
    )

    expect(desdeServicios.length).toBeGreaterThan(0)
  })

  it('deja los datos de ejemplo sin dependencias hacia afuera', () => {
    const mocksConSalidas = archivos
      .filter((archivo) => relative(RAIZ_SRC, archivo).startsWith(`mocks${sep}`))
      .filter((archivo) => /from\s+['"][^.'"][^'"]*['"]/.test(readFileSync(archivo, 'utf8')))

    expect(mocksConSalidas).toEqual([])
  })

  it('no encuentra ninguna pantalla ni componente entre los que importan mocks', () => {
    const componentes = importaciones.filter(
      ({ archivo }) => archivo.startsWith(`components${sep}`) || archivo.startsWith(`admin${sep}`),
    )

    expect(componentes).toEqual([])
  })
})
