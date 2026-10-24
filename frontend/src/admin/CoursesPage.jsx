import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Badge, Button, Campo, Card, Input, Modal, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { MODALIDAD } from '../domain/enums'
import { normalizeCode } from '../domain/normalize'
import {
  obtenerResumenCatalogo,
  crearComision,
  crearCurso,
  crearInscripcion,
  editarComision,
  editarCurso,
  listarAlumnos,
  listarComisiones,
  listarCursos,
  listarDocentes,
  listarSedes,
} from '../services/dataService'
import { formatMoneda } from '../utils/formato'
import { CampoHorarios } from '../components/horarios/CampoHorarios'
import { HorarioCompacto } from '../components/horarios/HorarioCompacto'
import { SelectorHorarios } from '../components/horarios/SelectorHorarios'

/**
 * Cursos y comisiones (9.3), en dos vistas encadenadas.
 *
 * **La misma pantalla dibuja el catálogo o un curso, según la ruta.** `/admin/cursos` es el grid de
 * cursos y `/admin/cursos/:codigo` es la tabla de comisiones de ese curso. Son dos vistas de una
 * sola cosa —el catálogo— y comparten los mismos cinco listados y el mismo modal de alta, así que
 * viven en el mismo archivo: partirlo repartiría el estado y duplicaría el modal.
 *
 * **Las dos altas escriben contra la base** desde el change `altas-catalogo-docentes`. El modal
 * de comisión ya no pide el código: lo genera el sistema a partir del curso (D34), así que el
 * formulario lo quita y muestra el que devuelve la API. El de curso es nuevo y pide solo el
 * nombre: el código lo genera la base (D32) y se muestra después de confirmar.
 *
 * **El selector de curso llega elegido cuando se abre desde un curso.** La comisión que se crea
 * desde adentro de un curso es de ese curso, y pedir que la secretaría vuelva a elegirlo es pedir
 * que confirme algo que ya está decidido. Desde el catálogo el selector viene vacío, porque ahí no
 * hay ningún curso elegido todavía.
 *
 * **Edición de curso y de comisión.** La HU 3 agregó el menú `⋮` de la tarjeta y el modal
 * `Editar Curso`; la HU 4 agrega la columna `ACCIONES` de la tabla de comisiones con el botón
 * `Editar` y el modal `Editar Comisión`, que no ofrece curso, modalidad, sede ni código (D51). El
 * cupo se valida contra los inscriptos activos en la pantalla y otra vez en la fuente, que es la
 * autoridad.
 *
 * **`Modalidad` y `Sede` no están en el prototipo y sí van** (historia #8). La `Sede` es
 * **opcional en toda modalidad**: se renderiza solo cuando la modalidad elegida es `Presencial` o
 * `Híbrido`, y no mientras el selector siga en `Seleccionar…`, que es como abre el modal. Para
 * `Virtual` el campo ni existe, y su valor tampoco llega al payload. La única regla de la base es
 * la inversa —el CHECK `modalidad_virtual_sin_sede` prohíbe la sede en `Virtual`—, así que acá no
 * hay validación que la duplique.
 *
 * **Un alta fallida no cierra el formulario ni confirma nada.** Deja lo que el operador completó
 * y muestra el motivo que devuelve la fuente. Cerrar el modal como si se hubiera guardado sería
 * la forma más fácil de que la secretaría se vaya creyendo que el sistema guarda (D36).
 *
 * **`VACANTES` lleva el chip `LLENO` cuando vale 0.** La comisión cerrada por cupo del cliente es
 * `CUR-104` y es la única de las cinco filas del maquetado sin lugar: el chip hace visible por qué
 * no se puede inscribir a nadie más.
 */
const COLUMNAS = [
  {
    clave: 'codigo',
    titulo: 'CÓDIGO',
    render: (fila) => <span className="font-medium">{fila.codigo}</span>,
  },
  { clave: 'curso', titulo: 'CURSO / PROGRAMA', render: (fila) => fila.curso.nombre },
  { clave: 'docente', titulo: 'DOCENTE', render: (fila) => fila.docente_nombre },
  {
    clave: 'horario',
    titulo: 'HORARIO',
    // El renderer compacto sale de los horarios estructurados: un día por fila, con el badge `+N`
    // cuando hay más de un grupo (historia #48).
    render: (fila) => <HorarioCompacto horarios={fila.horarios} texto={fila.dias_horarios} />,
  },
  { clave: 'cupo', titulo: 'CUPO MÁX.', render: (fila) => fila.cupo_maximo },
  {
    clave: 'vacantes',
    titulo: 'VACANTES',
    render: (fila) =>
      fila.vacantes === 0 ? (
        <span className="inline-flex items-center gap-2">
          0<Badge tono={TONO.ROJO}>LLENO</Badge>
        </span>
      ) : (
        fila.vacantes
      ),
  },
  { clave: 'arancel', titulo: 'ARANCEL', render: (fila) => formatMoneda(fila.arancel) },
]

/** Modalidades del dominio, en el orden del spec, con el rótulo que ve el operador. */
const MODALIDADES = [
  { valor: MODALIDAD.VIRTUAL, etiqueta: 'Virtual' },
  { valor: MODALIDAD.PRESENCIAL, etiqueta: 'Presencial' },
  { valor: MODALIDAD.HIBRIDO, etiqueta: 'Híbrido' },
]

const CAMPOS_COMISION_VACIOS = {
  curso: '',
  docente: '',
  horarios: [],
  cupo: '',
  arancel: '',
  modalidad: '',
  sede: '',
}

