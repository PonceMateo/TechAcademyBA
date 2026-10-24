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
import { TIPO_FACTURA } from '../domain/enums'
import {
  normalizeCode,
  normalizeCuit,
  normalizeDocumento,
  normalizeWords,
} from '../domain/normalize'

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
 * La contraseña inicial del alta de alumno (D45): `<primer nombre><DNI>`, en minúsculas y sin
 * tildes. Es la misma convención que aplica el backend; la fuente de ejemplo la replica para que
 * la pantalla muestre el mismo texto con las dos fuentes.
 */
function passwordInicial(nombre, documento) {
  const primerNombre = String(nombre).trim().split(/\s+/)[0] ?? ''
  const sinTildes = primerNombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  const digitos = String(documento).replace(/\D/g, '')
  return `${sinTildes || 'alumno'}${digitos}`
}

/**
 * La fila de docente con la forma que consume la pantalla, que es la de la fuente real.
 *
 * El ejemplo guarda el nombre ya junto y el conte en `comisiones_asignadas`, porque así venía de
 * la planilla del cliente; la fuente real devuelve `nombre` y `apellido` por separado y
 * `cantidad_comisiones`. La unión vive acá, en la frontera, para que la pantalla no tenga que
 * saber de dónde viene la fila (D33, M33). Las comisiones se pasan ya derivadas del catálogo de
 * ejemplo: la pantalla muestra el código y el curso, no el conte de la planilla.
 */
function filaDeDocente(docente, comisiones = []) {
  const asignadas = comisiones ?? []
  return {
    ...docente,
    nombre: `${docente.nombre} ${docente.apellido ?? ''}`.trim(),
    comisiones: asignadas,
    comisiones_asignadas: asignadas.length,
  }
}

/** Las comisiones reales del ejemplo para un docente, sin inventar las que no están. */
function comisionesDelDocente(store, docenteId) {
  return store.comisiones
    .filter((comision) => comision.docente_id === docenteId)
    .map((comision) => ({
      id: comision.id,
      codigo: comision.codigo,
      nombre: comision.curso.nombre,
    }))
}

/**
 * Cursos del ejemplo derivados de las comisiones: es lo único que el catálogo trae.
 *
 * El identificador se asigna por orden de aparición porque el ejemplo no guarda cursos sueltos.
 * La fuente real lo trae de la tabla, y la pantalla lo necesita para armar el alta de comisión:
 * el contrato manda `curso_id` numérico, no el código (D34).
 */
function cursosDelCatalogo(comisiones) {
  const vistos = new Map()
  for (const comision of comisiones) {
    const curso = comision.curso
    if (curso && !vistos.has(curso.codigo)) {
      vistos.set(curso.codigo, {
        ...curso,
        id: vistos.size + 1,
        activo: true,
        descripcion: null,
      })
    }
  }
  return [...vistos.values()]
}

const PREFIJO_DE_DNI = /^[0-9.\s-]+$/

/** Posición de la primera palabra del nombre que coincide, respetando el orden de la consulta. */
function posicionDeCoincidencia(palabrasNombre, palabrasConsulta) {
  if (palabrasConsulta.length === 0) {
    return null
  }

  let desde = 0
  let primera = null
  for (const palabra of palabrasConsulta) {
    let encontrada = -1
    for (let indice = desde; indice < palabrasNombre.length; indice += 1) {
      if (palabrasNombre[indice].startsWith(palabra)) {
        encontrada = indice
        break
      }
    }
    if (encontrada === -1) {
      return null
    }
    if (primera === null) {
      primera = encontrada
    }
    desde = encontrada + 1
  }
  return primera
}

/**
 * Clave de orden de una coincidencia, o `null` si el docente no coincide.
 *
 * La primera componente prioriza nombre, después DNI y al final email; la segunda, la posición de
 * la primera palabra que coincide dentro del nombre; la tercera desempata por `id`.
 */
