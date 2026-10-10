import { API_BASE_URL } from '../config/api'
import { readStoredToken } from '../auth/tokenStorage'
import { createMockDataSource } from './mockDataSource'

/**
 * Implementación real de la frontera de datos: habla con el backend (D36).
 *
 * **Las lecturas que no tienen endpoint caen al ejemplo, solo con un 404.** Los endpoints que
 * existen son los del catálogo y del padrón de docentes. Los de alumnos, empresas, cobranzas,
 * habilitación y clases todavía no están escritos, y las pantallas que los usan tienen que seguir
 * mostrando algo: si el modo real es el default (D36) y no hubiera caída, el tablero, la pantalla
 * de alumnos y la de cobranzas quedarían vacías.
 *
 * **Por qué solo 404 y no "cualquier error":** un error de red o un 500 disfrazado de dato
 * válido hace creer que la pantalla funciona. La ausencia de endpoint es el único caso en el que
 * el ejemplo es una respuesta honesta: lo que falta es el endpoint, y no hay dato que mostrar.
 *
 * **Los POST NUNCA caen. Es lo más importante de este archivo.** Un alta que no llega a la base
 * tiene que fallar y decir que no se guardó. Si cayera al ejemplo, escribiría en un arreglo de
 * memoria, la pantalla confirmaría un curso que no existe, y la secretaría se iría creyendo que
 * el sistema guarda. Es la diferencia entre una demo que miente y una demo honesta.
 *
 * **El token va en cada petición** porque el backend resuelve la sesión en cada request (M7): la
 * frontera de datos no tiene sesión propia. Se lee del mismo lugar que el login, para que haya un
 * solo dueño del token en el código.
 */
export class DataSourceError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'DataSourceError'
    this.status = status
  }
}

/**
 * Rutas por recurso. Las de `cursos`, `comisiones`, `docentes` y `sedes` quedaron **confirmadas**
 * por los endpoints reales del change `altas-catalogo-docentes`; las demás siguen provisionales
 * (M33) hasta que exista su endpoint.
 */
const PATHS = Object.freeze({
  cursos: '/cursos',
  comisiones: '/comisiones',
  docentes: '/docentes',
  alumnos: '/alumnos',
  empresas: '/empresas',
  sedes: '/sedes',
  cobranzas: '/cobranzas',
  habilitacion: '/habilitaciones/consulta',
  override: '/habilitaciones/override',
  comisionesAsignadas: '/docentes/mis-comisiones',
  perfilDocente: '/docentes/mi-perfil',
  padronComision: '/comisiones/:codigo/alumnos',
  asistencia: '/comisiones/:codigo/asistencia',
  linkClase: '/clases/link',
  inscripcionesAlumno: '/alumno/inscripciones',
  pagosAlumno: '/alumno/pagos',
  perfilAlumno: '/alumno/mi-perfil',
})

/**
 * Los métodos que **escriben**, y que por lo tanto nunca caen al ejemplo.
 *
 * Es una lista explícita y no un patrón de nombre, porque la consecuencia de equivocarse no es un
 * test rojo: es una secretaría que cree que guardó un curso que no está en la base.
 */
const ESCRIBEN = new Set([
  'crearCurso',
  'crearComision',
  'crearDocente',
  'registrarCobranza',
  'forzarBloqueoManual',
  'guardarLinkClase',
])

