import {
  ALUMNOS,
  ASISTENCIAS,
  CATALOGO_TOTAL_COMISIONES,
  COBRANZAS,
  COMISIONES,
  DESTINO_IMPUTACION,
  DOCENTES,
  EMPRESAS,
  LINKS_DE_CLASE,
  SEDES,
} from '../mocks'
import { normalizeCode, normalizeCuit, normalizeDocumento } from '../domain/normalize'

/**
 * Implementación de ejemplo de la frontera de datos (D13).
 *
 * **Vive detrás del servicio, nunca al lado de la pantalla.** Los componentes no la importan: la
 * fábrica la elige y la expone por las mismas funciones asíncronas que va a exponer la
 * implementación real. Eso es lo que permite que cambiar de implementación no obligue a tocar ni
 * un componente.
 *
 * **Los datos salen de `src/mocks/` y no al revés.** El store se arma una vez por instancia desde
 * las colecciones congeladas de ejemplo y después se copia: registrar una cobranza o cargar un link
 * de clase agrega una fila a la pantalla sin tocar el módulo de datos de ejemplo, que es lo único
 * que no debería ensuciarse con lo que hace un usuario.
 *
 * **Ninguna función calcula un agregado de negocio.** Filtra, ordena y devuelve. Las vacantes
 * vienen calculadas en el mock (D10) y el estado de habilitación viene por registro (D9).
 */

/** Es el docente del maqueteado: el único al que el shell de Docente le muestra comisiones. */
const DOCENTE_DEL_MAQUETADO = 1

/**
 * La validación del link de clase vive acá y no en la pantalla.
 *
 * Es la misma regla que va a validar el backend, y una pantalla que la tuviera escrita calcularía
 * distinto del servidor el día que difieran. `new URL` es la validación: exige un esquema y un
 * host, así que `zoom.us/j/123` se rechaza por no traer `https://` y `el link de mañana` también.
 */
