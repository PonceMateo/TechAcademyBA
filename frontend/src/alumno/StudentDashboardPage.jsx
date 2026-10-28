import { useEffect, useState } from 'react'
import { useSession } from '../auth/SessionContext'
import { Badge, Card } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { ESTADO_HABILITACION } from '../domain/enums'
import { listarInscripcionesAlumno, obtenerDetalleInscripcion } from '../services/dataService'
import { formatFechaLarga, formatFechaCorta } from '../utils/formato'

/**
 * Dashboard del alumno (11.2), con la composición del diseño
 * (`docs/design/figma-dashboards-overhaul/`) y los datos reales de `GET /alumno/inscripciones`
 * (HUs 38 y 42).
 *
 * **La raíz es el tablero y nada más.** Los cuatro indicadores y la agenda viven acá; las tarjetas
 * de las cursadas se mudaron a `Mis Cursos` (`/alumno/cursos`), que es una pantalla propia del
 * panel lateral. El tablero no lista inscripciones: resume el estado del alumno y le muestra su
 * próxima clase.
 *
 * **La pantalla distingue "no lo sé" de "no hay".** `inscripciones` arranca en `null` y sigue en
 * `null` si la consulta falla, así que el mensaje de que el alumno no tiene cursos **solo** aparece
 * cuando la fuente confirmó una lista vacía. Mientras carga se dice que está cargando, y si la
 * consulta falla se dice eso: hace unos commits la pantalla mostraba "no tenés cursos" en los tres
 * casos, que es afirmar algo que nadie verificó.
 *
 * **Los indicadores salen de los datos reales.** `CURSOS EN MARCHA` cuenta las inscripciones,
 * `PRÓXIMA CLASE` sale del cronograma derivado de los horarios y `ACCESO A LA CLASE` del estado de
 * la inscripción. `COMPROBANTES ACREDITADOS` sigue en `—` porque los pagos del alumno son la HU 40 y
 * ninguna fuente respalda su valor (D43).
 *
 * **La agenda muestra la hora y el tema solo cuando existe.** Cada encuentro trae el horario de su
 * día desde la grilla de la comisión; un encuentro sin clase cargada no lleva tema y la fila no
 * completa nada en su lugar: no existe un "tema a confirmar".
 */

const NO_SE_PUDO_LEER = 'No pudimos cargar tus cursos. Volvé a intentar en un momento.'
const SIN_ENCUENTROS = 'No tenés encuentros programados por ahora.'

/** Tarjeta de indicador del tablero: rótulo arriba, valor grande y una línea de apoyo. */
function Indicador({ rotulo, children, apoyo }) {
  return (
    <Card>
      <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{rotulo}</p>
      <div className="mt-2 text-3xl font-extrabold text-slate-900">{children}</div>
      <p className="mt-1 text-xs text-slate-500">{apoyo}</p>
    </Card>
  )
}

/** Un encuentro de la agenda: fecha con su hora, el curso y el tema si ya está cargado. */
function FilaAgenda({ encuentro }) {
  return (
    <li className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-sm font-semibold text-slate-800">
        {formatFechaCorta(encuentro.fecha)}
        {encuentro.horario ? ` · ${encuentro.horario}` : ''}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{encuentro.nombre_curso}</p>
      {encuentro.tema ? (
        <p className="mt-0.5 text-sm text-slate-600">{encuentro.tema}</p>
      ) : null}
    </li>
  )
}

