import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MARCA_UI } from './paleta'

/**
 * Tooltip accesible con portal (HU 61).
 *
 * No hay componente de tooltip existente en `components/ui`: este se crea siguiendo la misma
 * convención (`MARCA_UI`, tonos del tema) y se reutiliza para el indicador de observados y para
 * el de bloqueado.
 *
 * El cuerpo del tooltip es `position: fixed` sobre `document.body`: no participa del layout del
 * modal ni activa su scrollbar. El botón mantiene `aria-describedby` y `focus`.
 */
export function Tooltip({
  id,
  label,
  content,
  buttonClass = '',
  tonoBoton = 'gris',
  children,
}) {
  const [abierto, setAbierto] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const botonRef = useRef(null)

  function posicionar() {
    const rect = botonRef.current?.getBoundingClientRect()
    if (rect) {
      setPos({ x: rect.right + 4, y: rect.top + 4 })
    }
  }

  useEffect(() => {
    if (abierto) {
      posicionar()
    }
  }, [abierto])

  function alPresionarTecla(e) {
    if (e.key === 'Escape' && abierto) {
      setAbierto(false)
    }
  }

  const colorBoton =
    tonoBoton === 'rojo'
      ? 'bg-red-100 text-red-700 ring-red-600/30'
      : tonoBoton === 'ambar'
        ? 'bg-amber-100 text-amber-900 ring-amber-600/30'
        : 'bg-slate-100 text-slate-700 ring-slate-400/30'

  return (
    <span {...{ [MARCA_UI]: 'tooltip' }} className="relative inline-flex" onKeyDown={alPresionarTecla}>
      <button
        ref={botonRef}
        type="button"
        aria-label={label}
        aria-describedby={id}
        onMouseEnter={() => {
          posicionar()
          setAbierto(true)
        }}
        onMouseLeave={() => setAbierto(false)}
        onFocus={() => {
          posicionar()
          setAbierto(true)
        }}
        onBlur={() => setAbierto(false)}
        className={`foco-acento inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ring-1 ${colorBoton} ${buttonClass}`}
      >
        {children}
      </button>

      {abierto &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            className="pointer-events-none fixed z-[60] max-w-xs rounded-md bg-slate-900 px-2 py-1 text-xs font-normal text-white shadow-xl"
            style={{ left: pos.x, top: pos.y }}
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  )
}
