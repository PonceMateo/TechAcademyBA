import {
  ALUMNOS,
  ASISTENCIAS,
  CATALOGO_TOTAL_COMISIONES,
  COBRANZAS,
  COMISIONES,
  DESTINO_IMPUTACION,
  DOCENTES,
  EMPRESAS,
  INSCRIPCIONES,
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

/** El identificador siguiente de una colección: el máximo + 1, o 1 si está vacía. */
function siguienteId(registros) {
  return registros.reduce((mayor, registro) => Math.max(mayor, registro.id ?? 0), 0) + 1
}

/**
 * La fila de docente con la forma que consume la pantalla, que es la de la fuente real.
 *
 * El ejemplo guarda el nombre ya junto y el conte en `comisiones_asignadas`, porque así venía de
 * la planilla del cliente; la fuente real devuelve `nombre` y `apellido` por separado y
 * `cantidad_comisiones`. La unión vive acá, en la frontera, para que la pantalla no tenga que
 * saber de dónde viene la fila (D33, M33).
 */
function filaDeDocente(docente) {
  return {
    ...docente,
    nombre: `${docente.nombre} ${docente.apellido ?? ''}`.trim(),
    comisiones_asignadas: docente.cantidad_comisiones ?? docente.comisiones_asignadas ?? 0,
  }
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
    inscripciones: copiar(INSCRIPCIONES),
  }

  /** El padrón de una comisión: los alumnos que tiene, con el acceso que ya viene derivado (D9). */
  function padron(comisionCodigo) {
    const codigo = normalizeCode(comisionCodigo)

    return store.alumnos.filter((alumno) => normalizeCode(alumno.comision.codigo) === codigo)
  }

  /**
   * La inscripción del alumno del ejemplo con su ficha, o `undefined` si no tiene ninguna.
   *
   * La inscripción y el alumno son datos que ya existen por separado: la inscripción guarda lo de la
   * comisión y el padrón guarda el documento, el email y el acceso. Cruzarlos acá es lo que permite
   * que forzar un bloqueo desde la pantalla de la secretaría se vea en la del alumno.
   */
  function inscripcionDelAlumno() {
    return store.inscripciones
      .map((inscripcion) => ({
        inscripcion,
        alumno: store.alumnos.find((candidato) => candidato.id === inscripcion.alumno_id),
      }))
      .find(({ alumno }) => alumno !== undefined)
  }

  /** La fila del catálogo de una comisión, o `undefined` si el código no existe. */
  function comision(comisionCodigo) {
    const codigo = normalizeCode(comisionCodigo)

    return store.comisiones.find((candidata) => normalizeCode(candidata.codigo) === codigo)
  }

  /**
   * Si una comisión existe, dentro o fuera del subconjunto del catálogo.
   *
   * `comisiones.js` tiene cinco de las diez comisiones del cliente, así que "no está en el catálogo de
   * ejemplo" no es "no existe": `CUR-102` es la comisión de la alumna del ejemplo y vive en
   * `inscripciones.js`. La comprobación de verdad la va a hacer el backend —un 404 o un 403 según a
   * quién se le pregunte—; acá alcanza con no rechazar un código que el ejemplo conoce.
   */
  function existeComision(comisionCodigo) {
    const codigo = normalizeCode(comisionCodigo)

    return (
      store.comisiones.some((candidata) => normalizeCode(candidata.codigo) === codigo) ||
      store.inscripciones.some(
        (inscripcion) => normalizeCode(inscripcion.comision.codigo) === codigo,
      )
    )
  }

  /**
   * El link de clase guardado para una comisión, o `null` si el docente todavía no lo cargó.
   *
   * Vive como función del store y no como método del objeto devuelto porque lo necesitan dos
   * respuestas —la del docente y la del alumno—, y llamarse a uno mismo con `this` depende de cómo
   * se invoque la función.
   */
  function linkGuardado(comisionCodigo) {
    const codigo = normalizeCode(comisionCodigo)
    const guardado = store.links.find((link) => normalizeCode(link.comision) === codigo)

    return guardado?.url ?? null
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
      return store.docentes.map(filaDeDocente)
    },

    /** Búsqueda por nombre, apellido, DNI o email: lo que el buscador de la pantalla promete. */
    async buscarDocentes(texto) {
      return buscarPorTexto(store.docentes, texto, ['nombre', 'dni', 'email']).map(filaDeDocente)
    },

    /**
     * Alta de docente de ejemplo: agrega la fila al store y la devuelve con la misma forma que la
     * fuente real.
     *
     * El CUIL queda en `null` a propósito (D33): en esta fase los docentes no son personas reales
     * y un CUIL inventado es peor que ninguno.
     */
    async crearDocente({ nombre, apellido, dni, email, telefono }) {
      return filaDeDocente({
        id: siguienteId(store.docentes),
        nombre,
        apellido,
        dni,
        cuil: null,
        email,
        telefono,
        activo: true,
        catedra: null,
      })
    },

    /**
     * Cursos del ejemplo, derivados de las comisiones: es lo único que el catálogo tiene.
     *
     * El identificador se asigna por orden de aparición porque el ejemplo no guarda cursos sueltos.
     * La fuente real lo trae de la tabla, y la pantalla lo necesita para armar el alta de comisión:
     * el contrato manda `curso_id` numérico, no el código (D34).
     */
    async listarCursos() {
      const vistos = new Map()
      for (const comision of store.comisiones) {
        const curso = comision.curso
        if (curso && !vistos.has(curso.codigo)) {
          vistos.set(curso.codigo, { ...curso, id: vistos.size + 1, activo: true, descripcion: null })
        }
      }
      return [...vistos.values()]
    },

    /** Alta de curso de ejemplo. El código se arma acá porque no hay base que lo genere. */
    async crearCurso({ nombre, descripcion }) {
      const existentes = await this.listarCursos()
      const siguiente = existentes.reduce(
        (mayor, curso) => Math.max(mayor, Number.parseInt(curso.codigo.replace(/\D/g, ''), 10) || 0),
        0,
      ) + 1
      return {
        id: siguienteId(existentes),
        codigo: `CUR${String(siguiente).padStart(3, '0')}`,
        nombre,
        descripcion: descripcion ?? null,
      }
    },

    /**
     * Alta de comisión de ejemplo: el número es el siguiente del curso, como en la fuente real.
     *
     * `curso_id` llega numérico, igual que a la fuente real, así que el curso se busca por `id` y
     * no por código. Buscarlo por código fue lo que escondió el contrato roto del lado de la
     * pantalla: el ejemplo aceptaba un string donde la base exige un entero.
     */
    async crearComision({ curso_id, docente_id, dias_horarios, arancel, cupo_maximo, modalidad, sede_id }) {
      const cursos = await this.listarCursos()
      const curso = cursos.find((candidato) => String(candidato.id) === String(curso_id))
      const delCurso = store.comisiones.filter(
        (comision) => normalizeCode(comision.curso.codigo) === normalizeCode(curso?.codigo),
      )
      const docente = store.docentes.find((candidato) => String(candidato.id) === String(docente_id))
      const sede = store.sedes.find((candidato) => String(candidato.id) === String(sede_id))
      const comision = {
        id: siguienteId(store.comisiones),
        codigo: `${curso?.codigo ?? curso_id}-${delCurso.length + 1}`,
        curso: { codigo: curso?.codigo ?? curso_id, nombre: curso?.nombre ?? 'Curso' },
        docente_id: docente?.id ?? null,
        docente_nombre: docente?.nombre ?? null,
        dias_horarios,
        cupo_maximo: Number(cupo_maximo),
        arancel,
        vacantes: Number(cupo_maximo),
        modalidad,
        sede_id: sede?.id ?? null,
        sede_nombre: sede?.nombre ?? null,
      }
      store.comisiones.push(comision)
      return comision
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
      return { link: linkGuardado(comisionCodigo) }
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
      if (!existeComision(comisionCodigo)) {
        return { ok: false, error: 'La comisión no existe.' }
      }
      if (!esUrl(url)) {
        return {
          ok: false,
          error: 'El link de la clase tiene que ser una URL válida, con http:// o https://.',
        }
      }

      const codigo = normalizeCode(comisionCodigo)
      const indice = store.links.findIndex((link) => normalizeCode(link.comision) === codigo)
      const registro = { comision: String(comisionCodigo).trim(), url: String(url).trim() }

      if (indice === -1) {
        store.links.push(registro)
      } else {
        store.links[indice] = registro
      }

      return { ok: true, link: registro.url }
    },

    /**
     * Inscripciones del alumno del ejemplo con su acceso (11.2 y 11.3).
     *
     * **Devuelve un arreglo aunque haya una sola inscripción.** El shell dibuja una tarjeta por
     * inscripción y el spec exige el estado vacío para el alumno sin cursos, así que la forma de la
     * respuesta no cambia con la cantidad: una lista vacía es el caso que la pantalla tiene que
     * saber pintar, no una excepción.
     *
     * **El acceso viaja con la inscripción y es el derivado (D9).** No se calcula nada acá: el
     * forzado que haga la secretaría se ve en la tarjeta del alumno porque las dos pantallas leen el
     * mismo registro.
     */
    async listarInscripcionesAlumno() {
      const propia = inscripcionDelAlumno()

      if (propia === undefined) {
        return []
      }

      const { inscripcion, alumno } = propia

      return [
        {
          codigo: inscripcion.comision.codigo,
          nombre_curso: inscripcion.comision.nombre,
          docente_nombre: inscripcion.comision.docente_nombre,
          horario: inscripcion.comision.horario_legible,
          categoria: alumno.categoria,
          porcentaje_beca: alumno.porcentaje_beca,
          acceso: { ...alumno.acceso },
        },
      ]
    },

    /**
     * Detalle de una inscripción del alumno (11.3): lo de la comisión, el cronograma, los próximos
     * encuentros y el link de clase. `null` cuando el alumno no está inscripto en esa comisión, que
     * es lo que impide que un alumno abra el curso de otro.
     */
    async obtenerDetalleInscripcion(comisionCodigo) {
      const propia = inscripcionDelAlumno()

      if (propia === undefined) {
        return null
      }

      const { inscripcion, alumno } = propia
      if (normalizeCode(inscripcion.comision.codigo) !== normalizeCode(comisionCodigo)) {
        return null
      }

      const comision = { ...inscripcion.comision }

      return {
        comision,
        categoria: alumno.categoria,
        porcentaje_beca: alumno.porcentaje_beca,
        acceso: { ...alumno.acceso },
        cronograma: { ...inscripcion.cronograma },
        proximos_encuentros: inscripcion.proximos_encuentros.map((encuentro) => ({ ...encuentro })),
        link: linkGuardado(comision.codigo),
      }
    },

    /**
     * Comprobantes del alumno (11.4). Solo los que están imputados a él: el pago de una empresa y
     * el cheque que todavía no tiene a quién imputarse no aparecen, aunque el historial de la
     * secretaría los tenga (D7 deja la imputación de destino único).
     */
    async listarPagosAlumno() {
      const propia = inscripcionDelAlumno()

      if (propia === undefined) {
        return []
      }

      const { alumno } = propia

      return store.cobranzas
        .filter(
          (cobranza) =>
            cobranza.imputacion?.destino === DESTINO_IMPUTACION.ALUMNO &&
            normalizeCode(cobranza.imputacion.nombre) === normalizeCode(alumno.nombre),
        )
        .map((cobranza) => ({
          ...cobranza,
          // En este dominio el pagador puede no ser el alumno (D7), y la fila tiene que decirlo.
          pagado_por_tercero:
            normalizeCode(cobranza.pagador.nombre) !== normalizeCode(alumno.nombre),
        }))
    },

    /**
     * Ficha del alumno del ejemplo (11.5). Los cuatro datos que muestra el perfil y nada más: el
     * documento y el nombre llegan como datos, y que no se puedan editar es una decisión de la
     * pantalla —los campos deshabilitados—, no una bandera que el servicio le pase.
     */
    async obtenerPerfilAlumno() {
      const propia = inscripcionDelAlumno()

      if (propia === undefined) {
        return null
      }

      const { alumno } = propia

      return {
        nombre: alumno.nombre,
        documento: alumno.documento,
        email: alumno.email,
        telefono: alumno.telefono ?? null,
      }
    },
  }
}