async function request(path, { method = 'GET', body, query, params } = {}) {
  // Los `:nombre` del camino se reemplazan con `params`. Es lo que permite que `PATHS` declare
  // una ruta por recurso sin que cada método escriba el `encodeURIComponent` de su código.
  const ruta = String(path).replace(/:([a-zA-Z]+)/g, (_, nombre) =>
    encodeURIComponent(params?.[nombre] ?? ''),
  )
  const search =
    query && Object.keys(query).length > 0
      ? `?${new URLSearchParams(
          Object.entries(query).filter(([, valor]) => valor !== undefined && valor !== ''),
        ).toString()}`
      : ''

  const headers = {}
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  const token = readStoredToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${ruta}${search}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch {
    throw new DataSourceError('No pudimos conectar con el servidor.')
  }

  if (!response.ok) {
    throw new DataSourceError(
      // El `detail` del backend es texto de interfaz en es-AR y dice qué dato se repitió, así que
      // se sube tal cual: la pantalla lo muestra y no necesita saber de dónde viene.
      response.status >= 400 && response.status < 500 && response.status !== 404
        ? (await leerDetalle(response)) ?? `La API respondió ${response.status} a ${method} ${ruta}.`
        : `La API respondió ${response.status} a ${method} ${ruta}.`,
      response.status,
    )
  }

  return response.json()
}

/** El `detail` de un error del backend, si lo tiene. Un 4xx sin cuerpo no rompe nada. */
async function leerDetalle(response) {
  try {
    const cuerpo = await response.json()
    return typeof cuerpo?.detail === 'string' ? cuerpo.detail : null
  } catch {
    return null
  }
}

export function createApiDataSource() {
  const api = {
    modo: 'api',

    // ------------------------------------------------------------- catálogo

    async listarCursos() {
      return request(PATHS.cursos)
    },

    async crearCurso(datos) {
      return request(PATHS.cursos, { method: 'POST', body: datos })
    },

    async listarComisiones() {
      return request(PATHS.comisiones)
    },

    async crearComision(datos) {
      return request(PATHS.comisiones, { method: 'POST', body: datos })
    },

    /**
     * El resumen sale de la lista, no de un campo de la API.
     *
     * Antes pedía `GET /comisiones?resumen=true`, que ningún endpoint definía: con el modo real la
     * respuesta era la lista entera y el chip de la pantalla mostraba `undefined` (D15).
     */
    async obtenerResumenCatalogo() {
      const comisiones = await request(PATHS.comisiones)
      return { total_comisiones: comisiones.length }
    },

    async listarSedes() {
      return request(PATHS.sedes)
    },

    // ---------------------------------------------------------- padrón

    async listarDocentes() {
      return (await request(PATHS.docentes)).map(filaDeDocente)
    },

    /**
     * Búsqueda de docentes: filtra la lista ya traída, en el cliente.
     *
     * `GET /docentes` no acepta un parámetro de búsqueda porque la historia #10, que es la que
     * lo pide, está fuera de este change. Filtrar acá mantiene el buscador de la pantalla
     * andando con datos reales; cuando llegue #10, la búsqueda pasa al servidor y esto se
     * convierte en el `?q=` que el endpoint va a definir.
     */
    async buscarDocentes(texto) {
      const aguja = texto.trim().toLowerCase()
      const todos = (await request(PATHS.docentes)).map(filaDeDocente)
      if (aguja === '') {
        return todos
      }
      return todos.filter((fila) =>
        [fila.nombre, fila.dni, fila.email].some((campo) =>
          String(campo ?? '').toLowerCase().includes(aguja),
        ),
      )
    },

    async crearDocente(datos) {
      return filaDeDocente(await request(PATHS.docentes, { method: 'POST', body: datos }))
    },

    // ------------------------------------ endpoints que todavía no existen

    async listarAlumnos() {
      return request(PATHS.alumnos)
    },

    async buscarAlumnos(texto) {
      return request(PATHS.alumnos, { query: { q: texto } })
    },

    async listarEmpresas() {
      return request(PATHS.empresas)
    },

    async listarCobranzas() {
      return request(PATHS.cobranzas)
    },

    async buscarHabilitacion(consulta) {
      return request(PATHS.habilitacion, { query: { q: consulta } })
    },

    async registrarCobranza(datos) {
      return request(PATHS.cobranzas, { method: 'POST', body: datos })
    },

    async forzarBloqueoManual({ alumnoId, motivo, usuario, fechaOperacion }) {
      return request(`${PATHS.override}/${alumnoId}`, {
        method: 'POST',
        body: { motivo, usuario, fecha_operacion: fechaOperacion },
      })
    },

    async listarEmailsHabilitados(comisionCodigo) {
      const alumnos = await request(PATHS.alumnos, { query: { comision: comisionCodigo } })
      return alumnos.filter((alumno) => alumno.acceso?.estado === 'HABILITADO').map((a) => a.email)
    },

    async obtenerComisionesAsignadas() {
      return request(PATHS.comisionesAsignadas)
    },

    /**
     * Ficha del docente que entra. La ruta es **provisional**: no hay endpoint escrito, así que
     * esto da 404 y la lectura cae al ejemplo, que es lo que la pantalla del docente muestra
     * mientras tanto (M33).
     */
    async obtenerPerfilDocente() {
      return request(PATHS.perfilDocente)
    },

    async obtenerPadronComision(comisionCodigo) {
      return request(PATHS.padronComision, { params: { codigo: comisionCodigo } })
    },

    async obtenerAsistenciaComision(comisionCodigo) {
      return request(PATHS.asistencia, { params: { codigo: comisionCodigo } })
    },

    async obtenerLinkClase(comisionCodigo) {
      return request(PATHS.linkClase, { query: { comision: comisionCodigo } })
    },

    async guardarLinkClase({ comisionCodigo, url }) {
      return request(PATHS.linkClase, {
        method: 'POST',
        body: { comision: comisionCodigo, url },
      })
    },

    async listarInscripcionesAlumno() {
      return request(PATHS.inscripcionesAlumno)
    },

    async obtenerDetalleInscripcion(comisionCodigo) {
      return request(PATHS.inscripcionesAlumno, {
        params: { codigo: comisionCodigo },
      })
    },

    async listarPagosAlumno() {
      return request(PATHS.pagosAlumno)
    },

    async obtenerPerfilAlumno() {
      return request(PATHS.perfilAlumno)
    },
  }

  return conEjemploEnAusencia(api)
}

