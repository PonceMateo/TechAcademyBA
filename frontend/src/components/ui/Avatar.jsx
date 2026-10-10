import { MARCA_UI } from './paleta'

/**
 * Avatar de iniciales (8.3).
 *
 * **Es el mismo círculo en el pie de los shells y en las tarjetas de identidad.** El pie del
 * armazón de cada sección y la ficha de perfil muestran las iniciales de la persona, y si cada
 * uno escribiera su círculo, uno salía con el tamaño del texto y el otro con el del párrafo.
 *
 * **Solo iniciales.** Es lo que tienen los datos del cliente y lo que muestran los pies del
 * prototipo; una foto es un dato que nadie registró.
 *
 * **El color es el del acento donde esté.** El círculo ya no trae un fondo fijo: lo pinta la
 * regla de `[data-ui='avatar']` de `index.css`, que sigue al `data-acento` del shell. Así el
 * avatar del lateral de Alumno es dorado y el de Docente es verde sin que ninguna pantalla
 * elija el color.
 */
const TAMANOS = Object.freeze({
  chico: 'h-7 w-7 text-xs',
  grande: 'h-12 w-12 text-lg',
})

export function Avatar({ iniciales, tamano = 'chico' }) {
  return (
    <span
      {...{ [MARCA_UI]: 'avatar' }}
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-inset ring-black/5 ${TAMANOS[tamano]}`}
    >
      {iniciales}
    </span>
  )
}
