import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Badge, Button, Campo, Card, Input, Modal, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { MODALIDAD } from '../domain/enums'
import { normalizeCode } from '../domain/normalize'
import {
  obtenerResumenCatalogo,
  crearComision,
  crearCurso,
  listarComisiones,
  listarCursos,
  listarDocentes,
  listarSedes,
} from '../services/dataService'
import { formatMoneda } from '../utils/formato'

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
 * **Sin edición.** El spec deja la edición de curso y de comisión para las historias #3 y #4.
 *
 * **`Modalidad` y `Sede` no están en el prototipo y sí van** (historia #8). La `Sede` es obligatoria
 * solo para `Presencial` y `Híbrido`, que es el CHECK `modalidad_presencial_requiere_sede` del
 * modelo. La regla vive en el formulario y no en el botón: un botón deshabilitado taparía el
 * mensaje de error, y lo que el operador necesita ver es qué campo le falta.
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
  { clave: 'horario', titulo: 'HORARIO', render: (fila) => fila.dias_horarios },
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
  dias_horarios: '',
  cupo: '',
  arancel: '',
  modalidad: '',
  sede: '',
}

const CAMPOS_CURSO_VACIOS = { nombre: '', descripcion: '' }

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

  const exigeSede =
    campos.modalidad === MODALIDAD.PRESENCIAL || campos.modalidad === MODALIDAD.HIBRIDO

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

  function validar() {
    const encontrados = {}

    if (campos.curso === '') {
      encontrados.curso = 'Elegí el curso del programa.'
    }
    if (campos.docente === '') {
      encontrados.docente = 'Elegí el docente de la comisión.'
    }
    if (campos.dias_horarios.trim() === '') {
      encontrados.dias_horarios = 'Los días y horarios son obligatorios.'
    }
    if (campos.cupo.trim() === '' || Number(campos.cupo) <= 0) {
      encontrados.cupo = 'El cupo debe ser un entero positivo.'
    }
    if (campos.arancel.trim() === '' || Number(campos.arancel) <= 0) {
      encontrados.arancel = 'El arancel debe ser un valor positivo.'
    }
    if (campos.modalidad === '') {
      encontrados.modalidad = 'Elegí la modalidad de la comisión.'
    } else if (campos.sede === '' && exigeSede) {
      encontrados.sede = 'El campo Sede es obligatorio para modalidad Presencial o Híbrido.'
    }

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
        dias_horarios: campos.dias_horarios,
        arancel: Number(campos.arancel),
        cupo_maximo: Number(campos.cupo),
        modalidad: campos.modalidad,
        sede_id: campos.sede === '' ? null : Number(campos.sede),
      })
      setComisiones((anteriores) => [...anteriores, creada])
      setResumen((anterior) => ({ total_comisiones: anterior.total_comisiones + 1 }))
      cerrarModal()
      setAviso(`Comisión ${creada.codigo} creada.`)
    } catch (error) {
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
          onAbrir={abrirCurso}
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
          resumen={resumen}
          onVolver={() => navegar('/admin/cursos')}
          onNuevaComision={abrirModalComision}
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

          <Input
            id="dias_horarios"
            etiqueta="Días y Horarios"
            valor={campos.dias_horarios}
            onChange={cambiar('dias_horarios')}
            placeholder="Ej: Mar y Jue 19 a 21 hs"
            obligatorio
            error={errores.dias_horarios ?? null}
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

          <Campo id="sede" etiqueta="Sede" obligatorio={exigeSede} error={errores.sede ?? null}>
            <select id="sede" value={campos.sede} onChange={cambiar('sede')}>
              <option value="">Seleccionar…</option>
              {sedes.map((sede) => (
                <option key={sede.id} value={String(sede.id)}>
                  {sede.nombre}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        {fallo !== null && <MensajeFallo>{fallo}</MensajeFallo>}

        <p className="mt-4 text-xs text-slate-500">
          {docentes.length} docentes del padrón disponibles para asignar. El código de la comisión
          lo genera el sistema a partir del curso.
        </p>
      </Modal>
    </div>
  )
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
  onAbrir,
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
            />
          ))}
        </div>
      )}
    </Card>
  )
}

/**
 * La tarjeta de un curso.
 *
 * **Es un botón y no una `Card` con un botón adentro.** Un botón dentro de otro botón es HTML
 * inválido y rompe la navegación por teclado, y el pedido era que se pueda abrir el curso con un
 * click en cualquier punto de la tarjeta.
 */
function TarjetaCurso({ curso, total, onAbrir }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-slate-300 hover:shadow"
    >
      <span className="text-xs font-semibold tracking-wide text-slate-500">{curso.codigo}</span>
      <span className="text-sm font-semibold text-slate-800">{curso.nombre}</span>
      <span className="text-sm text-slate-500">{curso.descripcion ?? '—'}</span>
      <span className="text-xs text-slate-600">
        {total} {total === 1 ? 'comisión' : 'comisiones'}
      </span>
      <span className="text-sm font-medium text-blue-700">Abrir comisiones</span>
    </button>
  )
}

/** Vista de comisiones: la tabla del curso de la ruta, con el mismo formato de siempre. */
function VistaComisiones({ curso, comisiones, resumen, onVolver, onNuevaComision }) {
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
        </div>
      }
    >
      <BuscadorPendiente
        id="buscar-comision"
        etiqueta="Buscar comisión"
        placeholder="Buscar por código, docente u horario…"
      />

      <Table
        columnas={COLUMNAS}
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
