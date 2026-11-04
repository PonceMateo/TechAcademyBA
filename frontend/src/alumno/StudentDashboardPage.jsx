import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, BookOpen, CalendarDays, CreditCard, ShieldCheck } from 'lucide-react'
import { useSession } from '../auth/SessionContext'
import { AgendaSemanal } from '../components/dashboard/AgendaSemanal'
import { AvisosAtencion } from '../components/dashboard/AvisosAtencion'
import { Indicador } from '../components/dashboard/Indicador'
import { Badge, Card } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import {
  ESTADO_COBRANZA,
  ESTADO_COMPROBANTE_ALUMNO,
  ESTADO_COMPROBANTE_LABELS,
  ESTADO_HABILITACION,
} from '../domain/enums'
import {
  listarComprobantesAlumno,
  listarInscripcionesAlumno,
  listarPagosAlumno,
  obtenerDetalleInscripcion,
} from '../services/dataService'
import { formatFechaLarga, formatFechaCorta, formatMoneda } from '../utils/formato'

/**
 * Tablero del alumno (H/U 57).
 *
 * **Los indicadores salen de datos reales.** `CURSOS EN MARCHA` cuenta las inscripciones,
 * `ACCESO A LA CLASE` toma el peor estado entre sus cursadas, `PRÓXIMA CLASE` sale del cronograma
 * y `COMPROBANTES ACREDITADOS` de los pagos imputados al alumno. El progreso, las tareas y la
 * asistencia promedio del prototipo no existen en el modelo y no se inventan.
 *
 * **`Tu situación de pagos` reemplaza al bloque de progreso.** Muestra lo acreditado, lo que espera
 * revisión y lo observado, con el mismo estado que `Mis Pagos`; `Comprobantes recientes` muestra
 * los últimos cinco envíos. `Requiere tu atención` lleva el acceso bloqueado y el comprobante
 * observado a la pantalla donde se resuelven.
 *
 * **La agenda es una sola línea de tiempo.** Si el detalle de una cursada falla, la agenda de las
 * otras sigue en pie (`Promise.allSettled`); el error de la lectura principal se informa sin
 * afirmar que el alumno no tiene cursos.
 */

const NO_SE_PUDO_LEER = 'No pudimos cargar tus cursos. Volvé a intentar en un momento.'
const SIN_ENCUENTROS = 'No tenés encuentros programados por ahora.'
const SIN_COMPROBANTES = 'Todavía no enviaste comprobantes.'

