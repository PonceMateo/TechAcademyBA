import { useEffect } from 'react'
import { MARCA_UI } from './paleta'

/**
 * Ventana modal (8.3).
 *
 * **Se cierra con Escape y con el botón de cerrar, y no con un click en el fondo.** El click en el
 * fondo se pierde: una pantalla que carga datos de ejemplo llega tarde, y el operador que está
 * completando el alta va a hacer click en el fondo sin querer y a perder lo que escribió.
 *
 * Con el modal abierto, el fondo no scrollea. Sin eso, una tabla larga detrás scrollea con la rueda
 * del mouse y el modal queda descentrado.
 */
export function Modal({ abierto, titulo, onClose, children, pie }) {
  useEffect(() => {
    if (!abierto) {
      return undefined
    }

    function alPresionarEscape(evento) {
      if (evento.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', alPresionarEscape)
    return () => {
      document.removeEventListener('keydown', alPresionarEscape)
    }
  }, [abierto, onClose])

  if (!abierto) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
      <div
        {...{ [MARCA_UI]: 'modal' }}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="mt-10 w-full max-w-2xl rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4">{children}</div>

        {pie !== null && pie !== undefined && (
          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">{pie}</div>
        )}
      </div>
    </div>
  )
}
