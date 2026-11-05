import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Users,
} from 'lucide-react'
import { useSession } from '../auth/SessionContext'
import { AgendaSemanal } from '../components/dashboard/AgendaSemanal'
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
 * horario, sus contadores de acceso y su próxima clase, y la tarjeta entera abre el padrón. Las
 * finalizadas no se listan y las activas se ordenan por su próxima clase. La columna
 * `RESTRICCIONES` del Figma no existe: las celdas son conteos de acceso.
 *
 * **Lo que no tiene fuente no se construye.** `Correcciones pendientes`, `Novedades`, `Mensajes` y
 * `Entregas por corregir` no están en el modelo; en su lugar, la campana del armazón muestra los
 * alumnos bloqueados, que sí existen.
 */

const NO_SE_PUDO_LEER = 'No pudimos cargar tus comisiones. Volvé a intentar en un momento.'
const FONDOS_COMISION = ['bg-white', 'bg-[#EBF7F2]']

function pluralizar(cantidad, palabra) {
  return `${cantidad} ${cantidad === 1 ? palabra : `${palabra}s`}`
}

function porcentajeHabilitado(comision) {
  const total = comision.habilitados + comision.bloqueados
  return total === 0 ? 0 : Math.round((comision.habilitados / total) * 100)
}

function claveProximaClase(comision) {
  const claves = (comision.proximos_encuentros ?? [])
    .map((encuentro) => `${encuentro.fecha} ${encuentro.horario ?? ''}`)
    .sort()
  return claves[0] ?? null
}

function ordenarPorProximaClase(comisiones) {
  return [...comisiones].sort((izquierda, derecha) => {
    const proximaIzquierda = claveProximaClase(izquierda)
    const proximaDerecha = claveProximaClase(derecha)

    if (proximaIzquierda === null && proximaDerecha === null) {
      return izquierda.codigo.localeCompare(derecha.codigo)
    }
    if (proximaIzquierda === null) {
      return 1
    }
    if (proximaDerecha === null) {
      return -1
    }
    return proximaIzquierda.localeCompare(proximaDerecha)
  })
}

