import { useEffect, useState } from 'react'
import { Badge, Button, Campo, Card, Input, Modal, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { MODALIDAD } from '../domain/enums'
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
 * Cursos y comisiones (9.3).
 *
 * **Las dos altas escriben contra la base** desde el change `altas-catalogo-docentes`. El modal
 * de comisión ya no pide el código: lo genera el sistema a partir del curso (D34), así que el
 * formulario lo quita y muestra el que devuelve la API. El de curso es nuevo y pide solo el
 * nombre: el código lo genera la base (D32) y se muestra después de confirmar.
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

export function CoursesPage() {
  const [comisiones, setComisiones] = useState([])
  const [cursos, setCursos] = useState([])
  const [docentes, setDocentes] = useState([])
  const [sedes, setSedes] = useState([])
  const [resumen, setResumen] = useState({ total_comisiones: 0 })
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
    listarCursos().then(setCursos)
    listarDocentes().then(setDocentes)
    listarSedes().then(setSedes)
    obtenerResumenCatalogo().then(setResumen)
  }, [])

  const exigeSede =
    campos.modalidad === MODALIDAD.PRESENCIAL || campos.modalidad === MODALIDAD.HIBRIDO

  function cambiar(campo) {
    return (evento) => setCampos((anteriores) => ({ ...anteriores, [campo]: evento.target.value }))
  }

  function cambiarCurso(campo) {
    return (evento) =>
      setCamposCurso((anteriores) => ({ ...anteriores, [campo]: evento.target.value }))
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
        // espera un entero. El selector ofrece el código para que se lea, pero manda el id (D34).
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

  return (
    <div className="space-y-4">
      <Card
        titulo="Comisiones Activas"
        acciones={
          <div className="flex items-center gap-2">
            <Badge tono={TONO.CELESTE}>{`${resumen.total_comisiones} en el catálogo`}</Badge>
            <Button variante="secundario" onClick={() => setModalCurso(true)}>
              + Nuevo Curso
            </Button>
            <Button onClick={() => setModalComision(true)}>+ Nueva Comisión</Button>
          </div>
        }
      >
        <Table columnas={COLUMNAS} filas={comisiones} />
      </Card>

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
            <select id="curso" value={campos.curso} onChange={cambiar('curso')}>
              <option value="">Seleccionar…</option>
              {cursos.map((curso) => (
                <option key={curso.codigo} value={curso.id}>
                  {curso.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo id="docente" etiqueta="Docente Asignado" obligatorio error={errores.docente ?? null}>
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
