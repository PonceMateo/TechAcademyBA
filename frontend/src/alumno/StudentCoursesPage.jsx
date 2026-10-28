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
 * (`docs/design/figma-dashboards-overhaul/`) y los datos reales de `GET /alumno/inscripciones`
 * (HUs 38 y 42).
 *
 * **Una tarjeta por inscripción y ni una más.** El estado bloqueado es un estado de la misma
 * tarjeta, no una segunda: cuando la inscripción no tiene un pago acreditado o Secretaría la forzó,
 * esa tarjeta se pinta con el banner `Bloqueado`, la causa que ve Administración y el camino a
 * `Mis Pagos`.
 *
 * **La pantalla distingue "no lo sé" de "no hay".** `inscripciones` arranca en `null` y sigue en
 * `null` si la consulta falla, así que el mensaje de que el alumno no tiene cursos **solo** aparece
 * cuando la fuente confirmó una lista vacía. Mientras carga se dice que está cargando, y si la
 * consulta falla se dice eso: hace unos commits la pantalla mostraba "no tenés cursos" en los tres
 * casos, que es afirmar algo que nadie verificó.
 *
 * **El docente puede no estar asignado.** La comisión admite `docente_id` nulo, así que la línea
 * dice `a confirmar` en lugar de nombrar a una persona inventada.
 *
 * **Los indicadores salen de los datos reales.** `CURSOS EN MARCHA` cuenta las inscripciones,
 * `PRÓXIMA CLASE` sale del cronograma derivado de los horarios y `ACCESO A LA CLASE` del estado de
 * la inscripción. `COMPROBANTES ACREDITADOS` sigue en `—` porque los pagos del alumno son la HU 40 y
 * ninguna fuente respalda su valor (D43).
 */

const TONOS_CATEGORIA = {
  [CATEGORIA_INSCRIPCION.PARTICULAR]: { etiqueta: 'Particular', tono: TONO.GRIS },
  [CATEGORIA_INSCRIPCION.BECADO_PARCIAL]: { etiqueta: 'Becado parcial', tono: TONO.VIOLETA },
  [CATEGORIA_INSCRIPCION.BECADO_TOTAL]: { etiqueta: 'Becado total', tono: TONO.MAGENTA },
  [CATEGORIA_INSCRIPCION.CORPORATIVO]: { etiqueta: 'Corporativo', tono: TONO.CELESTE },
}

const SIN_INSCRIPCIONES = 'No tenés cursos activos en este período lectivo.'
const CARGANDO = 'Cargando tus cursos…'
const NO_SE_PUDO_LEER = 'No pudimos cargar tus cursos. Volvé a intentar en un momento.'
const TEMA_PENDIENTE = 'Tema a confirmar'
const DOCENTE_A_CONFIRMAR = 'a confirmar'

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

/** Tarjeta de una cursada: identificación, datos de la comisión y estado de acceso. */
function TarjetaCurso({ inscripcion }) {
  const bloqueada = inscripcion.acceso.estado === ESTADO_HABILITACION.BLOQUEADO
  const tono = bloqueada ? TONO.ROJO : TONO.VERDE
  const estado = bloqueada ? 'Bloqueado' : 'Habilitado'
  const docente = inscripcion.docente_nombre ?? DOCENTE_A_CONFIRMAR
  const categoria = TONOS_CATEGORIA[inscripcion.categoria] ?? { tono: TONO.GRIS }

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tono={TONO.DORADO}>{inscripcion.codigo}</Badge>
        <Badge tono={tono}>{estado}</Badge>
      </div>

      <h3 className="mt-3 text-lg font-semibold text-slate-900">{inscripcion.nombre_curso}</h3>

      <p className="mt-3 text-sm text-slate-600">{`Docente · ${docente}`}</p>
      <p className="text-sm text-slate-600">{inscripcion.horario}</p>
      <p className="flex items-center gap-2 text-sm text-slate-600">
        <span>Categoría</span>
        <Badge tono={categoria.tono}>
          {etiquetaCategoria(inscripcion.categoria, inscripcion.porcentaje_beca)}
        </Badge>
      </p>

      {/* El banner es el estado de acceso, grande y con su causa. Es un estado del componente y no
          una segunda tarjeta: el alumno tiene un curso, no dos. */}
      <div className={`mt-4 rounded-xl px-4 py-3 ${bloqueada ? 'bg-red-50' : 'bg-green-50'}`}>
        <p className={`text-lg font-semibold ${bloqueada ? 'text-red-800' : 'text-green-800'}`}>
          {estado}
        </p>
        {bloqueada ? (
          <p className="mt-1 text-sm text-red-900">
            {`Causa: ${inscripcion.acceso.causa}`}
            <Link to="/alumno/pagos" className="foco-acento ml-2 rounded font-medium underline">
              Ir a Mis Pagos
            </Link>
          </p>
        ) : (
          <p className="mt-1 text-sm text-green-900">Tu acceso a la clase está habilitado.</p>
        )}
      </div>

      <div className="mt-4 flex-1" />

      <div>
        <Link
          to={`/alumno/cursos/${inscripcion.codigo}`}
          className="boton-primario foco-acento inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white transition"
        >
          Ver detalle
        </Link>
      </div>
    </Card>
  )
}