export function StudentDashboardPage() {
  const { session } = useSession()
  const [inscripciones, setInscripciones] = useState(null)
  const [fallo, setFallo] = useState(false)
  const [agenda, setAgenda] = useState([])
  const [pagos, setPagos] = useState(null)
  const [comprobantes, setComprobantes] = useState(null)

  useEffect(() => {
    let vigente = true

    listarInscripcionesAlumno()
      .then(async (resultado) => {
        if (!vigente) {
          return
        }
        setInscripciones(resultado)

        const [detalles, pagosLeidos, comprobantesLeidos] = await Promise.all([
          Promise.allSettled(
            resultado.map((inscripcion) => obtenerDetalleInscripcion(inscripcion.codigo)),
          ),
          listarPagosAlumno().catch(() => null),
          listarComprobantesAlumno().catch(() => null),
        ])

        if (!vigente) {
          return
        }

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
            .sort((izquierda, derecha) =>
              String(izquierda.fecha).localeCompare(String(derecha.fecha)),
            ),
        )
        setPagos(pagosLeidos)
        setComprobantes(comprobantesLeidos)
      })
      .catch(() => {
        if (vigente) {
          setFallo(true)
          setAgenda([])
        }
      })

    return () => {
      vigente = false
    }
  }, [])

  const bloqueada =
    inscripciones?.find(
      (inscripcion) => inscripcion.acceso.estado === ESTADO_HABILITACION.BLOQUEADO,
    ) ?? null
  const hayInscripciones = Boolean(inscripciones?.length)
  const proxima = agenda[0] ?? null

  const acreditados = (pagos ?? []).filter(
    (pago) => pago.estado === ESTADO_COBRANZA.ACREDITADO,
  )
  const totalAcreditado = acreditados.reduce(
    (total, pago) => total + Number(pago.importe ?? 0),
    0,
  )
  const pendientes = (comprobantes ?? []).filter(
    (comprobante) => comprobante.estado === ESTADO_COMPROBANTE_ALUMNO.PENDIENTE_REVISION,
  )
  const observados = (comprobantes ?? []).filter(
    (comprobante) => comprobante.estado === ESTADO_COMPROBANTE_ALUMNO.OBSERVADO,
  )
  const recientes = [...(comprobantes ?? [])]
    .sort((izquierda, derecha) =>
      String(derecha.enviado_at ?? derecha.fecha_pago).localeCompare(
        String(izquierda.enviado_at ?? izquierda.fecha_pago),
      ),
    )
    .slice(0, 5)

  const avisos = []
  if (bloqueada) {
    avisos.push({
      texto: 'Tu acceso está bloqueado',
      detalle: `Causa: ${bloqueada.acceso.causa}`,
      cantidad: 1,
      ruta: '/alumno/pagos',
    })
  }
  if (observados.length > 0) {
    avisos.push({
      texto: 'Tenés un comprobante observado',
      detalle: 'Revisá el motivo y reenviá el comprobante desde Mis Pagos.',
      cantidad: observados.length,
      ruta: '/alumno/pagos',
    })
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--texto-valor)]">
          {`Buen día, ${session.nombre}`}
        </h1>
        <p className="mt-1 text-sm text-[var(--texto-etiqueta)]">
          {`${formatFechaLarga()} · Cada paso cuenta. Este es tu espacio para avanzar.`}
        </p>
      </header>

      {fallo && (
        <p role="alert" className="text-sm text-red-700">
          {NO_SE_PUDO_LEER}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="CURSOS EN MARCHA"
          valor={inscripciones === null ? '—' : inscripciones.length}
          apoyo={(inscripciones ?? [])
            .map((inscripcion) => `${inscripcion.codigo} · ${inscripcion.nombre_curso}`)
            .join(', ')}
          icono={BookOpen}
        />
        <Indicador
          rotulo="ACCESO A LA CLASE"
          valor={
            hayInscripciones ? (
              <Badge tono={bloqueada ? TONO.ROJO : TONO.VERDE}>
                {bloqueada ? 'BLOQUEADO' : 'HABILITADO'}
              </Badge>
            ) : (
              '—'
            )
          }
          apoyo={
            hayInscripciones
              ? bloqueada
                ? `Causa: ${bloqueada.acceso.causa}`
                : 'Tu inscripción está habilitada en el período.'
              : ''
          }
          icono={ShieldCheck}
        />
        <Indicador
          rotulo="COMPROBANTES ACREDITADOS"
          valor={pagos === null ? '—' : acreditados.length}
          apoyo={pagos === null ? '' : `${formatMoneda(totalAcreditado)} acreditados`}
          icono={CreditCard}
        />
        <Indicador
          rotulo="PRÓXIMA CLASE"
          valor={proxima ? formatFechaCorta(proxima.fecha) : '—'}
          apoyo={proxima?.nombre_curso ?? ''}
          icono={CalendarDays}
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card titulo="Tu situación de pagos">
            {pagos === null ? (
              <p className="text-sm text-[var(--texto-etiqueta)]">Cargando tus pagos…</p>
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold tracking-wide text-[var(--texto-etiqueta)] uppercase">
                    Total acreditado
                  </dt>
                  <dd className="mt-1 text-lg font-extrabold text-[var(--texto-valor)]">
                    {formatMoneda(totalAcreditado)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold tracking-wide text-[var(--texto-etiqueta)] uppercase">
                    Acreditados
                  </dt>
                  <dd className="mt-1 text-lg font-extrabold text-[var(--texto-valor)]">
                    {acreditados.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold tracking-wide text-[var(--texto-etiqueta)] uppercase">
                    Pendientes de revisión
                  </dt>
                  <dd className="mt-1 text-lg font-extrabold text-[var(--texto-valor)]">
                    {comprobantes === null ? '—' : pendientes.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold tracking-wide text-[var(--texto-etiqueta)] uppercase">
                    Observados
                  </dt>
                  <dd className="mt-1 text-lg font-extrabold text-[var(--texto-valor)]">
                    {comprobantes === null ? '—' : observados.length}
                  </dd>
                </div>
              </dl>
            )}
            <Link
              to="/alumno/pagos"
              className="foco-acento mt-3 inline-flex items-center gap-1 text-sm font-semibold texto-acento"
            >
              Ir a Mis Pagos
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Card>

          <Card
            titulo="Comprobantes recientes"
            acciones={
              <Link
                to="/alumno/pagos"
                className="foco-acento inline-flex items-center gap-1 text-sm font-semibold texto-acento"
              >
                Ver todos
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            }
          >
            {comprobantes === null ? (
              <p className="text-sm text-[var(--texto-etiqueta)]">Cargando comprobantes…</p>
            ) : recientes.length === 0 ? (
              <p className="text-sm text-[var(--texto-etiqueta)]">{SIN_COMPROBANTES}</p>
            ) : (
              <ul className="space-y-2">
                {recientes.map((comprobante) => (
                  <li
                    key={comprobante.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--superficie-interna)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--texto-valor)]">
                        {formatMoneda(comprobante.importe)}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--texto-apoyo)]">
                        {`Pago del ${formatFechaCorta(comprobante.fecha_pago)}`}
                      </p>
                    </div>
                    <Badge
                      tono={
                        comprobante.estado === ESTADO_COMPROBANTE_ALUMNO.ACEPTADO
                          ? TONO.VERDE
                          : comprobante.estado === ESTADO_COMPROBANTE_ALUMNO.OBSERVADO
                            ? TONO.CELESTE
                            : comprobante.estado === ESTADO_COMPROBANTE_ALUMNO.RECHAZADO
                              ? TONO.ROJO
                              : TONO.AMBAR
                      }
                    >
                      {ESTADO_COMPROBANTE_LABELS[comprobante.estado] ?? comprobante.estado}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card titulo="Tu agenda">
            <AgendaSemanal
              encuentros={agenda}
              vacio={
                fallo
                  ? NO_SE_PUDO_LEER
                  : inscripciones === null
                    ? 'Cargando agenda…'
                    : SIN_ENCUENTROS
              }
            />
          </Card>

          <Card titulo="Requiere tu atención">
            <AvisosAtencion
              avisos={avisos}
              vacio="No tenés avisos pendientes. Tu acceso y tus comprobantes están al día."
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