export function StudentDashboardPage() {
  const { session } = useSession()
  const [inscripciones, setInscripciones] = useState(null)
  const [fallo, setFallo] = useState(false)
  const [agenda, setAgenda] = useState([])

  useEffect(() => {
    listarInscripcionesAlumno()
      .then(async (resultado) => {
        setInscripciones(resultado)

        // La agenda son los próximos encuentros de las inscripciones que el alumno ya tiene, por el
        // mismo servicio que usa el detalle del curso. Cada encuentro lleva el curso al que
        // pertenece para que `PRÓXIMA CLASE` lo pueda nombrar y para que la clave de la lista no se
        // repita cuando dos cursos caen el mismo día.
        //
        // **`allSettled` y no `all`:** si el detalle de una de las cursadas falla —una comisión que
        // se desactivó entre las dos llamadas, por ejemplo— la agenda de las otras sigue en pie.
        // Con `all` un solo rechazo borraba toda la agenda y la pantalla terminaba diciendo que no
        // pudo cargar los cursos mientras los indicadores ya tenían datos.
        const detalles = await Promise.allSettled(
          resultado.map((inscripcion) => obtenerDetalleInscripcion(inscripcion.codigo)),
        )
        setAgenda(
          resultado
            .flatMap((inscripcion, indice) => {
              const detalle = detalles[indice]
              const encuentros =
                detalle.status === 'fulfilled' ? (detalle.value?.proximos_encuentros ?? []) : []
              return encuentros.map((encuentro) => ({
                ...encuentro,
                codigo: inscripcion.codigo,
                nombre_curso: inscripcion.nombre_curso,
              }))
            })
            // **La agenda es una sola línea de tiempo.** Los encuentros llegan agrupados por
            // inscripción, así que sin ordenar aparecían fechas de un curso después de las de otro
            // y `PRÓXIMA CLASE` tomaba la primera fila del primer curso, que no siempre es la más
            // cercana de todas las cursadas.
            .sort((izquierda, derecha) =>
              String(izquierda.fecha).localeCompare(String(derecha.fecha)),
            ),
        )
      })
      .catch(() => {
        // El rechazo deja `inscripciones` en `null`: la pantalla no sabe cuántas hay, no afirma que
        // sean cero y lo dice en lugar de mostrar el mensaje de "no tenés cursos".
        setFallo(true)
        setAgenda([])
      })
  }, [])

  // El indicador refleja el **peor** estado entre las cursadas, no el de la primera fila: el orden
  // de la respuesta lo decide la base y con estados mezclados —una habilitada y otra bloqueada—
  // mostrar el primero podía decir `HABILITADO` mientras otra cursada está bloqueada.
  const bloqueada =
    inscripciones?.find(
      (inscripcion) => inscripcion.acceso.estado === ESTADO_HABILITACION.BLOQUEADO,
    ) ?? null
  const hayInscripciones = Boolean(inscripciones?.length)
  const proxima = agenda[0]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          {`Buen día, ${session.nombre}`}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {`${formatFechaLarga()} · Cada paso cuenta. Este es tu espacio para avanzar.`}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="CURSOS EN MARCHA"
          apoyo={(inscripciones ?? [])
            .map((inscripcion) => `${inscripcion.codigo} · ${inscripcion.nombre_curso}`)
            .join(', ')}
        >
          {inscripciones === null ? '—' : inscripciones.length}
        </Indicador>

        <Indicador
          rotulo="ACCESO A LA CLASE"
          apoyo={
            hayInscripciones
              ? bloqueada
                ? `Causa: ${bloqueada.acceso.causa}`
                : 'Tu inscripción está habilitada en el período.'
              : ''
          }
        >
          {hayInscripciones ? (
            <Badge tono={bloqueada ? TONO.ROJO : TONO.VERDE}>
              {bloqueada ? 'BLOQUEADO' : 'HABILITADO'}
            </Badge>
          ) : (
            '—'
          )}
        </Indicador>

        <Indicador rotulo="COMPROBANTES ACREDITADOS">—</Indicador>

        <Indicador rotulo="PRÓXIMA CLASE" apoyo={proxima ? proxima.nombre_curso : ''}>
          {proxima ? (
            <span className="text-2xl">{formatFechaCorta(proxima.fecha)}</span>
          ) : (
            '—'
          )}
        </Indicador>
      </div>

      <Card titulo="Tu agenda">
        {fallo ? (
          <p className="text-sm text-red-700">{NO_SE_PUDO_LEER}</p>
        ) : agenda.length === 0 ? (
          <p className="text-sm text-slate-500">{SIN_ENCUENTROS}</p>
        ) : (
          <ul className="space-y-3">
            {agenda.map((encuentro) => (
              <FilaAgenda
                key={`${encuentro.codigo}-${encuentro.fecha}`}
                encuentro={encuentro}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
