import { API_BASE_URL } from '../config/api'
import { readStoredToken } from '../auth/tokenStorage'

/**
 * Implementación real de la frontera de datos: habla con el backend.
 *
 * **Todavía no hay endpoint para nada de esto.** D14 deja una sola llamada de red, el login; los
 * grupos del backend que expongan cat padrón, cobranza y habilitación todavía no están escritos.
 *
 * Los caminos de `PATHS` son **provisionales**: son los que corresponde por recurso y verbo, y
 * están en un solo lugar para que el primer endpoint real los confirme o los corrija de una vez.
 * Esa es la forma en que `design.md` avisa que va a aparecer el error: no después de un mes de
 * pantallas rotas, sino en el primer endpoint que se define. Si un campo del ejemplo no exista
 * en la API, se ve acá.
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

/** Rutas provisionales, por recurso. Un solo lugar para corregirlas cuando exista el endpoint. */
const PATHS = Object.freeze({
  comisiones: '/comisiones',
  docentes: '/docentes',
  alumnos: '/alumnos',
  empresas: '/empresas',
  sedes: '/sedes',
  cobranzas: '/cobranzas',
  habilitacion: '/habilitaciones/consulta',
  override: '/habilitaciones/override',
  comisionesAsignadas: '/docentes/mis-comisiones',
  padronComision: '/comisiones/:codigo/alumnos',
  asistencia: '/comisiones/:codigo/asistencia',
  perfilDocente: '/docentes/mi-perfil',
  linkClase: '/clases/link',
})

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
      `La API respondió ${response.status} a ${method} ${ruta}.`,
      response.status,
    )
  }

  return response.json()
}

export function createApiDataSource() {
  return {
    modo: 'api',

    async listarComisiones() {
      return request(PATHS.comisiones)
    },

    async obtenerResumenCatalogo() {
      return request(PATHS.comisiones, { query: { resumen: true } })
    },

    async listarDocentes() {
      return request(PATHS.docentes)
    },

    async buscarDocentes(texto) {
      return request(PATHS.docentes, { query: { q: texto } })
    },

    async listarAlumnos() {
      return request(PATHS.alumnos)
    },

    async buscarAlumnos(texto) {
      return request(PATHS.alumnos, { query: { q: texto } })
    },

    async listarEmpresas() {
      return request(PATHS.empresas)
    },

    async listarSedes() {
      return request(PATHS.sedes)
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

    async obtenerPadronComision(comisionCodigo) {
      return request(PATHS.padronComision, { params: { codigo: comisionCodigo } })
    },

    async obtenerAsistenciaComision(comisionCodigo) {
      return request(PATHS.asistencia, { params: { codigo: comisionCodigo } })
    },

    async obtenerPerfilDocente() {
      return request(PATHS.perfilDocente)
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
  }
}
