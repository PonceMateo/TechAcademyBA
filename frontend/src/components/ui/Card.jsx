import { MARCA_UI } from './paleta'

/**
 * Contenedor de bloque (8.3).
 *
 * Los cuatro indicadores del tablero, los bloques de cada pantalla y el resumen de la ficha de
 * habilitación son todos esto: un título, un cuerpo y un borde. Sin un componente común, cada
 * pantalla le pone su propio `rounded-lg bg-white shadow` y en dos pantallas el mismo bloque
 * queda con radios distintos.
 *
 * **El título se muestra tal cual lo pasa la pantalla**, sin transformarlo con `uppercase`: los
 * rótulos del spec de `admin-shell` son literales y en las dos partes —lo que se ve y lo que se
 * copia— tienen que ser el mismo texto.
 */
export function Card({ titulo, descripcion, acciones = null, className = '', children }) {
  return (
    <section
      {...{ [MARCA_UI]: 'card' }}
      className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {(titulo !== null && titulo !== undefined) || acciones !== null ? (
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-3">
          <div>
            {titulo !== null && titulo !== undefined && (
              <h2 className="text-sm font-semibold tracking-wide text-slate-800">{titulo}</h2>
            )}
            {descripcion !== null && descripcion !== undefined && (
              <p className="mt-1 text-xs text-slate-500">{descripcion}</p>
            )}
          </div>
          {acciones}
        </header>
      ) : null}

      <div className="px-4 py-4">{children}</div>
    </section>
  )
}
