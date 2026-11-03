import { useEffect, useRef } from 'react'
import { MARCA_UI } from './paleta'

/**
 * Ventana modal (8.3).
 *
 * **Se cierra con Escape y con el botón de cerrar, y no con un click en el fondo.** El click en el
 * fondo se pierde: una pantalla que carga datos de ejemplo llega tarde, y el operador que está
 * completando el alta va a hacer click en el fondo sin querer y a perder lo que escribió.
 *
 * **Un modal puede abrir otro, y por eso hay una pila.** El selector de horarios se abre sobre el
 * formulario de comisión (historia #48): sin pila, `Escape` cerraría los dos y el operador perdería
 * el alta que estaba cargando. El tope de la pila es el único que responde al teclado.
 *
 * **El foco no se escapa del modal mientras está abierto.** Al abrirlo se lleva el foco al
 * contenedor, `Tab` cicla entre los controles de adentro y al cerrarlo vuelve al control que lo
 * abrió. Sin eso, el teclado recorre la tabla de atrás, que el operador no está viendo.
 *
 * Con el modal abierto, el fondo no scrollea. Sin eso, una tabla larga detrás scrollea con la rueda
 * del mouse y el modal queda descentrado. El contenido del modal scrollea adentro, con un tope de
 * altura: un formulario que crece —el de comisión con sus siete días— no puede salirse de la
 * pantalla.
 */

/** Los modales abiertos, en orden. El último es el que tiene el teclado. */
const PILA = []

const ENFOCABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function Modal({ abierto, titulo, onClose, children, pie }) {
  const contenedorRef = useRef(null)
  const identificadorRef = useRef(null)
  // El `onClose` se guarda en una referencia para que el efecto dependa **solo** de `abierto`.
  // Si dependiera de la función, cada render que la redeclara sacaría y volvería a poner el modal
  // en la pila, y en un modal anidado el de abajo pasaría a estar arriba y se llevaría el `Escape`.
  const cerrarRef = useRef(onClose)

  useEffect(() => {
    cerrarRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!abierto) {
      return undefined
    }

    // El identificador se crea una sola vez por instancia: es lo que distingue este modal de otro
    // abierto encima suyo.
    if (identificadorRef.current === null) {
      identificadorRef.current = Symbol('modal')
    }
    const identificador = identificadorRef.current
    const enfocadoAlAbrir = document.activeElement

    PILA.push(identificador)
    contenedorRef.current?.focus()

    function alPresionarTecla(evento) {
      // Solo el modal de arriba responde: el de abajo está tapado.
      if (PILA[PILA.length - 1] !== identificador) {
        return
      }

      if (evento.key === 'Escape') {
        evento.stopPropagation()
        cerrarRef.current()
        return
      }

      if (evento.key !== 'Tab') {
        return
      }

      const enfocables = contenedorRef.current?.querySelectorAll(ENFOCABLES) ?? []
      if (enfocables.length === 0) {
        evento.preventDefault()
        return
      }

      const primero = enfocables[0]
      const ultimo = enfocables[enfocables.length - 1]
      const activo = document.activeElement

      if (evento.shiftKey && (activo === primero || activo === contenedorRef.current)) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && activo === ultimo) {
        evento.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', alPresionarTecla)
    return () => {
      document.removeEventListener('keydown', alPresionarTecla)
      const posicion = PILA.indexOf(identificador)
      if (posicion !== -1) {
        PILA.splice(posicion, 1)
      }
      // El foco vuelve a donde estaba: el botón que abrió el modal, o el campo del formulario de
      // atrás cuando este modal se abrió encima de otro.
      if (enfocadoAlAbrir instanceof HTMLElement && enfocadoAlAbrir.isConnected) {
        enfocadoAlAbrir.focus()
      }
    }
  }, [abierto])

  if (!abierto) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <div
        {...{ [MARCA_UI]: 'modal' }}
        ref={contenedorRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className="mt-10 max-h-[calc(100vh-5rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl outline-none"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="foco-acento rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
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
