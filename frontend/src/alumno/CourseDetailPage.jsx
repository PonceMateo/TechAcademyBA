import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { Badge, Card, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { resumenHorarios } from '../domain/horarios'
import { CATEGORIA_INSCRIPCION, ESTADO_HABILITACION } from '../domain/enums'
import { obtenerDetalleInscripcion } from '../services/dataService'
import { formatFechaCorta } from '../utils/formato'

/**
 * Detalle de la cursada y acceso a la clase (HU 38).
 *
 * **Todo sale de `GET /alumno/inscripciones/{codigo}`.** El cronograma es el período real de la
 * comisión desde la historia #49: las dos fechas las carga la secretaría (D62), y la de fin solo se
 * informa como no definida en la comisión heredada, que todavía no la tiene, porque inventar una
 * fecha de cierre es peor que decir que falta. Los encuentros se derivan de los días y horarios
 * reales desde el día corriente y se cortan en la fecha de fin, así que una cursada terminada no
 * muestra ninguno; cada fila trae la hora de ese día, y el tema sale de la clase cargada y, sin
 * clase, la celda queda vacía: no existe ningún "tema a confirmar" que mostrar.
 *
 * **El bloque de acceso cubre dos de los tres estados del spec.** Habilitado y bloqueado; el
 * habilitado con link cargado todavía no existe, porque el contrato del alumno no incluye el link
 * de la clase hasta la historia #39. Mientras tanto se renderiza el estado habilitado sin link con
 * el aviso de que el profesor todavía no lo publicó, y **no hay ningún botón de ingreso**: no hay
 * link que abrir.
 *
 * **Una comisión ajena y un código inexistente se ven igual.** El backend responde el mismo `404`
 * para los dos casos y la pantalla lo único que puede decir es que no encontró esa cursada; no
 * muestra ningún dato de la comisión.
 */

const TEXTO_ACCESO_HABILITADO = 'Tu acceso a la clase está habilitado.'
const TEXTO_SIN_LINK =
  'El profesor todavía no publicó el link de la clase. Te avisamos apenas lo suba.'

const COLUMNAS_ENCUENTROS = [
  { clave: 'fecha', titulo: 'FECHA', render: (fila) => formatFechaCorta(fila.fecha) },
  { clave: 'horario', titulo: 'HORARIO', render: (fila) => fila.horario ?? '—' },
  { clave: 'tema', titulo: 'TEMA', render: (fila) => fila.tema ?? '—' },
]
const FIN_SIN_DEFINIR = 'Todavía no está definida'

/**
 * La fecha de hoy en `AAAA-MM-DD`, para compararla con las del contrato como texto.
 *
 * Es el único lugar de la pantalla que mira el calendario del navegador: el resto de las fechas
 * llegan como cadenas del contrato y se comparan entre sí, sin pasar por `Date` (formato.js).
 * Se compara con el día del alumno porque es su pantalla la que decide si la cursada ya terminó.
 */
function fechaDeHoy() {
  const hoy = new Date()
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  const dia = String(hoy.getDate()).padStart(2, '0')
  return `${hoy.getFullYear()}-${mes}-${dia}`
}
const NO_ENCONTRADA = 'No encontré esa cursada entre tus inscripciones.'
const BUSCANDO = 'Buscando la cursada…'

function etiquetaCategoria(categoria, porcentajeBeca) {
  const nombres = {
    [CATEGORIA_INSCRIPCION.PARTICULAR]: 'Particular',
    [CATEGORIA_INSCRIPCION.BECADO_PARCIAL]: `Becado parcial ${porcentajeBeca}%`,
    [CATEGORIA_INSCRIPCION.BECADO_TOTAL]: 'Becado total',
    [CATEGORIA_INSCRIPCION.CORPORATIVO]: 'Corporativo',
  }

  return nombres[categoria] ?? categoria
}

/** Los días y horarios como chips, con el texto de la comisión como respaldo. */
function Horarios({ horarios, texto }) {
  const grupos = resumenHorarios(horarios)

  if (grupos.length === 0) {
    return <span className="text-sm text-slate-800">{texto}</span>
  }

  return (
    <span className="flex flex-wrap gap-1">
      {grupos.map((grupo) => (
        <Badge key={grupo} tono={TONO.GRIS}>
          {grupo}
        </Badge>
      ))}
    </span>
  )
}

/**
 * El detalle de una cursada, montado por código.
 *
 * La `key` es el código: al abrir otra cursada el componente se monta de nuevo y su estado arranca
 * en "buscando". Sin eso, el detalle de la comisión anterior seguiría en pantalla mientras llega la
 * nueva, que es mostrar un dato que ya no corresponde.
 */
function DetalleCursada({ codigo }) {
  const [detalle, setDetalle] = useState(null)
  const [buscado, setBuscado] = useState(false)

  useEffect(() => {
    let vigente = true

    obtenerDetalleInscripcion(codigo)
      .then((resultado) => {
        if (vigente) {
          setDetalle(resultado)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (vigente) {
          setBuscado(true)
        }
      })

    return () => {
      vigente = false
    }
  }, [codigo])

  if (detalle === null) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">{codigo}</h2>
        <Card>
          <p className={buscado ? 'text-sm text-red-700' : 'text-sm text-slate-600'}>
            {buscado ? NO_ENCONTRADA : BUSCANDO}
          </p>
        </Card>
      </div>
    )
  }

  const { comision, acceso, cronograma, proximos_encuentros: encuentros } = detalle
  const bloqueado = acceso.estado === ESTADO_HABILITACION.BLOQUEADO
  // Sin encuentros hay dos causas distintas y el mensaje no puede ser el mismo: la comisión
  // todavía no tiene días de cursada cargados, o la cursada ya terminó y el período lo dice
  // (historia #49). Se compara contra el día del alumno, con el fin incluido.
  const cursadaTerminada = cronograma.fin != null && cronograma.fin <= fechaDeHoy()

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">
          {`${comision.nombre} · ${comision.codigo}`}
        </h2>
      </header>

      <Card titulo="Información de la comisión">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Docente</dt>
            <dd className="text-sm text-slate-800">
              {`Docente · ${comision.docente_nombre ?? 'a confirmar'}`}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Días y horarios
            </dt>
            <dd className="mt-1">
              <Horarios horarios={comision.horarios} texto={comision.horario} />
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Categoría
            </dt>
            <dd className="mt-1">
              <Badge tono={TONO.DORADO}>
                {`Categoría: ${etiquetaCategoria(detalle.categoria, detalle.porcentaje_beca)}`}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <Card titulo="Acceso a la clase">
        {bloqueado ? (
          // Sin link y sin botón: el bloqueo no ofrece ninguna forma de entrar.
          <div className="flex flex-col items-start gap-1">
            <Badge tono={TONO.ROJO}>BLOQUEADO</Badge>
            <p className="text-sm text-red-700">{`Causa: ${acceso.causa}`}</p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <Badge tono={TONO.VERDE}>HABILITADO</Badge>
            <p className="text-sm text-slate-700">{TEXTO_ACCESO_HABILITADO}</p>
            <p className="text-sm text-amber-800">{TEXTO_SIN_LINK}</p>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card titulo="Cronograma">
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Inicio</dt>
              <dd className="text-sm text-slate-800">
                {cronograma.inicio ? formatFechaCorta(cronograma.inicio) : FIN_SIN_DEFINIR}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Fin</dt>
              <dd className="text-sm text-slate-800">
                {cronograma.fin ? formatFechaCorta(cronograma.fin) : FIN_SIN_DEFINIR}
              </dd>
            </div>
          </dl>
        </Card>

        <Card titulo="Próximos encuentros">
          {encuentros.length === 0 ? (
            <p className="text-sm text-slate-500">
              {cursadaTerminada
                ? `La cursada terminó el ${formatFechaCorta(cronograma.fin)}.`
                : 'La comisión todavía no tiene días de cursada cargados.'}
            </p>
          ) : (
            <Table
              columnas={COLUMNAS_ENCUENTROS}
              filas={encuentros}
              claveDeFila={(fila) => fila.fecha}
            />
          )}
        </Card>
      </div>
    </div>
  )
}

export function CourseDetailPage() {
  const { codigo } = useParams()

  return <DetalleCursada key={codigo} codigo={codigo} />
}
