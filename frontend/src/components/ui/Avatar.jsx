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
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-slate-900 font-semibold text-white ${TAMANOS[tamano]}`}
    >
      {iniciales}
    </span>
  )
}
