import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  Layers,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { useSession } from '../auth/SessionContext'
import { AgendaSemanal } from '../components/dashboard/AgendaSemanal'
import { AvisosAtencion } from '../components/dashboard/AvisosAtencion'
import { CobrosPorMes } from '../components/dashboard/CobrosPorMes'
import { Indicador } from '../components/dashboard/Indicador'
import { Badge, Card } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { ESTADO_COMPROBANTE_LABELS } from '../domain/enums'
import { obtenerDashboardAdmin } from '../services/dataService'
import { formatFechaLarga, formatFechaCorta, formatMoneda } from '../utils/formato'

/**
 * Tablero operativo de Administración (H/U 55).
 *
 * **Todo sale de `GET /admin/dashboard`.** La pantalla no cuenta inscripciones ni suma cobros: los
 * indicadores, la serie, la ocupación, los comprobantes y la agenda llegan resueltos del servidor.
 * Así el número de una tarjeta y el de una alerta no pueden contradecirse.
 *
 * **Lo que el Figma mostraba sin fuente se reemplaza por lo real.** `Últimas inscripciones` pasa a
 * `Comprobantes recientes` —los cinco últimos de cualquier estado, con las etiquetas de Cobranzas—;
 * `Alertas de Gestión Pendiente` pasa a `Requiere tu atención` con conteos y enlaces; y
 * `Descargar Reporte del Día` desaparece porque no hay reportería que respalde esa acción.
 *
 * **La pantalla distingue "no lo sé" de "no hay".** Mientras la lectura no resuelve, los valores
 * muestran `—`; con la respuesta, un cero es un cero real. Si la lectura falla, se dice y no se
 * afirma que la academia no tiene datos.
 */

const NO_SE_PUDO_LEER = 'No pudimos cargar el tablero. Volvé a intentar en un momento.'

function valor(valorActual, sufijo = '') {
  return valorActual === null || valorActual === undefined
    ? '—'
    : `${valorActual}${sufijo}`
}

