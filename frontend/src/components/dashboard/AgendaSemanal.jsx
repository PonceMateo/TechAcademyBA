import { CalendarDays } from 'lucide-react'
import { formatFechaCorta } from '../../utils/formato'

/**
 * Agenda de los tres tableros (H/U 55, 56 y 57).
 *
 * **La tira de la semana es contexto, no una fuente de datos.** Destaca el día corriente y numera
 * los siete días; los encuentros que se listan son los que devolvió el servidor. No se inventan
 * clases para completar la semana.
 *
 * **La fecha va en el texto de cada encuentro** (`25/05/2026 · 18:30-21:30`) y el grupo lleva el
 * nombre del día. Así la lista se lee igual con lector de pantalla y sigue siendo una sola línea de
 * tiempo ordenada por fecha y hora.
 */

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function comoFecha(fecha) {
  const [anio, mes, dia] = String(fecha).split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

function lunesDe(hoy) {
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
  return lunes
}

function etiquetaDeGrupo(fecha) {
  const valor = comoFecha(fecha)
  const hoy = new Date()
  const manana = new Date(hoy)
  manana.setDate(hoy.getDate() + 1)

  if (valor.toDateString() === hoy.toDateString()) {
    return 'HOY'
  }
  if (valor.toDateString() === manana.toDateString()) {
    return 'MAÑANA'
  }
  return `${DIAS[(valor.getDay() + 6) % 7]} ${valor.getDate()} DE ${MESES[valor.getMonth()].toUpperCase()}`
}

function agrupar(encuentros) {
  const grupos = new Map()
  for (const encuentro of encuentros) {
    const clave = encuentro.fecha
    if (!grupos.has(clave)) {
      grupos.set(clave, [])
    }
    grupos.get(clave).push(encuentro)
  }
  return [...grupos.entries()]
}

export function AgendaSemanal({ encuentros = [], vacio = 'No hay clases programadas.', limite = 5 }) {
  const hoy = new Date()
  const lunes = lunesDe(hoy)
  const ordenados = [...encuentros].sort((izquierda, derecha) =>
    `${izquierda.fecha} ${izquierda.horario ?? ''}`.localeCompare(
      `${derecha.fecha} ${derecha.horario ?? ''}`,
    ),
  )
  const visibles = ordenados.slice(0, limite)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1" aria-hidden="true">
        {DIAS.map((dia, indice) => {
          const fecha = new Date(lunes)
          fecha.setDate(lunes.getDate() + indice)
          const esHoy = fecha.toDateString() === hoy.toDateString()

          return (
            <div
              key={`${dia}-${indice}`}
              className={`rounded-lg px-1 py-2 text-center ${
                esHoy
                  ? 'bg-[var(--acento-fuerte)] text-white'
                  : 'bg-[var(--superficie-interna)] text-[var(--texto-etiqueta)]'
              }`}
            >
              <p className="text-[10px] font-semibold">{dia}</p>
              <p className="text-sm font-bold">{fecha.getDate()}</p>
            </div>
          )
        })}
      </div>

      {visibles.length === 0 ? (
        <p className="text-sm text-[var(--texto-etiqueta)]">{vacio}</p>
      ) : (
        <div className="space-y-4">
          {agrupar(visibles).map(([fecha, delDia]) => (
            <section key={fecha}>
              <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-[var(--texto-etiqueta)]">
                {etiquetaDeGrupo(fecha)}
              </h3>
              <ul className="space-y-2">
                {delDia.map((encuentro) => (
                  <li
                    key={`${encuentro.codigo ?? ''}-${fecha}-${encuentro.horario ?? ''}`}
                    className="rounded-xl bg-[var(--superficie-interna)] px-3 py-2"
                  >
                    <p className="text-sm font-semibold text-[var(--texto-valor)]">
                      {`${formatFechaCorta(fecha)}${encuentro.horario ? ` · ${encuentro.horario}` : ''}`}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--texto-apoyo)]">
                      {encuentro.nombre_curso}
                      {encuentro.codigo ? ` · ${encuentro.codigo}` : ''}
                    </p>
                    {encuentro.tema ? (
                      <p className="mt-0.5 text-sm text-[var(--texto-valor)]">{encuentro.tema}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-[var(--texto-etiqueta)]">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
        {ordenados.length > visibles.length
          ? `Mostrando ${visibles.length} de ${ordenados.length} encuentros.`
          : 'Próximos siete días'}
      </p>
    </div>
  )
}
