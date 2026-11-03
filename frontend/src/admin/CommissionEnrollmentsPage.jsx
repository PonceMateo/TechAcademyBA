import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Badge, Button, Card, Modal, StatusIndicator, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { CATEGORIA_INSCRIPCION } from '../domain/enums'
import { formatDocumento } from '../utils/formato'
import {
  darDeBajaInscripcion,
  listarEmpresas,
  listarInscripcionesDeComision,
} from '../services/dataService'
import { CategoriaInscripcionModal } from './CategoriaInscripcionModal'
import { InscripcionModal } from './InscripcionModal'

/**
 * Gestión de los inscriptos de una comisión (HU 60).
 *
 * **Se entra desde la fila de la comisión** en el listado del curso. La pantalla muestra el curso y
 * la comisión, el cupo, los inscriptos activos y las vacantes que informa la fuente —se derivan de
 * las inscripciones `ACTIVA`, así que una baja libera el lugar—, la tabla de inscriptos y el
 * historial de bajas al final.
 *
 * **No calcula habilitación ni vacantes por su cuenta.** El estado de habilitación lo deriva el
 * backend con las reglas vigentes (D9) y las vacantes también vienen en la respuesta (D10). La
 * pantalla recarga después de cada alta, baja o cambio de categoría: lo que muestra es lo que la
 * fuente acaba de confirmar.
 *
 * **El alta reutiliza el formulario de las HU 14 y 15** con la comisión preseleccionada y bloqueada,
 * y la categoría se cambia con el formulario compartido, sobre esa inscripción y no sobre el alumno.
 */