export function DashboardPage() {
  const { session } = useSession()
  const [datos, setDatos] = useState(null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    let vigente = true
    obtenerDashboardAdmin()
      .then((respuesta) => {
        if (vigente) {
          setDatos(respuesta)
          setFallo(false)
        }
      })
      .catch(() => {
        if (vigente) {
          setFallo(true)
        }
      })
    return () => {
      vigente = false
    }
  }, [])

  const indicadores = datos?.indicadores
  const avisos = []

  if (indicadores?.comprobantes_pendientes > 0) {
    avisos.push({
      texto: 'Comprobantes sin revisar',
      detalle: 'Esperan la revisión de Secretaría.',
      cantidad: indicadores.comprobantes_pendientes,
      ruta: '/admin/cobranzas',
    })
  }
  if (indicadores?.cobranzas_observadas > 0) {
    avisos.push({
      texto: 'Cobranzas observadas',
      detalle: 'Tienen una causa pendiente de resolver.',
      cantidad: indicadores.cobranzas_observadas,
      ruta: '/admin/cobranzas',
    })
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--texto-valor)]">
          {`Buen día, ${session.nombre}`}
        </h1>
        <p className="mt-1 text-sm text-[var(--texto-etiqueta)]">
          {`${formatFechaLarga()} · Todo lo que necesitás para gestionar tu academia.`}
        </p>
      </header>

      {fallo && (
        <p role="alert" className="text-sm text-red-700">
          {NO_SE_PUDO_LEER}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="ALUMNOS INSCRIPTOS"
          valor={datos === null ? '—' : valor(indicadores.alumnos_inscriptos)}
          apoyo={
            datos === null
              ? ''
              : `${indicadores.inscripciones_activas} inscripciones activas`
          }
          icono={Users}
        />
        <Indicador
          rotulo="CUPO PROMEDIO OCUPADO"
          valor={
            datos === null
              ? '—'
              : indicadores.cupo_promedio_ocupado === null
                ? '—'
                : `${Number(indicadores.cupo_promedio_ocupado).toLocaleString('es-AR')} %`
          }
          apoyo={
            datos === null
              ? ''
              : `${indicadores.comisiones_vigentes} comisiones vigentes`
          }
          icono={TrendingUp}
        />
        <Indicador
          rotulo="COMISIONES"
          valor={datos === null ? '—' : valor(indicadores.comisiones)}
          apoyo={datos === null ? '' : `${indicadores.comisiones_vigentes} vigentes`}
          icono={Layers}
        />
        <Indicador
          rotulo="COBROS PENDIENTES DE COBRO"
          valor={datos === null ? '—' : valor(indicadores.cobros_pendientes)}
          apoyo={
            datos === null
              ? ''
              : `${indicadores.comprobantes_pendientes} comprobantes · ${indicadores.cobranzas_observadas} observadas`
          }
          icono={Wallet}
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card
            titulo="Panorama de cobros"
            descripcion="Importe acreditado de los últimos seis meses."
            acciones={
              <div className="text-right">
                <p className="text-[11px] font-semibold tracking-wide text-[var(--texto-etiqueta)] uppercase">
                  Cobrado este mes
                </p>
                <p className="text-lg font-extrabold text-[var(--texto-valor)]">
                  {datos === null ? '—' : formatMoneda(indicadores.cobrado_mes_actual)}
                </p>
              </div>
            }
          >
            <CobrosPorMes serie={datos?.cobros_por_mes ?? []} />

            {(datos?.ocupacion_por_comision ?? []).length > 0 && (
              <div className="mt-5 space-y-3">
                <p className="text-[11px] font-semibold tracking-wide text-[var(--texto-etiqueta)] uppercase">
                  Ocupación por comisión
                </p>
                {(datos?.ocupacion_por_comision ?? []).map((fila) => (
                  <div key={fila.codigo}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-[var(--texto-valor)]">
                        {fila.nombre_curso}
                      </span>
                      <span className="shrink-0 text-xs text-[var(--texto-etiqueta)]">
                        {`${fila.inscriptos}/${fila.cupo} · ${Number(fila.porcentaje)} %`}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--superficie-interna)]">
                      <div
                        className="h-full rounded-full bg-[var(--acento)]"
                        style={{ width: `${Math.min(Number(fila.porcentaje), 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            titulo="Comprobantes recientes"
            descripcion="Los últimos cinco envíos, con el mismo estado que en Cobranzas."
            acciones={
              <Link
                to="/admin/cobranzas"
                className="foco-acento inline-flex items-center gap-1 text-sm font-semibold texto-acento"
              >
                Ver todos
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            }
          >
            {(datos?.comprobantes_recientes ?? []).length === 0 ? (
              <p className="text-sm text-[var(--texto-etiqueta)]">
                {datos === null
                  ? 'Cargando comprobantes…'
                  : 'Todavía no hay comprobantes enviados.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {datos.comprobantes_recientes.map((comprobante) => (
                  <li
                    key={comprobante.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--superficie-interna)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--texto-valor)]">
                        {comprobante.alumno}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--texto-apoyo)]">
                        {`${comprobante.inscripcion.nombre_curso} · ${formatFechaCorta(comprobante.fecha_pago)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--texto-valor)]">
                        {formatMoneda(comprobante.importe)}
                      </span>
                      <Badge
                        tono={
                          comprobante.estado === 'PENDIENTE_REVISION'
                            ? TONO.AMBAR
                            : comprobante.estado === 'ACEPTADO'
                              ? TONO.VERDE
                              : comprobante.estado === 'RECHAZADO'
                                ? TONO.ROJO
                                : TONO.CELESTE
                        }
                      >
                        {ESTADO_COMPROBANTE_LABELS[comprobante.estado] ?? comprobante.estado}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card titulo="Tu agenda">
            <AgendaSemanal
              encuentros={datos?.agenda ?? []}
              vacio={
                datos === null
                  ? 'Cargando agenda…'
                  : 'No hay clases en los próximos siete días.'
              }
            />
          </Card>

          <Card titulo="Requiere tu atención">
            <AvisosAtencion
              avisos={avisos}
              vacio="No hay comprobantes ni cobranzas pendientes."
            />
          </Card>

          <Card titulo="Accesos Rápidos del Personal">
            <div className="flex flex-col gap-2">
              <Link
                to="/admin/cobranzas"
                className="foco-acento inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--acento-fuerte)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--acento-fuerte-hover)]"
              >
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                Registrar Cobranza
              </Link>
              <Link
                to="/admin/alumnos"
                className="foco-acento inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--borde-superficie)] bg-[var(--superficie-tarjeta)] px-4 py-2 text-sm font-semibold text-[var(--texto-valor)] transition hover:bg-[var(--superficie-interna)]"
              >
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Verificar Habilitaciones
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