export function StudentCoursesPage() {
  const { session } = useSession()
  const [inscripciones, setInscripciones] = useState(null)
  const [fallo, setFallo] = useState(false)
  const [agenda, setAgenda] = useState([])

  useEffect(() => {
    listarInscripcionesAlumno()
      .then(async (resultado) => {
        setInscripciones(resultado)

        // La agenda de la columna derecha son los próximos encuentros de las inscripciones que el
        // alumno ya tiene, por el mismo servicio que usa el detalle del curso. Cada encuentro lleva
        // el curso al que pertenece para que `PRÓXIMA CLASE` lo pueda nombrar y para que la clave de
        // la lista no se repita cuando dos cursos caen el mismo día.
        const detalles = await Promise.all(
          resultado.map((inscripcion) => obtenerDetalleInscripcion(inscripcion.codigo)),
        )
        setAgenda(
          resultado.flatMap((inscripcion, indice) =>
            (detalles[indice]?.proximos_encuentros ?? []).map((encuentro) => ({
              ...encuentro,
              codigo: inscripcion.codigo,
              nombre_curso: inscripcion.nombre_curso,
            })),
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

  const primera = inscripciones?.[0]
  const bloqueado = primera?.acceso.estado === ESTADO_HABILITACION.BLOQUEADO
  const proxima = agenda[0]
  const cargando = inscripciones === null && !fallo
  const sinCursos = inscripciones !== null && inscripciones.length === 0

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
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-slate-800">Mis Cursos</h2>
            {inscripciones !== null && (
              <Badge tono={TONO.GRIS}>
                {`${inscripciones.length} ${inscripciones.length === 1 ? 'cursada' : 'cursadas'}`}
              </Badge>
            )}
          </div>

          {cargando && (
            <Card>
              <p className="text-sm text-slate-500">{CARGANDO}</p>
            </Card>
          )}

          {fallo && (
            <Card>
              <p className="text-sm text-red-700">{NO_SE_PUDO_LEER}</p>
            </Card>
          )}

          {sinCursos && (
            <Card>
              <p className="text-sm text-slate-600">{SIN_INSCRIPCIONES}</p>
            </Card>
          )}

          {(inscripciones ?? []).length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {inscripciones.map((inscripcion) => (
                <TarjetaCurso key={inscripcion.codigo} inscripcion={inscripcion} />
              ))}
            </div>
          )}
        </section>

        <Card titulo="Tu agenda">
          {agenda.length === 0 ? (
            <p className="text-sm text-slate-500">No tenés encuentros programados por ahora.</p>
          ) : (
            <ul className="space-y-3">
              {agenda.map((encuentro) => (
                <li
                  key={`${encuentro.codigo}-${encuentro.fecha}`}
                  className="rounded-xl bg-slate-50 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-slate-800">
                    {formatFechaCorta(encuentro.fecha)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{encuentro.nombre_curso}</p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {encuentro.tema ?? TEMA_PENDIENTE}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