/**
 * Envuelve las lecturas para que caigan al ejemplo cuando el endpoint no existe.
 *
 * `ponytail: la caída al ejemplo se borra cuando el shell tenga todos sus endpoints. Es un atajo
 * deliberado, no una arquitectura: mientras falten, es lo que evita que el modo real por omisión
 * deje media pantalla vacía.` (D36)
 */
function conEjemploEnAusencia(api) {
  const ejemplo = createMockDataSource()
  const envuelto = { modo: api.modo }

  for (const [nombre, metodo] of Object.entries(api)) {
    if (nombre === 'modo' || ESCRIBEN.has(nombre) || typeof metodo !== 'function') {
      envuelto[nombre] = metodo
      continue
    }

    envuelto[nombre] = async (...argumentos) => {
      try {
        return await metodo(...argumentos)
      } catch (error) {
        const sinEndpoint = error instanceof DataSourceError && error.status === 404
        const tieneEjemplo = typeof ejemplo[nombre] === 'function'
        if (!sinEndpoint || !tieneEjemplo) {
          throw error
        }
        return ejemplo[nombre](...argumentos)
      }
    }
  }

  return envuelto
}

/**
 * La fila de docente como la consume la pantalla: nombre completo y conte de comisiones.
 *
 * El modelo tiene `nombre` y `apellido` por separado y una cuenta derivada de comisiones; el
 * ejemplo traía el nombre ya junto y el campo `comisiones_asignadas`. La unión vive acá, en la
 * frontera, para que `TeachersPage` no tenga que saber de dónde viene la fila.
 *
 * `catedra` no existe en el modelo: se manda `null` para que la columna muestre un guion en vez de
 * inventar un dato.
 */
function filaDeDocente(docente) {
  return {
    ...docente,
    nombre: `${docente.nombre} ${docente.apellido}`,
    catedra: null,
    comisiones_asignadas: docente.cantidad_comisiones ?? 0,
  }
}
