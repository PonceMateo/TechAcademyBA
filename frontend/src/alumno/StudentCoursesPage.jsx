import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useSession } from '../auth/SessionContext'
import { Badge, Card } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { CATEGORIA_INSCRIPCION, ESTADO_HABILITACION } from '../domain/enums'
import { listarInscripcionesAlumno, obtenerDetalleInscripcion } from '../services/dataService'
import { formatFechaLarga, formatFechaCorta } from '../utils/formato'

/**
 * Tablero del alumno (11.2), con la composición del diseño
 * (`docs/design/figma-dashboards-overhaul/`).
 *
 * **Una tarjeta por inscripción y ni una más.** El maqueteado tiene una sola inscripción en los datos
 * del cliente: agregar una segunda para ilustrar el caso bloqueado sería inventar un curso que el
 * alumno no tiene. El estado bloqueado se alcanza forzando el bloqueo de esta misma inscripción, que
 * es lo que hace la secretaría cuando el comprobante no se puede leer.
 *
 * **El bloqueo muestra la causa y ofrece el camino a `Mis Pagos`.** El prototipo no muestra ni una
 * cosa ni la otra, y las dos son la historia que hay dentro del alcance mínimo: un alumno bloqueado
 * que ve `Bloqueado` sin saber por qué ni qué hacer no puede resolverlo.
 *
 * **La categoría arancelaria es el mismo dato que muestra el padrón de la secretaría.** Los cuatro
 * valores del enum con su color viven en `paleta.js`, no en esta pantalla: si el color fuera de acá,
 * `Becado parcial` sería violeta en una pantalla y gris en otra.
 *
 * **El tablero conserva su forma y no colapsa a su estado vacío.** La fila de cuatro tarjetas y
 * `Tu agenda` se pintan siempre; la sección `Mis Cursos` conserva su mensaje cuando el alumno no
 * tiene inscripciones, sin eliminar ninguna tarjeta (D43).
 *
 * **Los indicadores salen de los datos reales.** `CURSOS EN MARCHA` cuenta las inscripciones y su
 * apoyo las nombra; `PRÓXIMA CLASE` sale del cronograma real de la inscripción; y `ACCESO A LA CLASE`
 * refleja el estado de la inscripción, que es un campo existente y no un agregado. La tarjeta
 * `COMPROBANTES ACREDITADOS` vuelve con el valor `—` porque no hay endpoint de pagos que respalde su
 * valor, y el diseño trae `68 %` de progreso, `3` tareas y `96 %` de asistencia, que tampoco tienen
 * datos detrás (D43).
 *
 * **Mientras la lectura no resuelve o rechaza, el valor dependiente es `—`.** El dato `inscripciones`
 * arranca en `null` y queda en `null` en el rechazo, así que la pantalla distingue "no lo sé" de un
 * `0` real (cuando la lectura resuelve sin inscripciones) y nunca pinta un `0` que la fuente no
 * respalde.
 *
 * **El pie de la tarjeta de agenda aclara qué son los encuentros.** Son contenido de referencia
 * (P5) hasta que la secretaría cargue el cronograma definitivo, y la pantalla lo dice.
 */

/** Los dos ítems de agenda son de referencia, igual que en el detalle del curso (P5). */
const AVISO_REFERENCIA = 'Encuentros de referencia: la secretaría carga el calendario definitivo.'

const TONOS_CATEGORIA = {
  [CATEGORIA_INSCRIPCION.PARTICULAR]: { etiqueta: 'Particular', tono: TONO.GRIS },
  [CATEGORIA_INSCRIPCION.BECADO_PARCIAL]: { etiqueta: 'Becado parcial', tono: TONO.VIOLETA },
  [CATEGORIA_INSCRIPCION.BECADO_TOTAL]: { etiqueta: 'Becado total', tono: TONO.MAGENTA },
  [CATEGORIA_INSCRIPCION.CORPORATIVO]: { etiqueta: 'Corporativo', tono: TONO.CELESTE },
}

const SIN_INSCRIPCIONES = 'No tenés cursos activos en este período lectivo.'

function etiquetaCategoria(categoria, porcentajeBeca) {
  const definicion = TONOS_CATEGORIA[categoria] ?? { etiqueta: categoria, tono: TONO.GRIS }
  const conPorcentaje =
    definicion.etiqueta === 'Becado parcial' && porcentajeBeca !== null ? ` ${porcentajeBeca}%` : ''

  return `${definicion.etiqueta}${conPorcentaje}`
}

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

