import { describe, expect, it, vi } from 'vitest'
import { DataSourceError, createApiDataSource } from './apiDataSource'

/**
 * La fuente real de la frontera de datos (D36).
 *
 * Acá se verifican las dos reglas que sostienen el resto del change, y las dos son sobre **qué hace
 * la fuente cuando la API no contesta bien**:
 *
 * 1. Las lecturas caen al ejemplo **solo con 404**. Un 500 o un error de red se propagan, porque
 *    un ejemplo mostrado como si fuera un dato hace creer que la pantalla funciona.
 * 2. Los POST **nunca** caen, ni con 404. Es lo que separa una demo honesta de una que miente: si
 *    el alta cayera al ejemplo, escribiría en un arreglo de memoria y la secretaría se iría
 *    creyendo que guardó.
 *
 * La segunda es la que importa: el modo por omisión es `api`, así que un POST que cae al ejemplo es
 * el camino que se ejecuta siempre que el backend no está.
 */

function responder(status, cuerpo) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(cuerpo), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function ultimaRuta(fetchMock) {
  return fetchMock.mock.calls.at(-1)[0]
}

describe('la fuente real usa las rutas del contrato', () => {
  it('consulta y escribe en los cuatro endpoints del catálogo', async () => {
    const fetchMock = responder(200, [])
    const fuente = createApiDataSource()

    await fuente.listarCursos()
    expect(ultimaRuta(fetchMock)).toMatch(/\/cursos$/)

    await fuente.crearCurso({ nombre: 'Excel Intermedio' })
    expect(ultimaRuta(fetchMock)).toMatch(/\/cursos$/)
    expect(fetchMock.mock.calls.at(-1)[1].method).toBe('POST')

    await fuente.crearComision({ curso_id: 1 })
    expect(ultimaRuta(fetchMock)).toMatch(/\/comisiones$/)

    await fuente.crearDocente({ nombre: 'Ada' })
    expect(ultimaRuta(fetchMock)).toMatch(/\/docentes$/)

    await fuente.listarSedes()
    expect(ultimaRuta(fetchMock)).toMatch(/\/sedes$/)
  })

  it('manda el cuerpo del alta tal cual lo arma la pantalla', async () => {
    const fetchMock = responder(200, { id: 1, codigo: 'CUR001' })

    await createApiDataSource().crearCurso({ nombre: 'Excel Intermedio', descripcion: null })

    const opciones = fetchMock.mock.calls.at(-1)[1]
    expect(opciones.method).toBe('POST')
    expect(JSON.parse(opciones.body)).toEqual({ nombre: 'Excel Intermedio', descripcion: null })
    expect(opciones.headers['Content-Type']).toBe('application/json')
  })

  it('deriva el total del catálogo de la lista, en vez de pedir un resumen que no existe', async () => {
    const fetchMock = responder(200, [{ codigo: 'CUR001-1' }, { codigo: 'CUR002-1' }])

    const resumen = await createApiDataSource().obtenerResumenCatalogo()

    expect(resumen).toEqual({ total_comisiones: 2 })
    // El `?resumen=true` viejo devolvía la lista entera y el chip mostraba `undefined`.
    expect(ultimaRuta(fetchMock)).not.toMatch(/resumen/)
  })
})

describe('las lecturas caen al ejemplo solo con 404', () => {
  it('devuelve el ejemplo cuando el endpoint no existe', async () => {
    responder(404, { detail: 'Not Found' })

    const comisiones = await createApiDataSource().listarAlumnos()

    expect(comisiones).toHaveLength(6)
  })

  it('propaga un 500 en vez de inventar el dato', async () => {
    responder(500, { detail: 'Error interno' })

    await expect(createApiDataSource().listarAlumnos()).rejects.toThrow(/500/)
  })

  it('propaga un error de conexión en vez de inventar el dato', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    await expect(createApiDataSource().listarAlumnos()).rejects.toThrow(/No pudimos conectar/)
  })

  it('sube el motivo del rechazo tal cual lo escribió el backend', async () => {
    responder(422, { detail: 'Ya existe un curso con ese nombre: CUR001 — Python Inicial.' })

    await expect(createApiDataSource().crearCurso({ nombre: 'Python Inicial' })).rejects.toThrow(
      'Ya existe un curso con ese nombre: CUR001 — Python Inicial.',
    )
  })
})

describe('los POST nunca caen al ejemplo', () => {
  it('falla un alta de curso con 404 en vez de escribir en el ejemplo', async () => {
    responder(404, { detail: 'Not Found' })

    // Si cayera, el ejemplo devolvería un curso inventado y la pantalla confirmaría un alta que
    // no existe en la base. Por eso la promesa es que rechace.
    await expect(createApiDataSource().crearCurso({ nombre: 'Excel' })).rejects.toThrow(DataSourceError)
  })

  it('falla un alta de comisión con 500 en vez de escribir en el ejemplo', async () => {
    responder(500, { detail: 'Error interno' })

    await expect(createApiDataSource().crearComision({ curso_id: 1 })).rejects.toThrow(/500/)
  })

  it('falla un alta de docente con un error de conexión en vez de escribir en el ejemplo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    await expect(createApiDataSource().crearDocente({ nombre: 'Ada' })).rejects.toThrow(
      /No pudimos conectar/,
    )
  })

  it('no escribe en el ejemplo aunque el método de lectura sí sepa hacerlo', async () => {
    // El mismo backend, con un método de cada tipo: el que lee cae, el que escribe no. Comparar
    // los dos en el mismo test deja claro que la diferencia es el método, no el estado del server.
    responder(404, { detail: 'Not Found' })
    const fuente = createApiDataSource()

    await expect(fuente.listarAlumnos()).resolves.toHaveLength(6)
    await expect(fuente.crearDocente({ nombre: 'Ada' })).rejects.toThrow()
  })
})