import { MARCA_UI } from './paleta'

/**
 * Botón de la interfaz (8.3).
 *
 * Cuatro variantes y nada más. Un botón que acepta quince props de estilo termina siendo una hoja
 * de clases escrito en cada pantalla, que es exactamente lo que los componentes compartidos vienen
 * a evitar.
 *
 * Un botón deshabilitado no es clicable ni announces: es el modo en que se muestran las funciones
 * que existen y todavía no (D20). Por eso el texto de esos casos es siempre `Próximamente`.
 */
const VARIANTES = {
  primario: 'bg-slate-900 text-white hover:bg-slate-800',
  secundario: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  peligro: 'bg-red-700 text-white hover:bg-red-800',
  fantasma: 'text-slate-600 hover:bg-slate-100',
}

const TAMANOS = {
  chico: 'px-2 py-1 text-xs',
  medio: 'px-4 py-2 text-sm',
}

export function Button({
  children,
  variante = 'primario',
  tamano = 'medio',
  disabled = false,
  type = 'button',
  className = '',
  ...resto
}) {
  return (
    <button
      {...{ [MARCA_UI]: 'button' }}
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1 rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${TAMANOS[tamano]} ${className}`}
      {...resto}
    >
      {children}
    </button>
  )
}