export function StudentCoursesPage() {
  const { session } = useSession()
  const [inscripciones, setInscripciones] = useState(null)
  const [agenda, setAgenda] = useState([])

  useEffect(() => {
    listarInscripcionesAlumno()
      .then(async (resultado) => {
        setInscripciones(resultado)

        // La agenda de la columna derecha son los próximos encuentros de las inscripciones que el
        // alumno ya tiene, por el mismo servicio que usa el detalle del curso. Cada encuentro lleva
        // el curso al que pertenece para que `PRÓXIMA CLASE` lo pueda nombrar.
        const detalles = await Promise.all(
          resultado.map((inscripcion) => obtenerDetalleInscripcion(inscripcion.codigo)),
        )
        setAgenda(
          resultado.flatMap((inscripcion, indice) =>
            (detalles[indice]?.proximos_encuentros ?? []).map((encuentro) => ({
              ...encuentro,
              nombre_curso: inscripcion.nombre_curso,
            })),
          ),
        )
      })
      // El rechazo deja `inscripciones` en `null`: la pantalla no sabe cuántas hay y pinta `—`.
      .catch(() => setAgenda([]))
  }, [])

  const primera = inscripciones?.[0]
  const bloqueado = primera?.acceso.estado === ESTADO_HABILITACION.BLOQUEADO
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
            primera
              ? bloqueado
                ? `Causa: ${primera.acceso.causa}`
                : 'Tu inscripción está habilitada en el período.'
              : ''
          }
        >
          {primera ? (
            <Badge tono={bloqueado ? TONO.ROJO : TONO.VERDE}>
              {bloqueado ? 'BLOQUEADO' : 'HABILITADO'}
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

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid gap-4 lg:grid-cols-2">
          {!inscripciones?.length && (
            <Card titulo="Mis Cursos">
              <p className="text-sm text-slate-600">{SIN_INSCRIPCIONES}</p>
            </Card>
          )}

          {(inscripciones ?? []).map((inscripcion) => {
            const estaBloqueada = inscripcion.acceso.estado === ESTADO_HABILITACION.BLOQUEADO
            const tono = estaBloqueada ? TONO.ROJO : TONO.VERDE
            const estado = estaBloqueada ? 'Bloqueado' : 'Habilitado'

            return (
              <Card key={inscripcion.codigo}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tono={TONO.GRIS}>{inscripcion.codigo}</Badge>
                  <Badge tono={tono}>{estado}</Badge>
                </div>

                <h2 className="mt-3 text-lg font-semibold text-slate-900">
                  {inscripcion.nombre_curso}
                </h2>

                <p className="mt-3 text-sm text-slate-600">
                  {`Docente · ${inscripcion.docente_nombre}`}
                </p>
                <p className="text-sm text-slate-600">{inscripcion.horario}</p>
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <span>Categoría</span>
                  <Badge tono={TONOS_CATEGORIA[inscripcion.categoria]?.tono ?? TONO.GRIS}>
                    {etiquetaCategoria(inscripcion.categoria, inscripcion.porcentaje_beca)}
                  </Badge>
                </p>

                {/* El banner es el estado de acceso, grande y con su causa. Es un estado del componente
                    y no una segunda tarjeta: el alumno tiene un curso, no dos. */}
                <div
                  className={`mt-4 rounded-xl px-4 py-3 ${estaBloqueada ? 'bg-red-50' : 'bg-green-50'}`}
                >
                  <p
                    className={`text-lg font-semibold ${
                      estaBloqueada ? 'text-red-800' : 'text-green-800'
                    }`}
                  >
                    {estado}
                  </p>
                  {estaBloqueada && (
                    <p className="mt-1 text-sm">
                      {`Causa: ${inscripcion.acceso.causa}`}
                      <Link to="/alumno/pagos" className="foco-acento ml-2 rounded font-medium underline">
                        Ir a Mis Pagos
                      </Link>
                    </p>
                  )}
                </div>

                <div className="mt-4">
                  <Link
                    to={`/alumno/cursos/${inscripcion.codigo}`}
                    className="boton-primario foco-acento inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white transition"
                  >
                    Ver detalle
                  </Link>
                </div>
              </Card>
            )
          })}
        </div>

        <Card titulo="Tu agenda">
          {agenda.length === 0 ? (
            <p className="text-sm text-slate-500">No tenés encuentros programados por ahora.</p>
          ) : (
            <>
              <ul className="space-y-3">
                {agenda.map((encuentro) => (
                  <li key={encuentro.fecha} className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">
                      {formatFechaCorta(encuentro.fecha)}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">{encuentro.tema}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-slate-500">{AVISO_REFERENCIA}</p>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