function esUrl(valor) {
  try {
    const url = new URL(String(valor))
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function copiar(registros) {
  return registros.map((registro) => ({ ...registro }))
}

function buscarPorTexto(registros, texto, campos) {
  const aguja = texto.trim().toLowerCase()

  if (aguja === '') {
    return registros
  }

  return registros.filter((registro) =>
    campos.some((campo) =>
      String(registro[campo] ?? '')
        .toLowerCase()
        .includes(aguja),
    ),
  )
}

export function createMockDataSource() {
  const store = {
    comisiones: copiar(COMISIONES),
    docentes: copiar(DOCENTES),
    alumnos: copiar(ALUMNOS),
    empresas: copiar(EMPRESAS),
    sedes: copiar(SEDES),
    cobranzas: copiar(COBRANZAS),
    asistencias: copiar(ASISTENCIAS),
    links: copiar(LINKS_DE_CLASE),
  }

  /** El padrón de una comisión: los alumnos que tiene, con el acceso que ya viene derivado (D9). */
  function padron(comisionCodigo) {
    const codigo = normalizeCode(comisionCodigo)

    return store.alumnos.filter((alumno) => normalizeCode(alumno.comision.codigo) === codigo)
  }

  /** La fila del catálogo de una comisión, o `undefined` si el código no existe. */
  function comision(comisionCodigo) {
    const codigo = normalizeCode(comisionCodigo)

    return store.comisiones.find((candidata) => normalizeCode(candidata.codigo) === codigo)
  }

  return {
    modo: 'mock',

    async listarComisiones() {
      return copiar(store.comisiones)
    },

    /**
     * Totales del catálogo del cliente. El chip `10 en el catálogo` y el indicador `COMISIONES`
     * del tablero muestran el mismo número, así que sale de acá y no de cada pantalla: si uno
     * midiera las cinco filas de ejemplo y el otro el total, se contradirían.
     */
    async obtenerResumenCatalogo() {
      return { total_comisiones: CATALOGO_TOTAL_COMISIONES }
    },

    async listarDocentes() {
      return copiar(store.docentes)
    },

    /** Búsqueda por nombre, apellido, DNI o email: lo que el buscador de la pantalla promete. */
    async buscarDocentes(texto) {
      return buscarPorTexto(store.docentes, texto, ['nombre', 'dni', 'email'])
    },

    async listarAlumnos() {
      return copiar(store.alumnos)
    },

    /** Búsqueda por DNI o nombre: es lo que promete el placeholder del buscador. */
    async buscarAlumnos(texto) {
      return buscarPorTexto(store.alumnos, texto, ['nombre', 'documento'])
    },

    async listarEmpresas() {
      return copiar(store.empresas)
    },

    async listarSedes() {
      return copiar(store.sedes)
    },

    async listarCobranzas() {
      return copiar(store.cobranzas)
    },

    /**
     * Consulta de habilitación: por DNI, email de alumno, CUIT o razón social. Es la búsqueda del
     * bloque `Buscador de Alumnos y Cuentas Corporativas`.
     *
     * Documento, email y CUIT se comparan enteros y el nombre o la razón social por fragmento: la
     * ayuda de la pantalla promete `Buscá por DNI de alumno, Email institucional, CUIT de empresa
     * o Razón Social.`, y `Banco Federal` tiene que encontrar a `Banco Federal (Capacitaciones)`
     * sin que quien busca tenga que escribir el paréntesis.
     */
    async buscarHabilitacion(consulta) {
      const aguja = String(consulta ?? '').trim()
      if (aguja === '') {
        return null
      }

      const documento = normalizeDocumento(aguja)
      const cuit = normalizeCuit(aguja)
      const codigo = normalizeCode(aguja)

      const alumno = store.alumnos.find(
        (candidato) =>
          normalizeDocumento(candidato.documento) === documento ||
          candidato.email.toLowerCase() === aguja.toLowerCase() ||
          normalizeCode(candidato.nombre).includes(codigo),
      )
      if (alumno) {
        return { tipo: 'ALUMNO', registro: { ...alumno } }
      }

      const empresa = store.empresas.find(
        (candidato) =>
          normalizeCuit(candidato.cuit) === cuit ||
          normalizeCode(candidato.razon_social).includes(codigo),
      )
      if (empresa) {
        return { tipo: 'EMPRESA', registro: { ...empresa } }
      }

      return null
    },

    /**
     * Alta manual de cobranza (historias #21 y #22). El pagador no se deduplica contra el padrón de
     * alumnos: puede ser un tercero o una empresa, y por eso `pagador` se lleva el nombre tal
     * cual vino. La imputación es de destino único (D7) y sale del alumno elegido.
     */
    async registrarCobranza(datos) {
      const id = store.cobranzas.length + 1
      const cobranza = {
        id,
        fecha: datos.fecha,
        pagador: { id, nombre: datos.titular },
        medio: datos.medio,
        factura: datos.facturaTipo,
        importe: Number(datos.importe),
        estado: datos.estado,
        causa: datos.estado === 'ACREDITADO' ? null : (datos.causa ?? ''),
        imputacion: datos.alumnoId
          ? {
              destino: DESTINO_IMPUTACION.ALUMNO,
              id: datos.alumnoId,
              nombre: store.alumnos.find((alumno) => alumno.id === datos.alumnoId)?.nombre ?? '',
            }
          : null,
        _ejemplo: true,
      }
      store.cobranzas.unshift(cobranza)
      return { ...cobranza }
    },

    /**
     * Forzado de bloqueo (historia #27): guarda el motivo con el usuario y la fecha de la
     * operación. El modelo no tiene columna de estado en la inscripción (D9): lo que se guarda es
     * el override, y el estado vuelve a derivarse.
     */
    async forzarBloqueoManual({ alumnoId, motivo, usuario, fechaOperacion }) {
      const alumno = store.alumnos.find((candidato) => candidato.id === alumnoId)
      if (alumno === undefined) {
        throw new Error('No hay un alumno con ese identificador en los datos de ejemplo.')
      }
      if (String(motivo ?? '').trim() === '') {
        throw new Error('El motivo es obligatorio.')
      }

      alumno.acceso = {
        estado: 'BLOQUEADO',
        causa: motivo.trim(),
        forzado: { usuario, fecha_operacion: fechaOperacion, motivo: motivo.trim() },
      }
      return { ...alumno }
    },

    /**
     * Correos de los alumnos habilitados de una comisión (acción `Copiar emails habilitados de
     * CUR-101`). Filtra por acceso y no por categoría: la regla es "habilitados", y un becado
     * bloqueado no entra.
     */
    async listarEmailsHabilitados(comisionCodigo) {
      const codigo = normalizeCode(comisionCodigo)

      return store.alumnos
        .filter(
          (alumno) =>
            normalizeCode(alumno.comision.codigo) === codigo &&
            alumno.acceso.estado === 'HABILITADO',
        )
        .map((alumno) => alumno.email)
    },

    /**
     * Comisiones asignadas al docente del maqueteado, con los contadores de acceso de cada una
     * (10.2).
     *
     * **Los contadores salen del padrón que la pantalla muestra, no de otra cuenta.** El escenario
     * del spec pide que el indicador `ALUMNOS HABILITADOS` y la celda `1 habilitado` de la fila
     * coincidan; derivarlos de la misma lista hace que no puedan contradecirse. Y el padrón es el
     * que el cliente nombró alumno por alumno —dos filas—, no las veintitrés inscripciones que
     * registra el catálogo, que es lo que el spec prohíbe completar de a inventar.
     */
    async obtenerComisionesAsignadas() {
      return store.comisiones
        .filter((candidata) => candidata.docente_id === DOCENTE_DEL_MAQUETADO)
        .map((candidata) => {
          const alumnos = padron(candidata.codigo)
          const habilitados = alumnos.filter((alumno) => alumno.acceso.estado === 'HABILITADO')

          return {
            codigo: candidata.codigo,
            nombre_curso: candidata.curso.nombre,
            docente_nombre: candidata.docente_nombre,
            horario: candidata.horario_legible,
            proxima_clase: candidata.proxima_clase ?? null,
            habilitados: habilitados.length,
            bloqueados: alumnos.length - habilitados.length,
          }
        })
    },

    /**
     * Padrón de una comisión para el detalle del docente (10.3). Es de solo lectura: la función no
     * ofrece ninguna forma de cambiar el acceso de un alumno, y eso no es una omisión de la
     * pantalla sino del contrato de datos.
     */
    async obtenerPadronComision(comisionCodigo) {
      const encontrada = comision(comisionCodigo)

      if (encontrada === undefined) {
        return null
      }

      return {
        codigo: encontrada.codigo,
        nombre_curso: encontrada.curso.nombre,
        horario: encontrada.horario_legible,
        alumnos: copiar(padron(encontrada.codigo)),
      }
    },

    /**
     * Asistencia de la clase del día (10.4). Las marcas de las clases ya dictadas vienen del
     * ejemplo y la del día se cambia en pantalla: el guardado no persiste nada, porque la fuente
     * del cliente no declara cuántas clases tiene el curso y el maqueteado no inventa ese dato.
     */
    async obtenerAsistenciaComision(comisionCodigo) {
      const encontrada = comision(comisionCodigo)
      const asistencia = store.asistencias.find(
        (candidata) => normalizeCode(candidata.comision) === normalizeCode(encontrada?.codigo),
      )

      if (encontrada === undefined || asistencia === undefined) {
        return null
      }

      const filas = padron(encontrada.codigo).map((alumno) => ({
        alumno_id: alumno.id,
        nombre: alumno.nombre,
        marcas: { ...(asistencia.marcas[alumno.id] ?? {}) },
      }))

      return {
        codigo: encontrada.codigo,
        nombre_curso: encontrada.curso.nombre,
        sesion: { ...asistencia.sesion },
        clases: asistencia.clases.map((clase) => ({ ...clase })),
        filas,
      }
    },

    /**
     * Ficha del docente del maqueteado con sus comisiones (10.5). El contacto va tal como lo
     * registra el cliente: `catedra` y la sede de referencia. El correo y el teléfono existen en el
     * padrón de docentes pero no se devuelven, porque el spec prohíbe mostrarlos en esta pantalla y
     * una función que los trae invita a que alguien los muestre.
     */
    async obtenerPerfilDocente() {
      const docente = store.docentes.find((candidata) => candidata.id === DOCENTE_DEL_MAQUETADO)
      const comisiones = store.comisiones.filter((candidata) => candidata.docente_id === docente.id)
      const primera = comisiones[0]

      return {
        nombre: docente.nombre,
        especialidad: docente.catedra,
        // La sede de referencia es la de la comisión en la que da clases: el padrón de docentes no
        // tiene columna de sede y no se le inventa una.
        sede: store.sedes.find((sede) => sede.id === primera.sede_id)?.nombre ?? null,
        comisiones: comisiones.map((candidata) => ({
          codigo: candidata.codigo,
          nombre_curso: candidata.curso.nombre,
          horario: candidata.horario_legible,
          // El modelo no tiene columna de estado de comisión (M2): la que existe es
          // `cerrada_por_cupo`, y de ahí sale la etiqueta que ve el docente.
          estado: candidata.cerrada_por_cupo ? 'Cerrada por cupo' : 'Activa',
        })),
      }
    },

    /**
     * Link de clase de una comisión (10.3 y 11.3). Lo lee el detalle del docente y lo lee el
     * detalle del alumno: es el mismo dato, y por eso vive en la frontera y no en una pantalla.
     */
    async obtenerLinkClase(comisionCodigo) {
      const codigo = normalizeCode(comisionCodigo)
      const guardado = store.links.find((link) => normalizeCode(link.comision) === codigo)

      return { link: guardado?.url ?? null }
    },

    /**
     * Carga del link de clase (10.3). Valida la URL y devuelve un resultado explícito en lugar de
     * lanzar: la pantalla tiene que poder mostrar el error pegado al campo y no confirmar nada, y
     * eso es más claro con un resultado que con una excepción (D17 usa la misma forma).
     *
     * Guardar un link no toca el acceso de ningún alumno: el link es único por clase del día y lo
     * reparte el docente a los habilitados por correo.
     */
    async guardarLinkClase({ comisionCodigo, url }) {
      const encontrada = comision(comisionCodigo)

      if (encontrada === undefined) {
        return { ok: false, error: 'La comisión no existe.' }
      }
      if (!esUrl(url)) {
        return {
          ok: false,
          error: 'El link de la clase tiene que ser una URL válida, con http:// o https://.',
        }
      }

      const codigo = normalizeCode(encontrada.codigo)
      const indice = store.links.findIndex((link) => normalizeCode(link.comision) === codigo)
      const registro = { comision: encontrada.codigo, url: String(url).trim() }

      if (indice === -1) {
        store.links.push(registro)
      } else {
        store.links[indice] = registro
      }

      return { ok: true, link: registro.url }
    },
  }
}