function claveDeCoincidencia(docente, aguja) {
  const palabras = normalizeWords(aguja)
  const nombre = `${docente.nombre ?? ''} ${docente.apellido ?? ''}`
  const posicion = posicionDeCoincidencia(normalizeWords(nombre), palabras)
  if (posicion !== null) {
    return [0, posicion, docente.id]
  }

  // Una sola letra se queda en el nombre y el apellido: no arrastra filas por el email.
  if (palabras.length === 1 && palabras[0].length === 1 && /[A-Z]/.test(palabras[0])) {
    return null
  }

  if (PREFIJO_DE_DNI.test(aguja)) {
    const digitos = aguja.replace(/\D/g, '')
    const dni = String(docente.dni ?? '').replace(/\D/g, '')
    if (digitos !== '' && dni.startsWith(digitos)) {
      return [1, 0, docente.id]
    }
  }

  const email = normalizeCode(aguja)
  if (palabras.length === 1 && email !== '' && normalizeCode(docente.email).startsWith(email)) {
    return [2, 0, docente.id]
  }

  return null
}

function compararClaves(izquierda, derecha) {
  for (let indice = 0; indice < izquierda.length; indice += 1) {
    if (izquierda[indice] !== derecha[indice]) {
      return izquierda[indice] - derecha[indice]
    }
  }
  return 0
}