export function TeacherCommissionsPage() {
  const { session } = useSession()
  const [comisiones, setComisiones] = useState(null)
  const [fallo, setFallo] = useState(false)
  const carruselRef = useRef(null)
  const [puedeAnterior, setPuedeAnterior] = useState(false)
  const [puedeSiguiente, setPuedeSiguiente] = useState(false)

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
  const comisionesVisibles = ordenarPorProximaClase(
    lista.filter((comision) => comision.estado !== ESTADO_COMISION.FINALIZADA),
  )
  const cantidadComisiones = comisionesVisibles.length
  const actualizarFlechas = useCallback(() => {
    const carrusel = carruselRef.current
    if (carrusel === null) {
      return
    }
    setPuedeAnterior(carrusel.scrollLeft > 1)
    setPuedeSiguiente(carrusel.scrollLeft + carrusel.clientWidth < carrusel.scrollWidth - 1)
  }, [])

  useEffect(() => {
    actualizarFlechas()
    const carrusel = carruselRef.current
    if (carrusel === null) {
      return undefined
    }
    carrusel.addEventListener('scroll', actualizarFlechas, { passive: true })
    window.addEventListener('resize', actualizarFlechas)
    return () => {
      carrusel.removeEventListener('scroll', actualizarFlechas)
      window.removeEventListener('resize', actualizarFlechas)
    }
  }, [actualizarFlechas, cantidadComisiones])

  function moverCarrusel(direccion) {
    const carrusel = carruselRef.current
    if (carrusel === null) {
      return
    }
    const tarjeta = carrusel.querySelector('[data-comision]')
    const ancho = tarjeta === null ? carrusel.clientWidth : tarjeta.getBoundingClientRect().width + 12
    carrusel.scrollBy({ left: direccion * ancho, behavior: 'smooth' })
  }

  const habilitados = comisionesVisibles.reduce((total, fila) => total + fila.habilitados, 0)
  const bloqueados = comisionesVisibles.reduce((total, fila) => total + fila.bloqueados, 0)
  const encuentros = comisionesVisibles
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
  const proxima = encuentros[0] ?? null

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
          valor={pendiente ? '—' : String(cantidadComisiones)}
          apoyo={pendiente ? '' : 'en el período lectivo'}
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
            titulo="Tus comisiones, a un vistazo"
            descripcion="Abrí el padrón desde cada comisión."
            acciones={
              cantidadComisiones > 0 ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Comisión anterior"
                    onClick={() => moverCarrusel(-1)}
                    disabled={!puedeAnterior}
                    className="foco-acento inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--borde-superficie)] text-[var(--texto-valor)] transition hover:bg-[var(--superficie-interna)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Comisión siguiente"
                    onClick={() => moverCarrusel(1)}
                    disabled={!puedeSiguiente}
                    className="foco-acento inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--borde-superficie)] text-[var(--texto-valor)] transition hover:bg-[var(--superficie-interna)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ) : null
            }
          >
            {pendiente ? (
              <p className="text-sm text-[var(--texto-etiqueta)]">Cargando comisiones…</p>
            ) : comisionesVisibles.length === 0 ? (
              <p className="text-sm text-[var(--texto-etiqueta)]">
                {lista.length === 0
                  ? 'No tenés comisiones asignadas en este período lectivo.'
                  : 'No tenés comisiones activas en este período lectivo.'}
              </p>
            ) : (
              <ul
                ref={carruselRef}
                className="carrusel-sin-barra flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
              >
                {comisionesVisibles.map((comision, indice) => (
                  <li
                    key={comision.codigo}
                    data-comision
                    className="w-full shrink-0 snap-start sm:w-[calc(50%_-_0.375rem)]"
                  >
                    <Link
                      to={`/docente/alumnos/${comision.codigo}`}
                      className={`foco-acento block h-full cursor-pointer rounded-2xl border border-[#E3F2E9] p-4 transition hover:bg-[#E7F2ED] ${FONDOS_COMISION[indice % FONDOS_COMISION.length]}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="inline-block rounded-lg bg-white/60 px-2 py-1 text-xs font-bold tracking-wide text-[var(--acento-texto)]">
                            {comision.codigo}
                          </span>
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
                        <span className="shrink-0 text-right text-xs text-[var(--texto-etiqueta)]">
                          {comision.proxima_clase ?? comision.horario}
                        </span>
                      </div>

                      <h3 className="mt-3 truncate text-lg font-semibold text-[var(--texto-valor)]">
                        {comision.nombre_curso}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--texto-apoyo)]">{comision.horario}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--texto-etiqueta)]">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" aria-hidden="true" />
                          {comision.habilitados}{' '}
                          {comision.habilitados === 1
                            ? 'alumno habilitado'
                            : 'alumnos habilitados'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{pluralizar(comision.bloqueados, 'bloqueado')}</span>
                      </div>

                      <div
                        className="mt-4"
                        role="progressbar"
                        aria-label={`Acceso habilitado de ${comision.codigo}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={porcentajeHabilitado(comision)}
                      >
                        <div className="flex items-center justify-between text-xs text-[var(--texto-etiqueta)]">
                          <span>Acceso habilitado</span>
                          <span className="font-semibold text-[var(--texto-valor)]">
                            {porcentajeHabilitado(comision)}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/70">
                          <div
                            className="h-full rounded-full bg-[var(--acento)]"
                            style={{ width: `${porcentajeHabilitado(comision)}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-[var(--texto-apoyo)]">
                          {comision.proxima_clase
                            ? `Próxima clase: ${comision.proxima_clase}`
                            : 'Sin próxima clase en el período.'}
                        </p>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--acento-fuerte)] px-3 py-2 text-xs font-semibold text-white">
                          Ver comisión
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
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
        </div>
      </div>
    </div>
  )
}
