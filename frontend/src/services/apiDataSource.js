import { API_BASE_URL } from '../config/api'
import { readStoredToken } from '../auth/tokenStorage'

/**
 * Implementación real de la frontera de datos: habla con el backend (D36).
 *
 * **Toda lectura que falla se propaga como `DataSourceError`; no hay datos de ejemplo en su
 * lugar.** Los endpoints que existen son los del catálogo, el padrón de docentes, el alta y la
 * consulta del padrón de alumnos, las empresas, las cobranzas y las inscripciones de un alumno.
 * Los de habilitación y clases todavía no están escritos, así que las pantallas que los usan
 * degradan a su estado vacío (D42).
 *
 * **Un error nunca se disfraza de dato válido:** ni un 404, ni un 500, ni un error de red. Un 404
 * es solo otro fallo —el endpoint o el registro pedido no existe— y sube tal cual, con su `status`,
 * para que la pantalla decida qué mostrar.
 *
 * **Los POST fallan y lo dicen.** Un alta que no llega a la base no se guarda en ningún lado: el
 * error sube y la pantalla no confirma un alta que no existe. Es la diferencia entre una demo que
 * miente y una demo honesta.
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
 * Rutas por recurso. Las de `cursos`, `comisiones`, `docentes`, `alumnos`, `empresas`, `sedes`,
 * `cobranzas` e `inscripcionesDeAlumno` quedaron **confirmadas** por los endpoints reales de los
 * changes `altas-catalogo-docentes`, `hu-13-alta-alumno`, `hu-18-alta-empresa` y
 * `hu-21-registrar-pago-manual`; las demás siguen provisionales (M33) hasta que exista su
 * endpoint.
 */
