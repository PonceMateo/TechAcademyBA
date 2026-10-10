import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { Badge, Card, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { CATEGORIA_INSCRIPCION, ESTADO_HABILITACION } from '../domain/enums'
import { obtenerDetalleInscripcion } from '../services/dataService'
import { formatFechaCorta } from '../utils/formato'

/**
 * Detalle de curso y acceso a la clase (11.3).
 *
 * **El bloque de acceso tiene tres estados y el botón aparece en uno solo.** Habilitado con link
 * cargado muestra el botón de ingreso; habilitado sin link muestra un mensaje que dice que el
 * profesor todavía no lo publicó; bloqueado no muestra link ni botón, solo el estado con su causa.
 * El caso del medio no es un error de la pantalla: es lo que ve el alumno desde que se inscribe
 * hasta que el docente carga el link.
 *
 * **El cronograma y los próximos encuentros son de referencia** (P5). Tienen forma de fecha y tema
 * porque es lo que el alumno necesita ver, pero los carga la secretaría cuando el sistema esté
 * funcional, y la pantalla lo aclara en vez de dejarlo pasar como dato definitivo.
 *
 * **El link no se muestra a un alumno bloqueado ni por error.** El servicio devuelve el detalle con
 * el link resuelto y esta pantalla decide qué hacer con él: cuando el acceso está bloqueado, no lo
 * dibuja. El filtro está acá y no en el servicio a propósito, porque la regla es de la interfaz.
 */
const COLUMNAS_CRONOGRAMA = [
  { clave: 'inicio', titulo: 'INICIO', render: (fila) => formatFechaCorta(fila.inicio) },
  { clave: 'fin', titulo: 'FIN', render: (fila) => formatFechaCorta(fila.fin) },
]

const COLUMNAS_ENCUENTROS = [
  { clave: 'fecha', titulo: 'FECHA', render: (fila) => formatFechaCorta(fila.fecha) },
  { clave: 'tema', titulo: 'TEMA', render: (fila) => fila.tema },
]

const TEXTO_ACCESO_HABILITADO = 'Tu acceso a la clase está habilitado.'
const TEXTO_SIN_LINK =
  'El profesor todavía no publicó el link de la clase. Te avisamos apenas lo suba.'
const AVISO_REFERENCIA =
  'Cronograma y temas de referencia: la secretaría carga el calendario definitivo de cada comisión.'

function etiquetaCategoria(categoria, porcentajeBeca) {
  const nombres = {
    [CATEGORIA_INSCRIPCION.PARTICULAR]: 'Particular',
    [CATEGORIA_INSCRIPCION.BECADO_PARCIAL]: `Becado parcial ${porcentajeBeca}%`,
    [CATEGORIA_INSCRIPCION.BECADO_TOTAL]: 'Becado total',
    [CATEGORIA_INSCRIPCION.CORPORATIVO]: 'Corporativo',
  }

  return nombres[categoria] ?? categoria
}

export function CourseDetailPage() {
  const { codigo } = useParams()
  const [detalle, setDetalle] = useState(null)
  const [buscado, setBuscado] = useState(false)

  useEffect(() => {
    obtenerDetalleInscripcion(codigo).then((resultado) => {
      setDetalle(resultado)
      setBuscado(true)
    })
  }, [codigo])

  if (detalle === null) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">{codigo}</h2>
        <p className="text-sm text-slate-600">
          {buscado ? 'No estás inscripto en este curso.' : 'Buscando el curso que estás cursando…'}
        </p>
      </div>
    )
  }

  const { comision, acceso, link } = detalle
  const bloqueado = acceso.estado === ESTADO_HABILITACION.BLOQUEADO

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">
        {`${comision.nombre} · ${comision.codigo}`}
      </h2>

      <Card titulo="Información de la comisión">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Docente</dt>
            <dd className="text-sm text-slate-800">{`Docente · ${comision.docente_nombre}`}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Horario</dt>
            <dd className="text-sm text-slate-800">{comision.horario_prolongado}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Sede</dt>
            <dd className="text-sm text-slate-800">{comision.sede_nombre}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Categoría
            </dt>
            <dd className="text-sm text-slate-800">
              <Badge tono={TONO.VIOLETA}>
                {`Categoría: ${etiquetaCategoria(detalle.categoria, detalle.porcentaje_beca)}`}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <Card titulo="Acceso a la clase">
        {bloqueado ? (
          // Sin link y sin botón: el link se reparte solo a los habilitados.
          <div className="flex flex-col items-start gap-1">
            <Badge tono={TONO.ROJO}>BLOQUEADO</Badge>
            <p className="text-sm text-red-700">{`Causa: ${acceso.causa}`}</p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <Badge tono={TONO.VERDE}>HABILITADO</Badge>
            <p className="text-sm text-slate-700">{TEXTO_ACCESO_HABILITADO}</p>

            {link === null ? (
              <p className="text-sm text-amber-800">{TEXTO_SIN_LINK}</p>
            ) : (
              <a
                href={link}
                className="boton-primario foco-acento inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white transition"
              >
                Ingresar a la clase por Zoom
              </a>
            )}
          </div>
        )}
      </Card>

      <Card titulo="Cronograma">
        <Table
          columnas={COLUMNAS_CRONOGRAMA}
          filas={[detalle.cronograma]}
          claveDeFila={(fila) => fila.inicio}
        />
      </Card>

      <Card titulo="Próximos encuentros">
        <Table
          columnas={COLUMNAS_ENCUENTROS}
          filas={detalle.proximos_encuentros}
          claveDeFila={(fila) => fila.fecha}
        />

        <p className="mt-4 text-xs text-slate-500">{AVISO_REFERENCIA}</p>
      </Card>
    </div>
  )
}
