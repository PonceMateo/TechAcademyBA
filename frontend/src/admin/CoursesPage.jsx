import { useEffect, useState } from 'react'
import { Badge, Button, Campo, Card, Input, Modal, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { MODALIDAD } from '../domain/enums'
import {
  obtenerResumenCatalogo,
  listarComisiones,
  listarDocentes,
  listarSedes,
} from '../services/dataService'
import { formatMoneda } from '../utils/formato'

/**
 * Cursos y comisiones (9.3).
 *
 * **Sin edición y sin alta real.** El spec deja las dos cosas fuera de alcance: no hay control de
 * edición de curso ni de comisión, y el modal es una maqueta. Por eso el botón de guardar no
 * escribe en ningún lado: cierra el modal y avisa que el maquetado no guarda nada todavía (D14).
 *
 * **`Modalidad` y `Sede` no están en el prototipo y sí van** (historia #8). La `Sede` es obligatoria
 * solo para `Presencial` y `Híbrido`, que es el CHECK `modalidad_presencial_requiere_sede` del
 * modelo. La regla vive en el formulario y no en el botón: un botón deshabilitado taparía el
 * mensaje de error, y lo que el operador necesita ver es qué campo le falta.
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

const CAMPOS_VACIOS = {
  curso: '',
  codigo: '',
  docente: '',
  dias_horarios: '',
  cupo: '',
  arancel: '',
  modalidad: '',
  sede: '',
}

export function CoursesPage() {
  const [comisiones, setComisiones] = useState([])
  const [docentes, setDocentes] = useState([])
  const [sedes, setSedes] = useState([])
  const [resumen, setResumen] = useState({ total_comisiones: 0 })
  const [modalAbierto, setModalAbierto] = useState(false)
  const [campos, setCampos] = useState(CAMPOS_VACIOS)
  const [errores, setErrores] = useState({})
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    listarComisiones().then(setComisiones)
    listarDocentes().then(setDocentes)
    listarSedes().then(setSedes)
    obtenerResumenCatalogo().then(setResumen)
  }, [])

  const exigeSede =
    campos.modalidad === MODALIDAD.PRESENCIAL || campos.modalidad === MODALIDAD.HIBRIDO

  function cambiar(campo) {
    return (evento) => setCampos((anteriores) => ({ ...anteriores, [campo]: evento.target.value }))
  }

  function cerrarModal() {
    setModalAbierto(false)
    setCampos(CAMPOS_VACIOS)
    setErrores({})
  }

  function validar() {
    const encontrados = {}

    if (campos.curso === '') {
      encontrados.curso = 'Elegí el curso del programa.'
    }
    if (campos.codigo.trim() === '') {
      encontrados.codigo = 'El código de la comisión es obligatorio.'
    }
    if (campos.modalidad === '') {
      encontrados.modalidad = 'Elegí la modalidad de la comisión.'
    } else if (campos.sede === '' && exigeSede) {
      encontrados.sede = 'El campo Sede es obligatorio para modalidad Presencial o Híbrido.'
    }

    return encontrados
  }

  function guardar() {
    const encontrados = validar()
    setErrores(encontrados)

    if (Object.keys(encontrados).length > 0) {
      return
    }

    setAviso('El maquetado no guarda nada todavía: el alta de comisiones llega con la historia #2.')
    cerrarModal()
  }

  return (
    <div className="space-y-4">
      <Card
        titulo="Comisiones Activas"
        acciones={
          <div className="flex items-center gap-2">
            <Badge tono={TONO.CELESTE}>{`${resumen.total_comisiones} en el catálogo`}</Badge>
            <Button onClick={() => setModalAbierto(true)}>+ Nueva Comisión</Button>
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
        abierto={modalAbierto}
        titulo="Crear Nueva Comisión"
        onClose={cerrarModal}
        pie={
          <>
            <Button variante="secundario" onClick={cerrarModal}>
              Cancelar
            </Button>
            <Button onClick={guardar}>Guardar Comisión</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="curso" etiqueta="Curso / Programa" obligatorio error={errores.curso ?? null}>
            <select id="curso" value={campos.curso} onChange={cambiar('curso')}>
              <option value="">Seleccionar…</option>
              {comisiones.map((comision) => (
                <option key={comision.curso.codigo} value={comision.curso.codigo}>
                  {comision.curso.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Input
            id="codigo"
            etiqueta="Código Comisión"
            valor={campos.codigo}
            onChange={cambiar('codigo')}
            placeholder="Ej: CUR-111"
            obligatorio
            error={errores.codigo ?? null}
          />

          <Input
            id="docente"
            etiqueta="Docente Asignado"
            valor={campos.docente}
            onChange={cambiar('docente')}
            placeholder="Buscar docente…"
          />

          <Input
            id="dias_horarios"
            etiqueta="Días y Horarios"
            valor={campos.dias_horarios}
            onChange={cambiar('dias_horarios')}
            placeholder="Ej: Mar y Jue 19 a 21 hs"
          />

          <Input
            id="cupo"
            etiqueta="Cupo Máximo"
            type="number"
            valor={campos.cupo}
            onChange={cambiar('cupo')}
          />

          <Input
            id="arancel"
            etiqueta="Valor de Arancel de Comisión (AR$)"
            type="number"
            valor={campos.arancel}
            onChange={cambiar('arancel')}
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

        <p className="mt-4 text-xs text-slate-500">
          {docentes.length} docentes del padrón disponibles para asignar.
        </p>
      </Modal>
    </div>
  )
}