const PATHS = Object.freeze({
  cursos: '/cursos',
  inscripciones: '/inscripciones',
  comisiones: '/comisiones',
  docentes: '/docentes',
  alumnos: '/alumnos',
  inscripcionesDeAlumno: '/alumnos/:alumnoId/inscripciones',
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
  detalleInscripcionAlumno: '/alumno/inscripciones/:codigo',
  pagosAlumno: '/alumno/pagos',
  perfilAlumno: '/alumno/mi-perfil',
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
      // El `detail` del backend es texto de interfaz en es-AR y dice qué dato repitió o qué
      // regla no se cumplió, así que se sube tal cual también en un 404 de dominio: la
      // pantalla lo muestra y no necesita saber de dónde viene.
      response.status >= 400 && response.status < 500
        ? ((await leerDetalle(response)) ??
            `La API respondió ${response.status} a ${method} ${ruta}.`)
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

/**
 * Une la forma de la API con la que ya usa la pantalla.
 *
 * El backend nombra al alumno imputado `imputacion.alumno`; el maquetado y el resto de la
 * interfaz lo llaman `nombre`. La frontera de datos es el lugar donde se resuelve esa diferencia:
 * así la pantalla no necesita saber de dónde vinieron las filas (D13).
 */
function normalizarCobranza(cobranza) {
  if (cobranza === null || cobranza === undefined) {
    return cobranza
  }

  const imputaciones = (cobranza.imputaciones ?? []).map((imputacion) => ({
    ...imputacion,
    nombre: imputacion.nombre ?? imputacion.alumno ?? imputacion.empresa ?? '',
  }))
  const primera = cobranza.imputacion ?? imputaciones[0] ?? null

  return {
    ...cobranza,
    imputaciones,
    imputacion:
      primera === null
        ? null
        : {
            ...primera,
            nombre: primera.nombre ?? primera.alumno ?? primera.empresa ?? '',
          },
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

    /** Edición de curso (historia #3). El código generado no se envía ni cambia (D32). */
    async editarCurso(id, datos) {
      return request(`${PATHS.cursos}/${id}`, { method: 'PUT', body: datos })
    },

    /** Edición de comisión (historia #4). El curso, el número y la modalidad no se envían (D51). */
    async editarComision(id, datos) {
      return request(`${PATHS.comisiones}/${id}`, { method: 'PUT', body: datos })
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
     * Búsqueda de docentes (historia #10): el criterio y el orden los resuelve el backend.
     *
     * La pantalla no filtra ni reordena la respuesta: recibe las filas ya ordenadas por
     * coincidencia y las muestra en ese orden.
     */
    async buscarDocentes(texto) {
      return (await request(PATHS.docentes, { query: { q: texto } })).map(filaDeDocente)
    },

    /**
     * Alta de docente (HU #66). La respuesta conserva `password_inicial` **solo en el resultado
     * del alta**: es la única vez que el administrador puede verla. Las filas del padrón que
     * devuelven `listarDocentes` y `buscarDocentes` no la traen.
     */
    async crearDocente(datos) {
      const cuerpo = await request(PATHS.docentes, { method: 'POST', body: datos })
      return { ...filaDeDocente(cuerpo), password_inicial: cuerpo.password_inicial }
    },

    /** Edición de los datos personales (historia #11). El cuerpo es el que arma la pantalla:
     * el CUIL viaja en 11 dígitos o `null` y, si no viaja, el backend conserva el actual (D57). */
    async editarDocente(id, datos) {
      return filaDeDocente(await request(`${PATHS.docentes}/${id}`, { method: 'PUT', body: datos }))
    },

    /**
     * Restablecimiento administrativo de la contraseña (historia #11). No devuelve la
     * contraseña en claro: el backend guarda solo el hash y exige el cambio en el próximo
     * ingreso.
     */
    async restablecerPasswordDocente(id, newPassword) {
      return filaDeDocente(
        await request(`${PATHS.docentes}/${id}/password`, {
          method: 'POST',
          body: { new_password: newPassword },
        }),
      )
    },

    /**
     * Padrón de alumnos (historia #13). La respuesta trae los datos personales y deja en `null`
     * comisión, categoría, porcentaje de beca y acceso mientras el alumno no tenga inscripción.
     */
    async listarAlumnos() {
      return request(PATHS.alumnos)
    },

    /**
     * Alta de alumno (historia #13). **El contrato no lleva `tipo_documento`**: esta entrega
     * registra solo DNI (D44). El error del backend sube tal cual, con su `detail`, para que el
     * modal diga qué dato se repitió.
     */
    async crearAlumno(datos) {
      return request(PATHS.alumnos, { method: 'POST', body: datos })
    },

    /** Búsqueda por DNI o email (historia #16): el filtro lo resuelve el backend con `?q=`. */
    async buscarAlumnos(texto) {
      return request(PATHS.alumnos, { query: { q: texto } })
    },

    /** Edición de los datos personales (historia #17). Conserva el `id` y el legajo. */
    async editarAlumno(id, datos) {
      return request(`${PATHS.alumnos}/${id}`, { method: 'PUT', body: datos })
    },

    /**
     * Restablecimiento administrativo de la contraseña (historia #17). No devuelve la
     * contraseña en claro: el backend guarda solo el hash y exige el cambio en el próximo ingreso.
     */
    async restablecerPasswordAlumno(id, newPassword) {
      return request(`${PATHS.alumnos}/${id}/password`, {
        method: 'POST',
        body: { new_password: newPassword },
      })
    },

    /** Baja lógica (historia #17): el alumno y su cuenta quedan inactivos, sin borrar filas. */
    async eliminarAlumno(id) {
      return request(`${PATHS.alumnos}/${id}`, { method: 'DELETE' })
    },

    /** Consulta si el alta corresponde a un alumno inactivo y se puede reactivar (historia #17). */
    async buscarAlumnoReactivable({ documento, email }) {
      return request(`${PATHS.alumnos}/reactivable`, {
        query: { documento, email },
      })
    },

    /**
     * Reactivación (historia #17): conserva el registro y devuelve una nueva contraseña inicial
     * para que el administrador la entregue.
     */
    async reactivarAlumno(id, datos) {
      return request(`${PATHS.alumnos}/${id}/reactivar`, { method: 'POST', body: datos })
    },

    /** Alta de inscripción (historia #14): vincula un alumno a una comisión. */
    async crearInscripcion(datos) {
      return request(PATHS.inscripciones, { method: 'POST', body: datos })
    },

    async actualizarCategoriaInscripcion(inscripcionId, datos) {
      return request(`${PATHS.inscripciones}/${inscripcionId}`, {
        method: 'PATCH',
        body: datos,
      })
    },

    // ------------------------------------ endpoints que todavía no existen

    async listarEmpresas() {
      return request(PATHS.empresas)
    },

    async crearEmpresa(datos) {
      return request(PATHS.empresas, { method: 'POST', body: datos })
    },

    async listarCobranzas(q = '') {
      const filas = await request(PATHS.cobranzas, { query: { q } })
      return filas.map(normalizarCobranza)
    },

    /** Inscripciones activas del alumno, para el selector de imputación (HU 21). */
    async listarInscripcionesDeAlumno(alumnoId) {
      return request(PATHS.inscripcionesDeAlumno, { params: { alumnoId } })
    },

    async buscarHabilitacion(consulta) {
      return request(PATHS.habilitacion, { query: { q: consulta } })
    },

    async registrarCobranza(datos) {
      return normalizarCobranza(await request(PATHS.cobranzas, { method: 'POST', body: datos }))
    },

    /** Reparte el saldo de una cobranza ya registrada sin crear otro cobro (HU 23). */
    async agregarImputaciones(id, datos) {
      return normalizarCobranza(
        await request(`${PATHS.cobranzas}/${id}/imputaciones`, { method: 'POST', body: datos }),
      )
    },

    /** Acredita una cobranza observada o rechazada sin crear otro cobro (HU 21). */
    async actualizarEstadoCobranza(id, datos) {
      return normalizarCobranza(
        await request(`${PATHS.cobranzas}/${id}/estado`, { method: 'PATCH', body: datos }),
      )
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
     * esto da 404 y el fallo se propaga; la pantalla del docente muestra su estado vacío (M33).
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
      return request(PATHS.detalleInscripcionAlumno, {
        params: { codigo: comisionCodigo },
      })
    },

    async listarPagosAlumno() {
      return request(PATHS.pagosAlumno)
    },

    async obtenerPerfilAlumno() {
      return request(PATHS.perfilAlumno)
    },

    /**
     * Guardado de los datos de contacto del alumno (HU 43). El cuerpo lleva **solo** email y
     * teléfono: el documento, el nombre y el identificador no forman parte del contrato y la API
     * rechaza con 422 cualquier otro campo.
     */
    async actualizarPerfilAlumno(datos) {
      return request(PATHS.perfilAlumno, { method: 'PUT', body: datos })
    },
  }

  return api
}

/**
 * La fila de docente como la consume la pantalla: nombre completo, comisiones y su conte.
 *
 * El modelo tiene `nombre` y `apellido` por separado y una cuenta derivada de comisiones; el
 * ejemplo trae el nombre ya junto y `comisiones_asignadas`. La unión vive acá, en la frontera,
 * para que `TeachersPage` no tenga que saber de dónde viene la fila. La lista `comisiones` es la
 * que muestra el código y el nombre del curso (historia #10), y el conte se conserva como derivado
 * de esa misma lista.
 *
 * `catedra` no existe en el modelo: se manda `null` para que la columna muestre un guion en vez de
 * inventar un dato.
 *
 * **`nombre` de la fila es el nombre completo y `nombres` el de pila.** La tabla muestra el primero;
 * el modal de edición (historia #11) necesita los dos por separado, y la respuesta del backend los
 * trae así. Sin `nombres` el formulario precargaría el apellido dentro del nombre y guardarlo sin
 * cambios lo duplicaría.
 */
function filaDeDocente(docente) {
  const comisiones = docente.comisiones ?? []
  return {
    ...docente,
    nombre: `${docente.nombre} ${docente.apellido}`,
    nombres: docente.nombre,
    catedra: null,
    comisiones,
    comisiones_asignadas: docente.cantidad_comisiones ?? comisiones.length,
  }
}