export function CommissionEnrollmentsPage() {
  const { codigo, comisionId } = useParams()
  const navegar = useNavigate()

  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [modalInscripcion, setModalInscripcion] = useState(false)
  const [inscripcionCategoria, setInscripcionCategoria] = useState(null)
  const [inscripcionBaja, setInscripcionBaja] = useState(null)
  const [falloBaja, setFalloBaja] = useState(null)
  const [dandoDeBaja, setDandoDeBaja] = useState(false)
  const [empresas, setEmpresas] = useState([])
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true
    listarInscripcionesDeComision(comisionId)
      .then((resultado) => {
        if (vigente) {
          setDatos(resultado)
          setFallo(null)
        }
      })
      .catch((error) => {
        if (vigente) {
          setFallo(error?.message ?? 'No se pudo cargar la comisión.')
        }
      })
      .finally(() => {
        if (vigente) {
          setCargando(false)
        }
      })
    return () => {
      vigente = false
    }
  }, [comisionId, version])

  useEffect(() => {
    listarEmpresas()
      .then(setEmpresas)
      .catch(() => setEmpresas([]))
  }, [])

  function recargar() {
    setVersion((actual) => actual + 1)
  }

  function volver() {
    navegar(`/admin/cursos/${codigo}`)
  }

  function inscripcionCreada() {
    setModalInscripcion(false)
    setAviso('Alumno inscripto. La vacante quedó actualizada.')
    recargar()
  }

  function categoriaGuardada() {
    setInscripcionCategoria(null)
    setAviso('Categoría actualizada.')
    recargar()
  }

  async function confirmarBaja() {
    setDandoDeBaja(true)
    setFalloBaja(null)
    try {
      await darDeBajaInscripcion(inscripcionBaja.id, datos.comision.id)
      setInscripcionBaja(null)
      setAviso('Inscripción dada de baja. La vacante quedó liberada.')
      recargar()
    } catch (error) {
      // Un 409 significa que otra sesión ya la dio de baja: se muestra el motivo y se recarga.
      setFalloBaja(error?.message ?? 'No se pudo dar de baja la inscripción.')
      recargar()
    } finally {
      setDandoDeBaja(false)
    }
  }

  if (cargando && datos === null) {
    return (
      <Card titulo="Comisión">
        <p className="text-sm text-slate-500">Cargando los inscriptos…</p>
      </Card>
    )
  }

  if (fallo !== null && datos === null) {
    return (
      <Card
        titulo="Comisión no encontrada"
        acciones={
          <Button variante="secundario" onClick={volver}>
            Volver a las comisiones
          </Button>
        }
      >
        <p role="alert" className="text-sm text-red-700">
          {fallo}
        </p>
      </Card>
    )
  }

  const columnas = [
    {
      clave: 'alumno',
      titulo: 'ALUMNO',
      render: (fila) => <span className="font-medium">{fila.alumno.nombre}</span>,
    },
    {
      clave: 'documento',
      titulo: 'DNI',
      render: (fila) =>
        fila.alumno.documento ? formatDocumento(fila.alumno.documento) : 'Sin DNI',
    },
    { clave: 'categoria', titulo: 'CATEGORÍA', render: (fila) => etiquetaCategoria(fila) },
    {
      clave: 'habilitacion',
      titulo: 'HABILITACIÓN',
      render: (fila) =>
        fila.estado === 'ACTIVA' && fila.acceso !== null ? (
          <StatusIndicator
            estado={fila.acceso.estado}
            causa={fila.acceso.causa}
            forzado={fila.acceso.forzado}
          />
        ) : (
          <Badge tono={TONO.GRIS}>{fila.estado}</Badge>
        ),
    },
    {
      clave: 'acciones',
      titulo: 'ACCIONES',
      render: (fila) =>
        fila.estado === 'ACTIVA' ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variante="secundario"
              tamano="chico"
              onClick={() => setInscripcionCategoria(fila)}
            >
              Cambiar categoría
            </Button>
            <Button
              variante="secundario"
              tamano="chico"
              onClick={() => {
                setFalloBaja(null)
                setInscripcionBaja(fila)
              }}
            >
              Dar de baja
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <div className="space-y-4">
      <Card
        titulo={`Comisión ${datos.comision.codigo}`}
        descripcion={datos.comision.nombre_curso}
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            <Button variante="secundario" onClick={volver}>
              Volver a las comisiones
            </Button>
            <Button onClick={() => setModalInscripcion(true)}>Inscribir alumno</Button>
          </div>
        }
      >
        <dl className="mb-4 grid gap-3 sm:grid-cols-3">
          <Contador etiqueta="Cupo máximo" valor={datos.comision.cupo_maximo} />
          <Contador etiqueta="Inscriptos activos" valor={datos.comision.inscriptos_activos} />
          <Contador etiqueta="Vacantes" valor={datos.comision.vacantes} />
        </dl>

        {fallo !== null && (
          <p
            role="alert"
            className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {fallo}
          </p>
        )}

        <Table
          columnas={columnas}
          filas={datos.inscripciones}
          vacio={
            <p className="text-sm text-slate-500">
              Esta comisión todavía no tiene inscriptos. Usá «Inscribir alumno» para agregar el
              primero.
            </p>
          }
        />
      </Card>

      {aviso !== null && (
        <p
          role="status"
          className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
        >
          {aviso}
        </p>
      )}

      {modalInscripcion && (
        <InscripcionModal
          abierto
          comisionId={datos.comision.id}
          etiquetaComision={`${datos.comision.codigo} · ${datos.comision.nombre_curso}`}
          onClose={() => setModalInscripcion(false)}
          onInscripto={inscripcionCreada}
        />
      )}

      {inscripcionCategoria !== null && (
        <CategoriaInscripcionModal
          inscripcion={{
            ...inscripcionCategoria,
            comision: {
              codigo: datos.comision.codigo,
              nombre: datos.comision.nombre_curso,
            },
          }}
          empresas={empresas}
          onClose={() => setInscripcionCategoria(null)}
          onGuardado={categoriaGuardada}
        />
      )}

      <Modal
        abierto={inscripcionBaja !== null}
        titulo="Dar de baja la inscripción"
        onClose={() => setInscripcionBaja(null)}
        pie={
          <>
            <Button variante="secundario" onClick={() => setInscripcionBaja(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarBaja} disabled={dandoDeBaja}>
              {dandoDeBaja ? 'Dando de baja…' : 'Dar de baja'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            {inscripcionBaja !== null
              ? `Se va a dar de baja únicamente la inscripción de ${inscripcionBaja.alumno.nombre} en ${datos.comision.codigo}.`
              : ''}
          </p>
          <p>
            El alumno sigue en el padrón, su historial se conserva y los pagos, imputaciones y
            comprobantes asociados no se eliminan.
          </p>
          {falloBaja !== null && (
            <p role="alert" className="text-red-700">
              {falloBaja}
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}

/** Un contador del encabezado: rótulo en gris y valor grande. */
function Contador({ etiqueta, valor }) {
  return (
    <div className="rounded-lg border border-slate-200 px-4 py-3">
      <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{etiqueta}</dt>
      <dd className="text-lg font-semibold text-slate-800">{valor}</dd>
    </div>
  )
}

const TONOS_CATEGORIA = {
  [CATEGORIA_INSCRIPCION.PARTICULAR]: { etiqueta: 'Particular', tono: TONO.GRIS },
  [CATEGORIA_INSCRIPCION.BECADO_PARCIAL]: { etiqueta: 'Becado parcial', tono: TONO.VIOLETA },
  [CATEGORIA_INSCRIPCION.BECADO_TOTAL]: { etiqueta: 'Becado total', tono: TONO.MAGENTA },
  [CATEGORIA_INSCRIPCION.CORPORATIVO]: { etiqueta: 'Corporativo', tono: TONO.CELESTE },
}

/** La categoría con su color y, en la beca parcial, su porcentaje. */
function etiquetaCategoria(fila) {
  const definicion = TONOS_CATEGORIA[fila.categoria] ?? {
    etiqueta: fila.categoria,
    tono: TONO.GRIS,
  }
  const conPorcentaje =
    fila.categoria === CATEGORIA_INSCRIPCION.BECADO_PARCIAL && fila.porcentaje_beca !== null
      ? ` ${Number(fila.porcentaje_beca)}%`
      : ''
  return (
    <Badge tono={definicion.tono}>
      {`${definicion.etiqueta}${conPorcentaje}`}
      {fila.empresa_nombre ? ` · ${fila.empresa_nombre}` : ''}
    </Badge>
  )
}
