import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useSession } from '../auth/SessionContext'
import { Badge, Card } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { CATEGORIA_INSCRIPCION, ESTADO_HABILITACION } from '../domain/enums'
import { listarInscripcionesAlumno, obtenerDetalleInscripcion } from '../services/dataService'
import { formatFechaCorta } from '../utils/formato'

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
 * **Sin inscripciones no hay una lista vacía, hay un mensaje.** El spec pide que el alumno sin
 * cursos vea que no tiene cursos activos, y en ese caso tampoco hay tablero: no se muestra una fila
 * de indicadores con valores de un maquetado que ese alumno no tiene.
 *
 * **Los indicadores y la agenda salen del maquetado.** Los valores de `CURSOS EN MARCHA`,
 * `COMPROBANTES ACREDITADOS` y `PRÓXIMA CLASE` son los del ejemplo y no se calculan; el de
 * `ACCESO A LA CLASE` refleja el estado de la inscripción, que es un campo existente y no un
 * agregado. El diseño trae `68 %` de progreso, `3` tareas y `96 %` de asistencia, y ninguno de los
 * tres tiene datos detrás: no se construyen (D40). Las fechas del encabezado y de la agenda son
 * literales placeholders.
 *
 * **El pie de la tarjeta de agenda aclara qué son los encuentros.** Son contenido de referencia
 * (P5) hasta que la secretaría cargue el cronograma definitivo, y la pantalla lo dice.
 */

/** Línea de fecha del encabezado: literal del maquetado (D40). */
const RESUMEN = 'Viernes 9 de octubre · Cada paso cuenta. Este es tu espacio para avanzar.'

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
  const [inscripciones, setInscripciones] = useState([])
  const [agenda, setAgenda] = useState([])
  const [cargadas, setCargadas] = useState(false)

  useEffect(() => {
    listarInscripcionesAlumno().then(async (resultado) => {
      setInscripciones(resultado)

      // La agenda de la columna derecha son los próximos encuentros de las inscripciones que el
      // alumno ya tiene, por el mismo servicio que usa el detalle del curso.
      const detalles = await Promise.all(
        resultado.map((inscripcion) => obtenerDetalleInscripcion(inscripcion.codigo)),
      )
      setAgenda(detalles.flatMap((detalle) => detalle?.proximos_encuentros ?? []))
      setCargadas(true)
    })
  }, [])

  const primera = inscripciones[0]
  const bloqueado = primera?.acceso.estado === ESTADO_HABILITACION.BLOQUEADO

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          {`Buen día, ${session.nombre}`}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{RESUMEN}</p>
      </header>

      {cargadas && inscripciones.length === 0 ? (
        <Card titulo="Mis Cursos">
          <p className="text-sm text-slate-600">{SIN_INSCRIPCIONES}</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador rotulo="CURSOS EN MARCHA" apoyo="CUR-102 · Desarrollo Web Full Stack">
              1
            </Indicador>

            <Indicador
              rotulo="ACCESO A LA CLASE"
              apoyo={
                bloqueado
                  ? `Causa: ${primera.acceso.causa}`
                  : 'Tu inscripción está habilitada en el período.'
              }
            >
              <Badge tono={bloqueado ? TONO.ROJO : TONO.VERDE}>
                {bloqueado ? 'BLOQUEADO' : 'HABILITADO'}
              </Badge>
            </Indicador>

            <Indicador rotulo="COMPROBANTES ACREDITADOS" apoyo="$31.000 · Transferencia">
              1
            </Indicador>

            <Indicador rotulo="PRÓXIMA CLASE" apoyo="Desarrollo Web Full Stack">
              <span className="text-2xl">Lun y Miér · 18:30 a 21:30</span>
            </Indicador>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="grid gap-4 lg:grid-cols-2">
              {inscripciones.map((inscripcion) => {
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
                      <li
                        key={encuentro.fecha}
                        className="rounded-xl bg-slate-50 px-4 py-3"
                      >
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
        </>
      )}
    </div>
  )
}
