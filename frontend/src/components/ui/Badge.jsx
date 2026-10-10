import { CLASES_BADGE, MARCA_UI, TONO } from './paleta'

/**
 * Insignia de estado o de categoría (8.3).
 *
 * **Una sola pieza para los dos usos.** Habilitado, bloqueado, acreditado, observado, las cuatro
 * categorías arancelarias, el tipo de factura y los chips de las alertas del tablero son todos lo
 * mismo: una palabra corta con un color. Si cada pantalla tuviera la suya, el mismo estado
 * aparecería en verde en una pantalla y en azul en otra.
 *
 * `tono` es un tono con nombre —`verde`, `rojo`— y no una clase de Tailwind: la clase se decide
 * acá, en un solo lugar, y una pantalla nunca puede inventarse un color.
 */
export function Badge({ children, tono = TONO.GRIS, title }) {
  return (
    <span
      {...{ [MARCA_UI]: 'badge' }}
      title={title}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${CLASES_BADGE[tono] ?? CLASES_BADGE[TONO.GRIS]}`}
    >
      {children}
    </span>
  )
}