function buscarDocentesEnStore(store, texto) {
  const aguja = String(texto ?? '').trim()
  const activos = store.docentes.filter((docente) => docente.activo !== false)
  const encontrados =
    aguja === ''
      ? activos
      : activos
          .map((docente) => ({ docente, clave: claveDeCoincidencia(docente, aguja) }))
          .filter(({ clave }) => clave !== null)
          .sort((izquierda, derecha) => compararClaves(izquierda.clave, derecha.clave))
          .map(({ docente }) => docente)

  return encontrados.map((docente) =>
    filaDeDocente(docente, comisionesDelDocente(store, docente.id)),
  )
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
    cursos: cursosDelCatalogo(COMISIONES),
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
      return store.docentes
        .filter((docente) => docente.activo !== false)
        .map((docente) => filaDeDocente(docente, comisionesDelDocente(store, docente.id)))
    },

    /** Búsqueda por nombre, apellido, DNI o email: lo que el buscador de la pantalla promete. */
    async buscarDocentes(texto) {
      return buscarDocentesEnStore(store, texto)
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

    /** Cursos del ejemplo, con la misma forma que devuelve la fuente real. */
    async listarCursos() {
      return copiar(store.cursos)
    },

    /** Alta de curso de ejemplo. El código se arma acá porque no hay base que lo genere. */
    async crearCurso({ nombre, descripcion }) {
      const siguiente =
        store.cursos.reduce(
          (mayor, curso) =>
            Math.max(mayor, Number.parseInt(curso.codigo.replace(/\D/g, ''), 10) || 0),
          0,
        ) + 1
      const curso = {
        id: siguienteId(store.cursos),
        codigo: `CUR${String(siguiente).padStart(3, '0')}`,
        nombre,
        descripcion: descripcion ?? null,
      }
      store.cursos.push(curso)
      return { ...curso }
    },

    /**
     * Edición de curso de ejemplo (historia #3): conserva el `id` y el código, y aplica el mismo
     * criterio de unicidad que el backend (normaliza el nombre y excluye al propio curso).
     *
     * El nombre también se actualiza en el `curso` anidado de las comisiones para que una lectura
     * posterior de `listarComisiones()` no devuelva el nombre viejo.
     */
    async editarCurso(id, { nombre, descripcion }) {
      const curso = store.cursos.find((candidato) => candidato.id === id)
      if (!curso) {
        throw new Error('El curso no existe.')
      }

      const nombreNormalizado = normalizeWords(nombre).join(' ')
      const existente = store.cursos.find(
        (candidato) =>
          candidato.id !== id && normalizeWords(candidato.nombre).join(' ') === nombreNormalizado,
      )
      if (existente) {
        throw new Error(
          `Ya existe un curso con ese nombre: ${existente.codigo} — ${existente.nombre}.`,
        )
      }

      Object.assign(curso, { nombre, descripcion: descripcion ?? null })
      for (const comision of store.comisiones) {
        if (normalizeCode(comision.curso.codigo) === normalizeCode(curso.codigo)) {
          comision.curso = { ...comision.curso, nombre }
        }
      }
      return { ...curso }
    },

    /**
     * Alta de comisión de ejemplo: el número es el siguiente del curso, como en la fuente real.
     *
     * `curso_id` llega numérico, igual que a la fuente real, así que el curso se busca por `id` y
     * no por código. Buscarlo por código fue lo que escondió el contrato roto del lado de la
     * pantalla: el ejemplo aceptaba un string donde la base exige un entero.
     */
    async crearComision({
      curso_id,
      docente_id,
      dias_horarios,
      arancel,
      cupo_maximo,
      modalidad,
      sede_id,
    }) {
      const cursos = await this.listarCursos()
      const curso = cursos.find((candidato) => String(candidato.id) === String(curso_id))
      const delCurso = store.comisiones.filter(
        (comision) => normalizeCode(comision.curso.codigo) === normalizeCode(curso?.codigo),
      )
      const docente = store.docentes.find(
        (candidato) => String(candidato.id) === String(docente_id),
      )
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
      return copiar(store.alumnos.filter((alumno) => alumno.activo !== false))
    },

    async crearInscripcion({ alumno_id, comision_id }) {
      const comision = store.comisiones.find((c) => c.id === comision_id)
      if (!comision) {
        throw new Error('La comisión no existe.')
      }
      const existente = store.inscripciones?.find(
        (i) => i.alumno_id === alumno_id && i.comision_id === comision_id,
      )
      if (existente) {
        throw new Error('El alumno ya está inscripto en esa comisión.')
      }
      if ((comision.inscriptos ?? 0) >= comision.cupo_maximo) {
        throw new Error('La comisión está completa.')
      }
      comision.inscriptos = (comision.inscriptos ?? 0) + 1
      comision.vacantes = comision.cupo_maximo - comision.inscriptos
      store.inscripciones = store.inscripciones || []
      store.inscripciones.push({ alumno_id, comision_id, estado: 'ACTIVA' })
      return {
        id: store.inscripciones.length,
        alumno_id,
        comision_id,
        categoria: 'PARTICULAR',
        estado: 'ACTIVA',
      }
    },

    /** Búsqueda por DNI o nombre: es lo que promete el placeholder del buscador. */
    async buscarAlumnos(texto) {
      return buscarPorTexto(
        store.alumnos.filter((alumno) => alumno.activo !== false),
        texto,
        ['nombre', 'documento'],
      )
    },

    /**
     * Alta de alumno de ejemplo (historia #13): agrega la fila al store y la devuelve con la
     * misma forma que la fuente real.
     *
     * El alumno recién creado no tiene inscripción, así que comisión, categoría, porcentaje de
     * beca y acceso van en `null`: la pantalla los muestra como `Sin comisión` y `—` (D43), sin
     * inventar datos que pertenecen a historias posteriores.
     */
    async crearAlumno({ documento, nombre, email, telefono }) {
      const alumno = {
        id: siguienteId(store.alumnos),
        nombre,
        documento,
        tipo_documento: 'DNI',
        email,
        telefono: telefono ?? null,
        activo: true,
        comision: null,
        categoria: null,
        porcentaje_beca: null,
        acceso: null,
      }
      store.alumnos.push(alumno)
      // La contraseña se devuelve una sola vez, como en el backend: no se guarda en el padrón.
      return { ...alumno, password_inicial: passwordInicial(nombre, documento) }
    },

    /**
     * Edición de ejemplo (historia #17): conserva el `id` y reemplaza los datos personales.
     * Los duplicados se comparan con el documento normalizado y el email exacto, como el backend.
     */
    async editarAlumno(id, { documento, nombre, email, telefono }) {
      const alumno = store.alumnos.find((candidato) => candidato.id === id)
      if (!alumno) {
        throw new Error('El alumno no existe.')
      }
      const documentoNormalizado = String(documento).replace(/\D/g, '')
      const documentoRepetido = store.alumnos.some(
        (candidato) =>
          candidato.id !== id &&
          String(candidato.documento ?? '').replace(/\D/g, '') === documentoNormalizado,
      )
      if (documentoRepetido) {
        throw new Error('Ya hay un alumno registrado con ese documento.')
      }
      const emailRepetido = store.alumnos.some(
        (candidato) => candidato.id !== id && candidato.email === email,
      )
      if (emailRepetido) {
        throw new Error('Ya hay un alumno registrado con ese email.')
      }

      Object.assign(alumno, {
        documento,
        tipo_documento: 'DNI',
        nombre,
        email,
        telefono: telefono ?? null,
      })
      return { ...alumno }
    },

    /** Restablecimiento de contraseña de ejemplo: la nueva no se guarda ni se devuelve. */
    async restablecerPasswordAlumno(id, newPassword) {
      const alumno = store.alumnos.find((candidato) => candidato.id === id)
      if (!alumno) {
        throw new Error('El alumno no existe.')
      }
      if (newPassword.length < 8) {
        throw new Error('La contraseña nueva tiene que tener al menos 8 caracteres.')
      }
      return { ...alumno }
    },

    /** Baja lógica de ejemplo: el alumno deja de aparecer, pero la fila del store se conserva. */
    async eliminarAlumno(id) {
      const alumno = store.alumnos.find((candidato) => candidato.id === id)
      if (!alumno) {
        throw new Error('El alumno no existe.')
      }
      if (alumno.activo === false) {
        throw new Error('El alumno ya está dado de baja.')
      }
      alumno.activo = false
      return { ...alumno }
    },

    /** Detección de reactivación de ejemplo, con las mismas reglas de conflicto que el backend. */
    async buscarAlumnoReactivable({ documento, email }) {
      const documentoNormalizado = String(documento).replace(/\D/g, '')
      const porDocumento = store.alumnos.find(
        (alumno) => String(alumno.documento ?? '').replace(/\D/g, '') === documentoNormalizado,
      )
      const porEmail = store.alumnos.find((alumno) => alumno.email === email)
      if (
        (porDocumento && porDocumento.activo !== false) ||
        (porEmail && porEmail.activo !== false)
      ) {
        return null
      }
      if (porDocumento && porEmail && porDocumento.id !== porEmail.id) {
        return null
      }
      const alumno = porDocumento || porEmail
      return alumno && alumno.activo === false ? { ...alumno } : null
    },

    /** Reactivación de ejemplo: conserva el `id` y devuelve una nueva contraseña inicial. */
    async reactivarAlumno(id, { documento, nombre, email, telefono }) {
      const alumno = store.alumnos.find((candidato) => candidato.id === id)
      if (!alumno) {
        throw new Error('El alumno no existe.')
      }
      if (alumno.activo !== false) {
        throw new Error('El alumno ya está activo.')
      }
      const documentoNormalizado = String(documento).replace(/\D/g, '')
      const documentoRepetido = store.alumnos.some(
        (candidato) =>
          candidato.id !== id &&
          String(candidato.documento ?? '').replace(/\D/g, '') === documentoNormalizado,
      )
      if (documentoRepetido) {
        throw new Error('Ya hay un alumno registrado con ese documento.')
      }
      const emailRepetido = store.alumnos.some(
        (candidato) => candidato.id !== id && candidato.email === email,
      )
      if (emailRepetido) {
        throw new Error('Ya hay un alumno registrado con ese email.')
      }

      Object.assign(alumno, {
        documento,
        tipo_documento: 'DNI',
        nombre,
        email,
        telefono: telefono ?? null,
        activo: true,
      })
      return { ...alumno, password_inicial: passwordInicial(nombre, documento) }
    },

    async listarEmpresas() {
      return copiar(store.empresas)
    },

    /**
     * Alta de cuenta corporativa de ejemplo (18): agrega la fila al store y la devuelve con la
     * misma forma que la fuente real. El duplicado se resuelve sobre el CUIT normalizado (D6),
     * como el backend, para que la pantalla pruebe el rechazo igual con las dos fuentes.
     */
    async crearEmpresa({ razon_social, cuit, requiere_factura_a }) {
      const cuit_norm = normalizeCuit(cuit)
      const existente = store.empresas.find((empresa) => empresa.cuit_norm === cuit_norm)
      if (existente !== undefined) {
        throw new Error(
          `Ya hay una empresa registrada con ese CUIT: ${existente.razon_social} (CUIT ${existente.cuit}).`,
        )
      }

      const empresa = {
        id: siguienteId(store.empresas),
        razon_social,
        cuit,
        cuit_norm,
        preferencia_factura: requiere_factura_a ? TIPO_FACTURA.A : TIPO_FACTURA.B,
        requiere_factura_a,
        nomina_empleados: '',
      }
      store.empresas.push(empresa)
      return { ...empresa }
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
