import { describe, expect, it, vi } from 'vitest'
import { DataSourceError, createApiDataSource } from './apiDataSource'

/**
 * La fuente real de la frontera de datos (D36).
 *
 * Acá se verifica qué hace la fuente cuando la API no contesta bien, que ahora es una sola regla:
 * **todo fallo se propaga**. Un 404, un 500, un error de red o el `detail` de un 422 suben tal
 * cual; ninguno se disfraza de dato válido, porque un ejemplo mostrado como si fuera un dato hace
 * creer que la pantalla funciona (D42).
 *
 * Los POST son el caso que más importa: un alta que no llega a la base falla y lo dice, en vez de
 * escribir en un arreglo de memoria y hacer creer a la secretaría que guardó.
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
  it('consulta y escribe en los endpoints del catálogo', async () => {
    const fetchMock = responder(200, [])
    const fuente = createApiDataSource()

    await fuente.listarCursos()
    expect(ultimaRuta(fetchMock)).toMatch(/\/cursos$/)

    await fuente.crearCurso({ nombre: 'Excel Intermedio' })
    expect(ultimaRuta(fetchMock)).toMatch(/\/cursos$/)
    expect(fetchMock.mock.calls.at(-1)[1].method).toBe('POST')

    await fuente.crearComision({ curso_id: 1 })
    expect(ultimaRuta(fetchMock)).toMatch(/\/comisiones$/)

    await fuente.editarComision(4, { docente_id: 2, cupo_maximo: 25 })
    expect(ultimaRuta(fetchMock)).toMatch(/\/comisiones\/4$/)
    expect(fetchMock.mock.calls.at(-1)[1].method).toBe('PUT')

    await fuente.crearDocente({ nombre: 'Ada' })
    expect(ultimaRuta(fetchMock)).toMatch(/\/docentes$/)

    await fuente.listarSedes()
    expect(ultimaRuta(fetchMock)).toMatch(/\/sedes$/)
  })

  it('busca docentes con q y mapea las comisiones de la respuesta', async () => {
    const fetchMock = responder(200, [
      {
        id: 1,
        nombre: 'Rita',
        apellido: 'Molina',
        dni: '30111222',
        cuil: null,
        email: 'rita.molina@techacademy.invalid',
        telefono: null,
        activo: true,
        cantidad_comisiones: 1,
        comisiones: [{ id: 7, codigo: 'CUR101-1', nombre: 'Python Inicial' }],
      },
    ])

    const [fila] = await createApiDataSource().buscarDocentes('rita molina')

    expect(ultimaRuta(fetchMock)).toMatch(/\/docentes\?q=rita\+molina$/)
    expect(fila).toMatchObject({
      nombre: 'Rita Molina',
      comisiones_asignadas: 1,
      comisiones: [{ id: 7, codigo: 'CUR101-1', nombre: 'Python Inicial' }],
    })
  })

  it('edita un docente y restablece su contraseña con las rutas del padrón', async () => {
    const fetchMock = responder(200, {
      id: 2,
      nombre: 'Rita',
      apellido: 'Molina',
      dni: '30111222',
      cuil: null,
      email: 'rita.molina@techacademy.invalid',
      telefono: null,
      activo: true,
      cantidad_comisiones: 0,
      comisiones: [],
    })
    const fuente = createApiDataSource()

    const fila = await fuente.editarDocente(2, {
      nombre: 'Rita',
      apellido: 'Molina',
      dni: '30111222',
      email: 'rita.molina@techacademy.invalid',
      telefono: null,
    })
    expect(ultimaRuta(fetchMock)).toMatch(/\/docentes\/2$/)
    expect(fetchMock.mock.calls.at(-1)[1].method).toBe('PUT')
    // El nombre de pila viaja aparte para que el modal pueda precargar los dos campos.
    expect(fila).toMatchObject({ nombre: 'Rita Molina', nombres: 'Rita', apellido: 'Molina' })

    await fuente.restablecerPasswordDocente(2, 'NuevaClave2026')
    expect(ultimaRuta(fetchMock)).toMatch(/\/docentes\/2\/password$/)
    expect(fetchMock.mock.calls.at(-1)[1].method).toBe('POST')
    expect(JSON.parse(fetchMock.mock.calls.at(-1)[1].body)).toEqual({
      new_password: 'NuevaClave2026',
    })
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

  it('edita un curso con PUT sobre su identificador', async () => {
    const fetchMock = responder(200, {
      id: 7,
      codigo: 'CUR007',
      nombre: 'Excel Intermedio',
      descripcion: null,
    })
    const datos = { nombre: 'Excel Intermedio', descripcion: null }

    const actualizado = await createApiDataSource().editarCurso(7, datos)

    expect(actualizado).toMatchObject({ id: 7, codigo: 'CUR007' })
    expect(ultimaRuta(fetchMock)).toMatch(/\/cursos\/7$/)
    const opciones = fetchMock.mock.calls.at(-1)[1]
    expect(opciones.method).toBe('PUT')
    expect(JSON.parse(opciones.body)).toEqual(datos)
  })
})

describe('toda lectura que falla se propaga', () => {
  it('propaga un 404 con su status en vez de inventar el dato', async () => {
    responder(404, { detail: 'Not Found' })

    await expect(createApiDataSource().listarAlumnos()).rejects.toMatchObject({ status: 404 })
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

describe('el alta de alumno', () => {
  const ALTA = {
    documento: '30.111.222',
    nombre: 'Rocío Álvarez',
    email: 'rocio.alvarez@techacademy.invalid',
    telefono: null,
  }

  it('hace POST a /alumnos con el cuerpo tal cual lo arma la pantalla', async () => {
    const fetchMock = responder(201, {
      id: 7,
      ...ALTA,
      tipo_documento: 'DNI',
      password_inicial: 'rocio30111222',
    })

    const creado = await createApiDataSource().crearAlumno(ALTA)

    expect(creado).toMatchObject({ id: 7, nombre: 'Rocío Álvarez' })
    expect(creado.password_inicial).toBe('rocio30111222')
    const [url, opciones] = fetchMock.mock.calls.at(-1)
    expect(url).toMatch(/\/alumnos$/)
    expect(opciones.method).toBe('POST')
    expect(JSON.parse(opciones.body)).toEqual(ALTA)
  })

  it('propaga el 409 con el motivo que nombra el dato repetido', async () => {
    responder(409, { detail: 'Ya hay un alumno registrado con ese documento.' })

    await expect(createApiDataSource().crearAlumno(ALTA)).rejects.toThrow(/documento/)
  })

  it('falla con un error de conexión en vez de confirmar un alta que no llegó', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    await expect(createApiDataSource().crearAlumno(ALTA)).rejects.toThrow(/No pudimos conectar/)
  })
})

describe('edición, contraseña y baja de alumno', () => {
  it('usa PUT, POST y DELETE sobre el alumno indicado', async () => {
    const fetchMock = responder(200, { id: 7, activo: true })

    const fuente = createApiDataSource()
    await fuente.editarAlumno(7, {
      documento: '30.111.222',
      nombre: 'Rocío Álvarez',
      email: 'rocio.alvarez@techacademy.invalid',
      telefono: null,
    })
    expect(ultimaRuta(fetchMock)).toMatch(/\/alumnos\/7$/)
    expect(fetchMock.mock.calls.at(-1)[1].method).toBe('PUT')

    await fuente.restablecerPasswordAlumno(7, 'NuevaClave2026')
    expect(ultimaRuta(fetchMock)).toMatch(/\/alumnos\/7\/password$/)
    expect(fetchMock.mock.calls.at(-1)[1].method).toBe('POST')
    expect(JSON.parse(fetchMock.mock.calls.at(-1)[1].body)).toEqual({
      new_password: 'NuevaClave2026',
    })

    await fuente.eliminarAlumno(7)
    expect(ultimaRuta(fetchMock)).toMatch(/\/alumnos\/7$/)
    expect(fetchMock.mock.calls.at(-1)[1].method).toBe('DELETE')
  })

  it('consulta la reactivación y la confirma sobre el mismo alumno', async () => {
    const fetchMock = responder(200, { id: 7, activo: false })
    const fuente = createApiDataSource()
    const datos = {
      documento: '30.111.222',
      nombre: 'Rocío Álvarez',
      email: 'rocio.alvarez@techacademy.invalid',
      telefono: null,
    }

    await fuente.buscarAlumnoReactivable({ documento: datos.documento, email: datos.email })
    const consulta = new URL(ultimaRuta(fetchMock), 'http://localhost')
    expect(consulta.pathname).toMatch(/\/alumnos\/reactivable$/)
    expect(consulta.searchParams.get('documento')).toBe(datos.documento)
    expect(consulta.searchParams.get('email')).toBe(datos.email)

    await fuente.reactivarAlumno(7, datos)
    expect(ultimaRuta(fetchMock)).toMatch(/\/alumnos\/7\/reactivar$/)
    expect(fetchMock.mock.calls.at(-1)[1].method).toBe('POST')
    expect(JSON.parse(fetchMock.mock.calls.at(-1)[1].body)).toEqual(datos)
  })
})

describe('los POST nunca caen al ejemplo', () => {
  it('falla un alta de curso con 404 en vez de escribir en el ejemplo', async () => {
    responder(404, { detail: 'Not Found' })

    // Si cayera, el ejemplo devolvería un curso inventado y la pantalla confirmaría un alta que
    // no existe en la base. Por eso la promesa es que rechace.
    await expect(createApiDataSource().crearCurso({ nombre: 'Excel' })).rejects.toThrow(
      DataSourceError,
    )
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
})

describe('cobranzas manuales (HU 21)', () => {
  const ALTA = {
    fecha: '2026-06-01',
    importe: 45000,
    medio: 'EFECTIVO',
    titular: 'Juan Ignacio Pérez',
    estado: 'ACREDITADO',
    alumno_id: 1,
    inscripcion_id: 7,
    factura_a_solicitada: false,
    cuit_titular: null,
  }

  it('consulta el historial y busca por titular con q', async () => {
    const fetchMock = responder(200, [])

    await createApiDataSource().listarCobranzas('perez')

    const consulta = new URL(ultimaRuta(fetchMock), 'http://localhost')
    expect(consulta.pathname).toMatch(/\/cobranzas$/)
    expect(consulta.searchParams.get('q')).toBe('perez')
  })

  it('consulta las inscripciones activas del alumno', async () => {
    const fetchMock = responder(200, [])

    await createApiDataSource().listarInscripcionesDeAlumno(7)

    expect(ultimaRuta(fetchMock)).toMatch(/\/alumnos\/7\/inscripciones$/)
  })

  it('traduce `imputacion.alumno` al `nombre` que ya usa la pantalla', async () => {
    responder(200, [
      {
        id: 1,
        pagador: { id: 1, nombre: 'Verificación HU 21' },
        imputacion: {
          id: 1,
          inscripcion_id: 7,
          monto: '12345.00',
          alumno_id: 4,
          alumno: 'Santiago Torrens',
          comision: { codigo: 'CUR001-1', nombre: 'Python Inicial' },
        },
      },
    ])

    const [fila] = await createApiDataSource().listarCobranzas()

    expect(fila.imputacion.nombre).toBe('Santiago Torrens')
    expect(fila.imputacion.alumno).toBe('Santiago Torrens')
  })

  it('hace POST a /cobranzas con el cuerpo tal cual lo arma la pantalla', async () => {
    const fetchMock = responder(201, { id: 1, ...ALTA })

    const creada = await createApiDataSource().registrarCobranza(ALTA)

    expect(creada).toMatchObject({ id: 1, importe: 45000 })
    expect(ultimaRuta(fetchMock)).toMatch(/\/cobranzas$/)
    expect(fetchMock.mock.calls.at(-1)[1].method).toBe('POST')
    expect(JSON.parse(fetchMock.mock.calls.at(-1)[1].body)).toEqual(ALTA)
  })

  it('propaga el motivo del rechazo para que la pantalla lo muestre', async () => {
    responder(422, {
      detail: 'El alumno no tiene una inscripción activa para imputar el pago.',
    })

    await expect(createApiDataSource().registrarCobranza(ALTA)).rejects.toThrow(
      /no tiene una inscripción activa/,
    )
  })

  it('propaga el detalle de un 404 de dominio', async () => {
    responder(404, { detail: 'El alumno no existe.' })

    await expect(createApiDataSource().listarInscripcionesDeAlumno(99)).rejects.toThrow(
      'El alumno no existe.',
    )
  })
})
