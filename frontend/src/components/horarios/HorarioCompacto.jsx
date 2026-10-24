import { useEffect, useRef, useState } from 'react'
import { resumenHorarios } from '../../domain/horarios'

/**
 * El horario en la tabla de comisiones (historia #48).
 *
 * **Una línea con puntos suspensivos, el texto completo en el tooltip y un badge `+N`.** La columna
 * tiene el ancho de una tabla, así que siete días con rangos distintos no entran: el resumen
 * completo queda en el tooltip y en el popover, y la fila no crece de alto.
 *
 * **El badge es determinista: aparece cuando hay más de un grupo y cuenta los grupos que no entran
 * en la línea** (`+1` para dos grupos). No mide el ancho del texto: en `jsdom` no se puede medir y en
 * el navegador cualquier medición vuelve frágil el test.
 *
 * Los grupos salen de la misma función que los chips del formulario, así que la tabla y el alta no
 * pueden decir cosas distintas del mismo horario.
 */
export function HorarioCompacto({ horarios, texto }) {
  const [abierto, setAbierto] = useState(false)
  const contenedorRef = useRef(null)

  const grupos = resumenHorarios(horarios)
  // Sin horarios estructurados queda el texto de la comisión —el que la migración no pudo
  // interpretar—, que es lo único que hay para mostrar.
  const completo = grupos.length === 0 ? (texto ?? '—') : grupos.join(', ')

  useEffect(() => {
    if (!abierto) {
      return undefined
    }

    function alHacerClickAfuera(evento) {
      if (contenedorRef.current !== null && !contenedorRef.current.contains(evento.target)) {
        setAbierto(false)
      }
    }

    function alPresionarEscape(evento) {
      if (evento.key === 'Escape') {
        setAbierto(false)
      }
    }

    document.addEventListener('mousedown', alHacerClickAfuera)
    document.addEventListener('keydown', alPresionarEscape)
    return () => {
      document.removeEventListener('mousedown', alHacerClickAfuera)
      document.removeEventListener('keydown', alPresionarEscape)
    }
  }, [abierto])

  return (
    <span ref={contenedorRef} className="relative inline-flex items-center gap-1">
      <span title={completo} className="block max-w-[13rem] truncate">
        {grupos[0] ?? completo}
      </span>

      {grupos.length > 1 && (
        <button
          type="button"
          aria-expanded={abierto}
          aria-label={`Ver los ${grupos.length} horarios completos`}
          onClick={() => setAbierto((anterior) => !anterior)}
          className="foco-acento rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
        >
          +{grupos.length - 1}
        </button>
      )}

      {abierto && grupos.length > 1 && (
        <div
          role="dialog"
          aria-label="Horarios completos"
          className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-2 text-left shadow-lg"
        >
          <ul className="space-y-1">
            {grupos.map((grupo) => (
              <li key={grupo} className="text-xs text-slate-700">
                {grupo}
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  )
}