const CAMPOS_CURSO_VACIOS = { nombre: '', descripcion: '' }

/**
 * El formulario de edición de comisión: solo los cuatro datos que la historia #4 habilita.
 *
 * Curso, número, modalidad, sede y código **no** están, porque el contrato de la edición no los
 * admite (D51): no son un olvido de la pantalla.
 */
const CAMPOS_EDICION_COMISION_VACIOS = {
  docente: '',
  horarios: [],
  cupo: '',
  arancel: '',
}

/**
 * Lo que dice el buscador de que todavía no filtra.
 *
 * El campo se ve deshabilitado y no hay estado atrás: la búsqueda de cursos es la historia que
 * todavía no se escribió, y un campo que se ve igual que los demás y no acepta el foco obliga a
 * probarlo para enterarse (D20).
 */
const LEYENDA_BUSCADOR = 'la búsqueda todavía no está disponible'

export function CoursesPage() {
  // `undefined` es la vista del catálogo; con parámetro, la vista de ese curso.
  const { codigo: codigoDeRuta } = useParams()
  const navegar = useNavigate()

  const [comisiones, setComisiones] = useState([])
  const [cursos, setCursos] = useState([])
  const [docentes, setDocentes] = useState([])
  const [sedes, setSedes] = useState([])
  const [resumen, setResumen] = useState({ total_comisiones: 0 })
  // Mientras el catálogo no llegó no se sabe si el curso de la ruta existe. Sin este flag, la
  // pantalla dibujaría "curso no encontrado" en el primer render y después lo desmentiría.
  const [catalogoListo, setCatalogoListo] = useState(false)
  const [modalComision, setModalComision] = useState(false)
  const [modalCurso, setModalCurso] = useState(false)
  const [cursoEditando, setCursoEditando] = useState(null)
  const [camposEdicionCurso, setCamposEdicionCurso] = useState(CAMPOS_CURSO_VACIOS)
  const [erroresEdicionCurso, setErroresEdicionCurso] = useState({})
  const [falloEdicionCurso, setFalloEdicionCurso] = useState(null)
  const [guardandoEdicionCurso, setGuardandoEdicionCurso] = useState(false)
  const [comisionEditando, setComisionEditando] = useState(null)
  const [camposEdicionComision, setCamposEdicionComision] = useState(
    CAMPOS_EDICION_COMISION_VACIOS,
  )
  // El modal de horarios es uno solo y sabe sobre qué formulario trabaja: `alta`, `edicion` o nada.
  // `apertura` cambia en cada apertura y es la `key` del selector: así el estado nace de los
  // horarios actuales y lo que se canceló no queda.
  const [selectorHorarios, setSelectorHorarios] = useState(null)

  function abrirSelectorHorarios(destino) {
    setSelectorHorarios((anterior) => ({ destino, apertura: (anterior?.apertura ?? 0) + 1 }))
  }
  const [erroresEdicionComision, setErroresEdicionComision] = useState({})
  const [falloEdicionComision, setFalloEdicionComision] = useState(null)
  const [guardandoEdicionComision, setGuardandoEdicionComision] = useState(false)
  const [modalInscripcion, setModalInscripcion] = useState(false)
  const [alumnos, setAlumnos] = useState([])
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState('')
  const [comisionSeleccionada, setComisionSeleccionada] = useState('')
  const [falloInscripcion, setFalloInscripcion] = useState(null)
  const [guardandoInscripcion, setGuardandoInscripcion] = useState(false)
  const [campos, setCampos] = useState(CAMPOS_COMISION_VACIOS)
  const [camposCurso, setCamposCurso] = useState(CAMPOS_CURSO_VACIOS)
  const [errores, setErrores] = useState({})
  const [erroresCurso, setErroresCurso] = useState({})
  const [aviso, setAviso] = useState(null)
  const [fallo, setFallo] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    listarComisiones().then(setComisiones)
    // El selector de curso se arma con el catálogo, no con las comisiones: si se armara con las
    // comisiones, un curso recién creado no podría abrir su primera comisión.
    listarCursos().then((catalogo) => {
      setCursos(catalogo)
      setCatalogoListo(true)
    })
    listarDocentes().then(setDocentes)
    listarAlumnos().then(setAlumnos)
    listarSedes().then(setSedes)
    obtenerResumenCatalogo().then(setResumen)
  }, [])

  // Se comparan los códigos normalizados (D6): `cur-101` y `CUR-101` son el mismo curso, y el
  // criterio es el mismo que usa el modelo para el índice único.
  //
  // `?? null` y no el `undefined` que devuelve `find`: con el catálogo todavía vacío —el primer
  // render, antes de que llegue la respuesta— no hay curso abierto, y sin esto la pantalla
  // intentaría leer el código de un curso que todavía no existe.
  const cursoDeRuta =
    codigoDeRuta === undefined
      ? null
      : (cursos.find((curso) => normalizeCode(curso.codigo) === normalizeCode(codigoDeRuta)) ??
        null)

  /**
   * Conteo de comisiones por curso, armado una vez.
   *
   * La tarjeta y la tabla salen de este mismo estado, así que no pueden contradecirse. Y no se
   * cuenta curso por curso en cada tarjeta: con el catálogo chico no se nota, y el día que
   * tenga cientos de cursos cada tarjeta recorriendo la lista entera se va a notar.
   */
  const comisionesPorCurso = comisiones.reduce((conteos, comision) => {
    const clave = normalizeCode(comision.curso.codigo)
    conteos.set(clave, (conteos.get(clave) ?? 0) + 1)
    return conteos
  }, new Map())

  const comisionesDelCurso =
    cursoDeRuta === null
      ? []
      : comisiones.filter(
          (comision) => normalizeCode(comision.curso.codigo) === normalizeCode(cursoDeRuta.codigo),
        )

  // "Hace falta mostrarlo" y "es Presencial o Híbrido" son hoy la misma condición: la sede es
  // opcional en toda modalidad, así que no hay nada que exigir. El campo aparece recién cuando la
  // modalidad elegida sea una de esas dos, y no mientras el selector siga en `Seleccionar…`.
  const mostrarSede =
    campos.modalidad === MODALIDAD.PRESENCIAL || campos.modalidad === MODALIDAD.HIBRIDO

  /**
   * Docentes que ofrece el selector de la edición de comisión.
   *
   * `GET /docentes` devuelve solo activos. Si la comisión tiene asignado un docente que ya no lo
   * está, sin esta opción el `select` arrancaría vacío y la secretaría no podría guardar ni un
   * cambio de arancel sin reasignarle el docente (D51).
   */
  const docentesDelSelector =
    comisionEditando !== null &&
    comisionEditando.docente_id !== null &&
    !docentes.some((docente) => docente.id === comisionEditando.docente_id)
      ? [
          ...docentes,
          {
            id: comisionEditando.docente_id,
            nombre: `${comisionEditando.docente_nombre ?? 'Docente'} (baja)`,
          },
        ]
      : docentes

  /** Inscriptos que la fila que se está editando informa como ocupantes del cupo. */
  const inscriptosDeLaEdicion =
    comisionEditando === null ? 0 : inscriptosActivos(comisionEditando)

  function cambiar(campo) {
    return (evento) => setCampos((anteriores) => ({ ...anteriores, [campo]: evento.target.value }))
  }

  function cambiarCurso(campo) {
    return (evento) =>
      setCamposCurso((anteriores) => ({ ...anteriores, [campo]: evento.target.value }))
  }

  function abrirModalComision() {
    // Desde un curso, la comisión es de ese curso: el selector llega elegido y bloqueado. Desde el
    // catálogo llega vacío, porque ahí todavía no se eligió ninguno.
    setCampos(
      cursoDeRuta === null
        ? CAMPOS_COMISION_VACIOS
        : { ...CAMPOS_COMISION_VACIOS, curso: String(cursoDeRuta.id) },
    )
    setErrores({})
    setFallo(null)
    setModalComision(true)
  }

  function cerrarModal() {
    setModalComision(false)
    setCampos(CAMPOS_COMISION_VACIOS)
    setErrores({})
    setFallo(null)
  }

  function cerrarModalCurso() {
    setModalCurso(false)
    setCamposCurso(CAMPOS_CURSO_VACIOS)
    setErroresCurso({})
    setFallo(null)
  }

  function abrirEdicionCurso(curso) {
    setCursoEditando(curso)
    setCamposEdicionCurso({
      nombre: curso.nombre,
      descripcion: curso.descripcion ?? '',
    })
    setErroresEdicionCurso({})
    setFalloEdicionCurso(null)
  }

  function cerrarEdicionCurso() {
    setCursoEditando(null)
    setCamposEdicionCurso(CAMPOS_CURSO_VACIOS)
    setErroresEdicionCurso({})
    setFalloEdicionCurso(null)
  }

  function cambiarEdicionCurso(campo) {
    return (evento) =>
      setCamposEdicionCurso((anteriores) => ({ ...anteriores, [campo]: evento.target.value }))
  }

  /**
   * Guarda la edición y actualiza las **dos** vistas con la misma respuesta (D-D del change).
   *
   * No se vuelve a pedir el catálogo: una recarga extra dejaría la tarjeta y la tabla mostrando
   * nombres distintos mientras una de las respuestas está en vuelo. Un rechazo deja el modal
   * abierto con el motivo que devolvió la fuente.
   */
  async function guardarEdicionCurso() {
    if (camposEdicionCurso.nombre.trim() === '') {
      setErroresEdicionCurso({ nombre: 'El nombre del curso es obligatorio.' })
      return
    }

    setGuardandoEdicionCurso(true)
    setFalloEdicionCurso(null)
    try {
      // Sin `codigo`: el contrato no lo admite y el sistema lo genera (D32).
      const actualizado = await editarCurso(cursoEditando.id, {
        nombre: camposEdicionCurso.nombre,
        descripcion: camposEdicionCurso.descripcion === '' ? null : camposEdicionCurso.descripcion,
      })
      setCursos((anteriores) =>
        anteriores.map((curso) => (curso.id === actualizado.id ? actualizado : curso)),
      )
      setComisiones((anteriores) =>
        anteriores.map((comision) =>
          normalizeCode(comision.curso.codigo) === normalizeCode(actualizado.codigo)
            ? { ...comision, curso: { ...comision.curso, nombre: actualizado.nombre } }
            : comision,
        ),
      )
      cerrarEdicionCurso()
      setAviso(`Curso ${actualizado.codigo} actualizado.`)
    } catch (error) {
      setFalloEdicionCurso(error?.message ?? 'No se pudo guardar el curso.')
    } finally {
      setGuardandoEdicionCurso(false)
    }
  }

  function abrirEdicionComision(comision) {
    setComisionEditando(comision)
    setCamposEdicionComision({
      docente: comision.docente_id === null ? '' : String(comision.docente_id),
      horarios: comision.horarios ?? [],
      cupo: String(comision.cupo_maximo),
      arancel: String(comision.arancel),
    })
    setErroresEdicionComision({})
    setFalloEdicionComision(null)
  }

  function cerrarEdicionComision() {
    setComisionEditando(null)
    setCamposEdicionComision(CAMPOS_EDICION_COMISION_VACIOS)
    setErroresEdicionComision({})
    setFalloEdicionComision(null)
  }

  function cambiarEdicionComision(campo) {
    return (evento) =>
      setCamposEdicionComision((anteriores) => ({
        ...anteriores,
        [campo]: evento.target.value,
      }))
  }

  /**
   * Validación local del formulario de comisión.
   *
   * La reducción de cupo se compara contra los inscriptos que la fila informa, para no mandar una
   * edición que la fuente va a rechazar igual. **No reemplaza al servidor:** si la fila quedó
   * vieja, la respuesta de la fuente trae la cantidad real y se muestra tal cual.
   */
  function validarEdicionComision() {
    const encontrados = {}
    const inscriptos = inscriptosActivos(comisionEditando)
    const cupo = Number(camposEdicionComision.cupo)

    if (camposEdicionComision.docente === '') {
      encontrados.docente = 'Elegí el docente de la comisión.'
    }
    if (camposEdicionComision.horarios.length === 0) {
      encontrados.horarios = 'Agregá al menos un horario.'
    }
    if (
      camposEdicionComision.cupo.trim() === '' ||
      !Number.isInteger(cupo) ||
      cupo <= 0
    ) {
      encontrados.cupo = 'El cupo debe ser un entero positivo.'
    } else if (cupo < inscriptos) {
      encontrados.cupo =
        `La comisión tiene ${inscriptos} inscriptos activos: el cupo máximo no puede ser ` +
        `menor que ${inscriptos}.`
    }
    if (camposEdicionComision.arancel.trim() === '' || Number(camposEdicionComision.arancel) <= 0) {
      encontrados.arancel = 'El arancel debe ser un valor positivo.'
    }

    return encontrados
  }

  /**
   * Guarda la edición de comisión y reemplaza la fila con lo que devuelve la fuente.
   *
   * La respuesta trae las vacantes recalculadas, así que la tabla no necesita volver a pedir el
   * listado. Un rechazo deja el modal abierto con el motivo, igual que en las demás ediciones.
   */
  async function guardarEdicionComision() {
    const encontrados = validarEdicionComision()
    setErroresEdicionComision(encontrados)

    if (Object.keys(encontrados).length > 0) {
      return
    }

    setGuardandoEdicionComision(true)
    setFalloEdicionComision(null)
    try {
      // Sin curso, número, modalidad, sede ni código: el contrato no los admite (D51).
      const actualizada = await editarComision(comisionEditando.id, {
        docente_id: Number(camposEdicionComision.docente),
        horarios: camposEdicionComision.horarios,
        cupo_maximo: Number(camposEdicionComision.cupo),
        arancel: Number(camposEdicionComision.arancel),
      })
      setComisiones((anteriores) =>
        anteriores.map((comision) =>
          comision.id === actualizada.id ? actualizada : comision,
        ),
      )
      cerrarEdicionComision()
      setAviso(`Comisión ${actualizada.codigo} actualizada.`)
    } catch (error) {
      // El choque de horario con otra comisión del mismo docente llega como 409 y se muestra bajo
      // el campo de horarios: es el dato que hay que cambiar. Cualquier 409 del guardado va ahí,
      // porque no hay otro campo que lo produzca en la práctica (historia #48).
      if (error?.status === 409) {
        setErroresEdicionComision((anteriores) => ({ ...anteriores, horarios: error.message }))
        return
      }
      setFalloEdicionComision(error?.message ?? 'No se pudo guardar la comisión.')
    } finally {
      setGuardandoEdicionComision(false)
    }
  }

  function abrirModalInscripcion(comisionId = '') {
    setComisionSeleccionada(comisionId === '' ? '' : String(comisionId))
    setAlumnoSeleccionado('')
    setFalloInscripcion(null)
    setModalInscripcion(true)
  }

  function cerrarModalInscripcion() {
    setModalInscripcion(false)
    setComisionSeleccionada('')
    setAlumnoSeleccionado('')
    setFalloInscripcion(null)
  }

  async function guardarInscripcion() {
    if (alumnoSeleccionado === '' || comisionSeleccionada === '') {
      setFalloInscripcion('Elegí el alumno y la comisión.')
      return
    }
    setGuardandoInscripcion(true)
    setFalloInscripcion(null)
    try {
      await crearInscripcion({
        alumno_id: Number(alumnoSeleccionado),
        comision_id: Number(comisionSeleccionada),
        categoria: 'PARTICULAR',
      })
      // Actualización optimista: la vacante baja en uno sin recargar.
      setComisiones((anteriores) =>
        anteriores.map((comision) =>
          comision.id === Number(comisionSeleccionada)
            ? { ...comision, vacantes: Math.max((comision.vacantes ?? 0) - 1, 0) }
            : comision,
        ),
      )
      cerrarModalInscripcion()
    } catch (error) {
      setFalloInscripcion(error?.message ?? 'No se pudo inscribir al alumno.')
    } finally {
      setGuardandoInscripcion(false)
    }
  }

  function validar() {
    const encontrados = {}

    if (campos.curso === '') {
      encontrados.curso = 'Elegí el curso del programa.'
    }
    if (campos.docente === '') {
      encontrados.docente = 'Elegí el docente de la comisión.'
    }
    if (campos.horarios.length === 0) {
      encontrados.horarios = 'Agregá al menos un horario.'
    }
    if (campos.cupo.trim() === '' || Number(campos.cupo) <= 0) {
      encontrados.cupo = 'El cupo debe ser un entero positivo.'
    }
    if (campos.arancel.trim() === '' || Number(campos.arancel) <= 0) {
      encontrados.arancel = 'El arancel debe ser un valor positivo.'
    }
    if (campos.modalidad === '') {
      encontrados.modalidad = 'Elegí la modalidad de la comisión.'
    }
    // La sede no se valida: es opcional en toda modalidad (historia #8). La regla que sí existe es
    // la inversa y la sostiene el CHECK `modalidad_virtual_sin_sede` de la base.

    return encontrados
  }

  /**
   * Guarda y, si la fuente rechaza, **deja el formulario abierto**.
   *
   * El fallo se muestra tal como viene de la fuente, y no se reemplaza por un texto propio: la
   * fuente dice qué dato se repitió, y ese texto está escrito para quien lo va a corregir.
   */
  async function guardar() {
    const encontrados = validar()
    setErrores(encontrados)

    if (Object.keys(encontrados).length > 0) {
      return
    }

    setGuardando(true)
    setFallo(null)
    try {
      const creada = await crearComision({
        // `curso_id` es el identificador, no el código: el backend lo resuelve por primary key y
        // espera un entero. El selector ofrece el nombre del curso para que se lea, pero manda el
        // id (D34).
        curso_id: Number(campos.curso),
        docente_id: Number(campos.docente),
        horarios: campos.horarios,
        arancel: Number(campos.arancel),
        cupo_maximo: Number(campos.cupo),
        modalidad: campos.modalidad,
        // Derivado de `mostrarSede`, no de `campos.sede`: el `select` se desmonta al cambiar a
        // Virtual pero `campos.sede` conserva el valor viejo, así que leerlo solo mandaría la sede
        // de una comisión virtual — que el CHECK de la base rechaza con 422.
        sede_id: mostrarSede && campos.sede !== '' ? Number(campos.sede) : null,
      })
      setComisiones((anteriores) => [...anteriores, creada])
      setResumen((anterior) => ({ total_comisiones: anterior.total_comisiones + 1 }))
      cerrarModal()
      setAviso(`Comisión ${creada.codigo} creada.`)
    } catch (error) {
      if (error?.status === 409) {
        setErrores((anteriores) => ({ ...anteriores, horarios: error.message }))
        return
      }
      setFallo(error?.message ?? 'No se pudo guardar la comisión.')
    } finally {
      setGuardando(false)
    }
  }

  async function guardarCurso() {
    if (camposCurso.nombre.trim() === '') {
      setErroresCurso({ nombre: 'El nombre del curso es obligatorio.' })
      return
    }

    setGuardando(true)
    setFallo(null)
    try {
      // Sin `codigo`: el contrato no lo admite y el sistema lo genera (D32).
      const creado = await crearCurso({
        nombre: camposCurso.nombre,
        descripcion: camposCurso.descripcion,
      })
      setCursos((anteriores) => [...anteriores, creado])
      cerrarModalCurso()
      setAviso(`Curso ${creado.codigo} creado.`)
    } catch (error) {
      setFallo(error?.message ?? 'No se pudo guardar el curso.')
    } finally {
      setGuardando(false)
    }
  }

  function abrirCurso(curso) {
    navegar(`/admin/cursos/${curso.codigo}`)
  }

  /**
   * La tabla de comisiones con la columna de acciones al final, como en el padrón de alumnos.
   *
   * La columna vive acá y no en `COLUMNAS` porque necesita el handler de la pantalla; el resto de
   * las columnas son del dato y no tienen estado.
   */
  const columnasComisiones = [
    ...COLUMNAS,
    {
      clave: 'acciones',
      titulo: 'ACCIONES',
      render: (fila) => (
        <Button
          variante="secundario"
          tamano="chico"
          className="whitespace-nowrap"
          onClick={() => abrirEdicionComision(fila)}
        >
          Editar
        </Button>
      ),
    },
  ]

  let contenido = null

  if (catalogoListo) {
    if (codigoDeRuta === undefined) {
      contenido = (
        <VistaCursos
          cursos={cursos}
          comisionesPorCurso={comisionesPorCurso}
          resumen={resumen}
          onNuevoCurso={() => setModalCurso(true)}
          onNuevaComision={abrirModalComision}
          onInscribir={() => abrirModalInscripcion()}
          onAbrir={abrirCurso}
          onEditar={abrirEdicionCurso}
        />
      )
    } else if (cursoDeRuta === null) {
      // Una tabla vacía acá se leería como "este curso no tiene comisiones", que es una afirmación
      // falsa: el curso directamente no existe.
      contenido = <CursoInexistente onVolver={() => navegar('/admin/cursos')} />
    } else {
      contenido = (
        <VistaComisiones
          curso={cursoDeRuta}
          comisiones={comisionesDelCurso}
          columnas={columnasComisiones}
          resumen={resumen}
          onVolver={() => navegar('/admin/cursos')}
          onNuevaComision={abrirModalComision}
          onInscribir={() => abrirModalInscripcion()}
        />
      )
    }
  }

  return (
    <div className="space-y-4">
      {contenido}

      {aviso !== null && (
        <p
          role="status"
          className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
        >
          {aviso}
        </p>
      )}

      <Modal
        abierto={modalCurso}
        titulo="Crear Nuevo Curso"
        onClose={cerrarModalCurso}
        pie={
          <>
            <Button variante="secundario" onClick={cerrarModalCurso}>
              Cancelar
            </Button>
            <Button onClick={guardarCurso} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar Curso'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Input
            id="curso-nombre"
            etiqueta="Nombre del Curso"
            valor={camposCurso.nombre}
            onChange={cambiarCurso('nombre')}
            placeholder="Ej: Python Inicial"
            obligatorio
            error={erroresCurso.nombre ?? null}
          />
          <Input
            id="curso-descripcion"
            etiqueta="Descripción"
            valor={camposCurso.descripcion}
            onChange={cambiarCurso('descripcion')}
            placeholder="Opcional."
          />
          <p className="text-xs text-slate-500">
            El código lo genera el sistema y se muestra apenas se guarde.
          </p>
          {fallo !== null && <MensajeFallo>{fallo}</MensajeFallo>}
        </div>
      </Modal>

      <Modal
        abierto={cursoEditando !== null}
        titulo="Editar Curso"
        onClose={cerrarEdicionCurso}
        pie={
          <>
            <Button variante="secundario" onClick={cerrarEdicionCurso}>
              Cancelar
            </Button>
            <Button onClick={guardarEdicionCurso} disabled={guardandoEdicionCurso}>
              {guardandoEdicionCurso ? 'Guardando…' : 'Guardar Cambios'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Input
            id="editar-curso-nombre"
            etiqueta="Nombre del Curso"
            valor={camposEdicionCurso.nombre}
            onChange={cambiarEdicionCurso('nombre')}
            obligatorio
            error={erroresEdicionCurso.nombre ?? null}
          />
          <Input
            id="editar-curso-descripcion"
            etiqueta="Descripción"
            valor={camposEdicionCurso.descripcion}
            onChange={cambiarEdicionCurso('descripcion')}
            placeholder="Opcional."
          />
          {falloEdicionCurso !== null && <MensajeFallo>{falloEdicionCurso}</MensajeFallo>}
        </div>
      </Modal>

      <Modal
        abierto={comisionEditando !== null}
        titulo="Editar Comisión"
        onClose={cerrarEdicionComision}
        pie={
          <>
            <Button variante="secundario" onClick={cerrarEdicionComision}>
              Cancelar
            </Button>
            <Button onClick={guardarEdicionComision} disabled={guardandoEdicionComision}>
              {guardandoEdicionComision ? 'Guardando…' : 'Guardar Cambios'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="editar-comision-docente"
            etiqueta="Docente Asignado"
            obligatorio
            error={erroresEdicionComision.docente ?? null}
          >
            <select
              id="editar-comision-docente"
              value={camposEdicionComision.docente}
              onChange={cambiarEdicionComision('docente')}
            >
              <option value="">Seleccionar…</option>
              {docentesDelSelector.map((docente) => (
                <option key={docente.id} value={String(docente.id)}>
                  {docente.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <CampoHorarios
            id="editar-comision-dias"
            horarios={camposEdicionComision.horarios}
            onAbrir={() => abrirSelectorHorarios('edicion')}
            error={erroresEdicionComision.horarios ?? null}
          />

          <Input
            id="editar-comision-cupo"
            etiqueta="Cupo Máximo"
            type="number"
            valor={camposEdicionComision.cupo}
            onChange={cambiarEdicionComision('cupo')}
            obligatorio
            error={erroresEdicionComision.cupo ?? null}
          />

          <Input
            id="editar-comision-arancel"
            etiqueta="Valor de Arancel de Comisión (AR$)"
            type="number"
            valor={camposEdicionComision.arancel}
            onChange={cambiarEdicionComision('arancel')}
            obligatorio
            error={erroresEdicionComision.arancel ?? null}
          />
        </div>

        {falloEdicionComision !== null && <MensajeFallo>{falloEdicionComision}</MensajeFallo>}

        <p className="mt-4 text-xs text-slate-500">
          {inscriptosDeLaEdicion} {inscriptosDeLaEdicion === 1 ? 'inscripto activo ocupa' : 'inscriptos activos ocupan'}{' '}
          el cupo. El curso, la modalidad y la sede no se editan en esta pantalla.
        </p>
      </Modal>

      <Modal
        abierto={modalComision}
        titulo="Crear Nueva Comisión"
        onClose={cerrarModal}
        pie={
          <>
            <Button variante="secundario" onClick={cerrarModal}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar Comisión'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="curso" etiqueta="Curso / Programa" obligatorio error={errores.curso ?? null}>
            {/* Bloqueado solo cuando el curso viene de la ruta: ahí la comisión no puede ser de
                otro curso, y dejarlo editable sería ofrecer cambiar algo que ya está decidido. */}
            <select
              id="curso"
              value={campos.curso}
              onChange={cambiar('curso')}
              disabled={cursoDeRuta !== null}
            >
              <option value="">Seleccionar…</option>
              {cursos.map((curso) => (
                <option key={curso.codigo} value={curso.id}>
                  {curso.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo
            id="docente"
            etiqueta="Docente Asignado"
            obligatorio
            error={errores.docente ?? null}
          >
            <select id="docente" value={campos.docente} onChange={cambiar('docente')}>
              <option value="">Seleccionar…</option>
              {docentes.map((docente) => (
                <option key={docente.id} value={String(docente.id)}>
                  {docente.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <CampoHorarios
            id="dias_horarios"
            horarios={campos.horarios}
            onAbrir={() => abrirSelectorHorarios('alta')}
            error={errores.horarios ?? null}
          />

          <Input
            id="cupo"
            etiqueta="Cupo Máximo"
            type="number"
            valor={campos.cupo}
            onChange={cambiar('cupo')}
            obligatorio
            error={errores.cupo ?? null}
          />

          <Input
            id="arancel"
            etiqueta="Valor de Arancel de Comisión (AR$)"
            type="number"
            valor={campos.arancel}
            onChange={cambiar('arancel')}
            obligatorio
            error={errores.arancel ?? null}
          />

          <Campo id="modalidad" etiqueta="Modalidad" obligatorio error={errores.modalidad ?? null}>
            <select id="modalidad" value={campos.modalidad} onChange={cambiar('modalidad')}>
              <option value="">Seleccionar…</option>
              {MODALIDADES.map((modalidad) => (
                <option key={modalidad.valor} value={modalidad.valor}>
                  {modalidad.etiqueta}
                </option>
              ))}
            </select>
          </Campo>

          {mostrarSede && (
            <Campo id="sede" etiqueta="Sede">
              <select id="sede" value={campos.sede} onChange={cambiar('sede')}>
                <option value="">Seleccionar…</option>
                {sedes.map((sede) => (
                  <option key={sede.id} value={String(sede.id)}>
                    {sede.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          )}
        </div>

        {fallo !== null && <MensajeFallo>{fallo}</MensajeFallo>}

        <p className="mt-4 text-xs text-slate-500">
          {docentes.length} docentes del padrón disponibles para asignar. El código de la comisión
          lo genera el sistema a partir del curso.
        </p>
      </Modal>

      {/*
        Un solo selector para las dos formas de comisión. Se monta al final del árbol para quedar
        por encima en el orden de lectura, y trabaja sobre una copia que solo devuelve con `Listo`:
        cancelar descarta lo que se haya cambiado.
      */}
      <SelectorHorarios
        key={selectorHorarios?.apertura ?? 0}
        abierto={selectorHorarios !== null}
        horarios={
          selectorHorarios?.destino === 'edicion'
            ? camposEdicionComision.horarios
            : campos.horarios
        }
        onListo={(horarios) => {
          if (selectorHorarios?.destino === 'edicion') {
            setCamposEdicionComision((anteriores) => ({ ...anteriores, horarios }))
          } else {
            setCampos((anteriores) => ({ ...anteriores, horarios }))
          }
          setSelectorHorarios(null)
        }}
        onCancelar={() => setSelectorHorarios(null)}
      />

      <Modal
        abierto={modalInscripcion}
        titulo="Inscribir Alumno"
        onClose={cerrarModalInscripcion}
        pie={
          <>
            <Button variante="secundario" onClick={cerrarModalInscripcion}>
              Cancelar
            </Button>
            <Button onClick={guardarInscripcion} disabled={guardandoInscripcion}>
              {guardandoInscripcion ? 'Guardando…' : 'Inscribir'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Campo id="comision-inscripcion" etiqueta="Comisión" obligatorio>
            <select
              id="comision-inscripcion"
              value={comisionSeleccionada}
              onChange={(evento) => setComisionSeleccionada(evento.target.value)}
            >
              <option value="">Seleccionar…</option>
              {comisiones.map((comision) => (
                <option key={comision.id} value={String(comision.id)}>
                  {comision.codigo} · {comision.curso.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo id="alumno-inscripcion" etiqueta="Alumno" obligatorio>
            <select
              id="alumno-inscripcion"
              value={alumnoSeleccionado}
              onChange={(evento) => setAlumnoSeleccionado(evento.target.value)}
            >
              <option value="">Seleccionar…</option>
              {alumnos.map((alumno) => (
                <option key={alumno.id} value={String(alumno.id)}>
                  {alumno.nombre}
                </option>
              ))}
            </select>
          </Campo>

          {falloInscripcion !== null && <MensajeFallo>{falloInscripcion}</MensajeFallo>}
        </div>
      </Modal>
    </div>
  )
}

/**
 * Inscriptos activos de una comisión, derivados de la fila.
 *
 * `vacantes` es el cupo menos las inscripciones activas (D10), así que la resta devuelve los
 * inscriptos sin agregar un campo al contrato (D51). Es el piso al que se puede reducir el cupo.
 */
function inscriptosActivos(comision) {
  return Math.max((comision.cupo_maximo ?? 0) - (comision.vacantes ?? 0), 0)
}

/** El chip del catálogo, que las dos vistas muestran igual. */
function ChipCatalogo({ total }) {
  return <Badge tono={TONO.CELESTE}>{`${total} en el catálogo`}</Badge>
}

/** Vista de cursos: una tarjeta por curso del catálogo. */
function VistaCursos({
  cursos,
  comisionesPorCurso,
  resumen,
  onNuevoCurso,
  onNuevaComision,
  onInscribir,
  onAbrir,
  onEditar,
}) {
  return (
    <Card
      titulo="Cursos"
      acciones={
        <div className="flex items-center gap-2">
          <ChipCatalogo total={resumen.total_comisiones} />
          <Button variante="secundario" onClick={onNuevoCurso}>
            + Nuevo Curso
          </Button>
          <Button onClick={onNuevaComision}>+ Nueva Comisión</Button>
          <Button variante="secundario" onClick={onInscribir}>
            + Inscribir Alumno
          </Button>
        </div>
      }
    >
      <BuscadorPendiente
        id="buscar-curso"
        etiqueta="Buscar curso"
        placeholder="Buscar por nombre, código o descripción…"
      />

      {cursos.length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no hay cursos en el catálogo.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cursos.map((curso) => (
            <TarjetaCurso
              key={curso.id}
              curso={curso}
              total={comisionesPorCurso.get(normalizeCode(curso.codigo)) ?? 0}
              onAbrir={() => onAbrir(curso)}
              onEditar={onEditar}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

/**
 * La tarjeta de un curso: el cuerpo abre el curso y el botón `⋮` despliega su acción.
 *
 * **Son dos controles hermanos y no un botón dentro de otro.** Un botón dentro de otro botón es
 * HTML inválido y rompe la navegación por teclado. El cuerpo conserva el click en cualquier punto
 * de la tarjeta y el `⋮` detiene la propagación porque es un hermano, no un hijo.
 *
 * El menú es local a la pantalla y no un componente compartido (D-C del change): hoy lo usa una
 * sola vista. Se cierra al elegir la acción, con `Escape` y con un click afuera, y al cerrarlo con
 * `Escape` o con la acción el foco vuelve al botón que lo abrió.
 */
function TarjetaCurso({ curso, total, onAbrir, onEditar }) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const contenedorRef = useRef(null)
  const botonRef = useRef(null)

  useEffect(() => {
    if (!menuAbierto) {
      return undefined
    }

    function alHacerClickAfuera(evento) {
      if (contenedorRef.current !== null && !contenedorRef.current.contains(evento.target)) {
        setMenuAbierto(false)
      }
    }

    function alPresionarEscape(evento) {
      if (evento.key === 'Escape') {
        setMenuAbierto(false)
        botonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', alHacerClickAfuera)
    document.addEventListener('keydown', alPresionarEscape)
    return () => {
      document.removeEventListener('mousedown', alHacerClickAfuera)
      document.removeEventListener('keydown', alPresionarEscape)
    }
  }, [menuAbierto])

  function elegirEdicion() {
    setMenuAbierto(false)
    botonRef.current?.focus()
    onEditar(curso)
  }

  return (
    <div ref={contenedorRef} className="relative">
      <button
        type="button"
        onClick={onAbrir}
        className="foco-acento flex w-full flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 pr-10 text-left shadow-sm hover:border-slate-300 hover:shadow"
      >
        <span className="text-xs font-semibold tracking-wide text-slate-500">{curso.codigo}</span>
        <span className="text-sm font-semibold text-slate-800">{curso.nombre}</span>
        <span className="text-sm text-slate-500">{curso.descripcion ?? '—'}</span>
        <span className="text-xs text-slate-600">
          {total} {total === 1 ? 'comisión' : 'comisiones'}
        </span>
        <span className="texto-acento text-sm font-medium">Abrir comisiones</span>
      </button>

      <div className="absolute right-3 top-3">
        <button
          ref={botonRef}
          type="button"
          aria-label={`Acciones de ${curso.codigo}`}
          aria-haspopup="menu"
          aria-expanded={menuAbierto}
          onClick={() => setMenuAbierto((abierto) => !abierto)}
          className="foco-acento rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
        >
          ⋮
        </button>

        {menuAbierto && (
          <div
            role="menu"
            className="absolute right-0 z-10 mt-1 min-w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={elegirEdicion}
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              Editar curso
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Vista de comisiones: la tabla del curso de la ruta, con el mismo formato de siempre. */
function VistaComisiones({
  curso,
  comisiones,
  columnas,
  resumen,
  onVolver,
  onNuevaComision,
  onInscribir,
}) {
  return (
    <Card
      titulo="Comisiones Activas"
      descripcion={`${curso.nombre} · ${curso.codigo}`}
      acciones={
        <div className="flex items-center gap-2">
          <ChipCatalogo total={resumen.total_comisiones} />
          <Button variante="secundario" onClick={onVolver}>
            Volver a cursos
          </Button>
          <Button onClick={onNuevaComision}>+ Nueva Comisión</Button>
          <Button variante="secundario" onClick={onInscribir}>
            + Inscribir Alumno
          </Button>
        </div>
      }
    >
      <BuscadorPendiente
        id="buscar-comision"
        etiqueta="Buscar comisión"
        placeholder="Buscar por código, docente u horario…"
      />

      <Table
        columnas={columnas}
        filas={comisiones}
        vacio={<p className="text-sm text-slate-500">Este curso todavía no tiene comisiones.</p>}
      />
    </Card>
  )
}

/** La ruta apunta a un curso que no está en el catálogo. */
function CursoInexistente({ onVolver }) {
  return (
    <Card
      titulo="Curso no encontrado"
      acciones={
        <Button variante="secundario" onClick={onVolver}>
          Volver a cursos
        </Button>
      }
    >
      <p className="text-sm text-slate-600">
        Ese curso no está en el catálogo. Puede que el enlace sea de antes de que lo cambiaran.
      </p>
    </Card>
  )
}

/**
 * El buscador, visible y sin función.
 *
 * `readOnly` va con `disabled` porque un control con `value` y sin `onChange` es un campo que
 * React avisa que no se puede editar; deshabilitado ya está.
 */
function BuscadorPendiente({ id, etiqueta, placeholder }) {
  return (
    <div className="mb-4 max-w-sm">
      <Input
        id={id}
        etiqueta={etiqueta}
        valor=""
        placeholder={placeholder}
        disabled
        readOnly
        leyenda={LEYENDA_BUSCADOR}
      />
    </div>
  )
}

/** El motivo por el que la fuente rechazó el alta, tal como vino. */
function MensajeFallo({ children }) {
  return (
    <p
      role="alert"
      className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {children}
    </p>
  )
}
