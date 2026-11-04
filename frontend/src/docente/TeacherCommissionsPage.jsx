import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Users } from 'lucide-react'
import { useSession } from '../auth/SessionContext'
import { AgendaSemanal } from '../components/dashboard/AgendaSemanal'
import { AvisosAtencion } from '../components/dashboard/AvisosAtencion'
import { Indicador } from '../components/dashboard/Indicador'
import { Badge, Card } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { ESTADO_COMISION } from '../domain/enums'
import { obtenerComisionesAsignadas } from '../services/dataService'
import { formatFechaLarga, formatFechaCorta } from '../utils/formato'

/**
 * Tablero del docente (H/U 56).
 *
 * **Los cuatro indicadores salen de la misma lista que las tarjetas de comisión.** `COMISIONES
 * ACTIVAS`, `ALUMNOS HABILITADOS`, `BLOQUEADOS` y `PRÓXIMA CLASE` se derivan de las comisiones y
 * sus encuentros, así que el indicador y la tarjeta no pueden contradecirse.
 *
 * **La tabla del prototipo pasa a tarjetas accionables.** Cada comisión muestra su estado, su
 * horario, sus contadores de acceso y su próxima clase, y el código abre el padrón. La columna
 * `RESTRICCIONES` del Figma no existe: las celdas son conteos de acceso.
 *
 * **Lo que no tiene fuente no se construye.** `Correcciones pendientes`, `Novedades`, `Mensajes` y
 * `Entregas por corregir` no están en el modelo; en su lugar, `Requiere tu atención` muestra los
 * alumnos bloqueados y las comisiones finalizadas, que sí existen.
 */

const NO_SE_PUDO_LEER = 'No pudimos cargar tus comisiones. Volvé a intentar en un momento.'

function pluralizar(cantidad, palabra) {
  return `${cantidad} ${cantidad === 1 ? palabra : `${palabra}s`}`
}

export function TeacherCommissionsPage() {
  const { session } = useSession()
  const [comisiones, setComisiones] = useState(null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    let vigente = true
    obtenerComisionesAsignadas()
      .then((respuesta) => {
        if (vigente) {
          setComisiones(respuesta)
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

  const pendiente = comisiones === null
  const lista = comisiones ?? []
  const habilitados = lista.reduce((total, fila) => total + fila.habilitados, 0)
  const bloqueados = lista.reduce((total, fila) => total + fila.bloqueados, 0)
  const encuentros = lista
    .flatMap((comision) =>
      (comision.proximos_encuentros ?? []).map((encuentro) => ({
        ...encuentro,
        codigo: comision.codigo,
        nombre_curso: comision.nombre_curso,
      })),
    )
    .sort((izquierda, derecha) =>
      `${izquierda.fecha} ${izquierda.horario ?? ''}`.localeCompare(
        `${derecha.fecha} ${derecha.horario ?? ''}`,
      ),
    )
    .slice(0, 8)
  const proxima = encuentros[0] ?? null
  const finalizadas = lista.filter(
    (comision) => comision.estado === ESTADO_COMISION.FINALIZADA,
  ).length

  const avisos = []
  if (bloqueados > 0) {
    avisos.push({
      texto: 'Alumnos bloqueados',
      detalle: 'Revisá el acceso en el padrón de tus comisiones.',
      cantidad: bloqueados,
      ruta: '/docente/alumnos',
    })
  }
  if (finalizadas > 0) {
    avisos.push({
      texto: 'Comisiones finalizadas',
      detalle: 'Siguen visibles como historial, sin clases próximas.',
      cantidad: finalizadas,
      ruta: '/docente/alumnos',
    })
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--texto-valor)]">
          {`Buen día, ${session.nombre}`}
        </h1>
        <p className="mt-1 text-sm text-[var(--texto-etiqueta)]">
          {`${formatFechaLarga()} · Tu agenda y tus comisiones en un solo lugar.`}
        </p>
      </header>

      {fallo && (
        <p role="alert" className="text-sm text-red-700">
          {NO_SE_PUDO_LEER}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="COMISIONES ACTIVAS"
          valor={pendiente ? '—' : String(lista.length)}
          apoyo={pendiente ? '' : `${finalizadas} finalizadas`}
          icono={BookOpen}
        />
        <Indicador
          rotulo="ALUMNOS HABILITADOS"
          valor={pendiente ? '—' : String(habilitados)}
          apoyo={pendiente ? '' : 'con acceso a la clase'}
          icono={CheckCircle2}
        />
        <Indicador
          rotulo="BLOQUEADOS"
          valor={pendiente ? '—' : String(bloqueados)}
          apoyo={pendiente ? '' : 'requieren revisión'}
          icono={Users}
        />
        <Indicador
          rotulo="PRÓXIMA CLASE"
          valor={
            pendiente
              ? '—'
              : proxima
                ? formatFechaCorta(proxima.fecha)
                : '—'
          }
          apoyo={proxima?.nombre_curso ?? ''}
          icono={CalendarDays}
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card
            titulo="Comisiones asignadas"
            descripcion="Abrí el padrón desde el código de cada comisión."
          >
            {pendiente ? (
              <p className="text-sm text-[var(--texto-etiqueta)]">Cargando comisiones…</p>
            ) : lista.length === 0 ? (
              <p className="text-sm text-[var(--texto-etiqueta)]">
                No tenés comisiones asignadas en este período lectivo.
              </p>
            ) : (
              <ul className="space-y-3">
                {lista.map((comision) => (
                  <li
                    key={comision.codigo}
                    className="rounded-xl border border-[var(--borde-superficie)] bg-[var(--superficie-tarjeta)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to={`/docente/alumnos/${comision.codigo}`}
                          className="foco-acento texto-acento rounded text-sm font-semibold underline"
                        >
                          {comision.codigo}
                        </Link>
                        <p className="mt-0.5 truncate text-sm font-semibold text-[var(--texto-valor)]">
                          {comision.nombre_curso}
                        </p>
                      </div>
                      <Badge
                        tono={
                          comision.estado === ESTADO_COMISION.FINALIZADA
                            ? TONO.GRIS
                            : TONO.EMERALDA
                        }
                      >
                        {comision.estado}
                      </Badge>
                    </div>

                    <p className="mt-2 text-xs text-[var(--texto-etiqueta)]">{comision.horario}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tono={TONO.VERDE}>
                        {pluralizar(comision.habilitados, 'habilitado')}
                      </Badge>
                      <Badge tono={TONO.ROJO}>
                        {pluralizar(comision.bloqueados, 'bloqueado')}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-[var(--texto-apoyo)]">
                      {comision.proxima_clase
                        ? `Próxima clase: ${comision.proxima_clase}`
                        : 'Sin próxima clase en el período.'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card titulo="Tu agenda">
            <AgendaSemanal
              encuentros={encuentros}
              vacio={
                pendiente
                  ? 'Cargando agenda…'
                  : 'No tenés clases programadas en este período.'
              }
            />
          </Card>

          <Card titulo="Requiere tu atención">
            <AvisosAtencion
              avisos={avisos}
              vacio="No tenés alumnos bloqueados ni comisiones finalizadas."
            />
          </Card>

          <Link
            to="/docente/alumnos"
            className="foco-acento inline-flex items-center gap-1 text-sm font-semibold texto-acento"
          >
            Ir a mis alumnos
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  )
}
