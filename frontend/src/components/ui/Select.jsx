import { useState } from 'react'
import { MARCA_UI } from './paleta'

/**
 * Selector de una sola opción (HU 61).
 *
 * **Es un combobox, no un `<select>`.** La ficha del alumno necesita que `Escape` cierre primero el
 * desplegable sin cerrar el modal que lo contiene, y un `<select>` nativo no permite decidir eso.
 * Por eso el foco queda en el botón, la opción activa se anuncia con `aria-activedescendant` y el
 * desplegable se cierra con `Escape`, con `Tab` y con un click afuera.
 *
 * **El click afuera no cierra el modal de atrás.** Mientras el desplegable está abierto hay una capa
 * invisible que atrapa ese primer click y detiene la propagación: el modal que lo contiene recién
 * se cierra en el click siguiente.
 *
 * `opciones` es `[{ valor, etiqueta }]` y `valor` es el de la opción elegida.
 */
export function Select({ id, etiqueta, opciones, valor, onChange, className = '' }) {
  const [abierto, setAbierto] = useState(false)
  const [activa, setActiva] = useState(0)

  const indiceElegido = Math.max(
    opciones.findIndex((opcion) => opcion.valor === valor),
    0,
  )
  const elegida = opciones[indiceElegido] ?? null
  const idLista = `${id}-lista`
  const idEtiqueta = `${id}-etiqueta`

  function abrir() {
    setActiva(indiceElegido)
    setAbierto(true)
  }

  function cerrar() {
    setAbierto(false)
  }

  function elegir(opcion) {
    onChange(opcion.valor)
    cerrar()
  }

  function alPresionarTecla(evento) {
    if (evento.key === 'Escape' && abierto) {
      // El modal de atrás no se entera: primero se cierra el desplegable.
      evento.stopPropagation()
      evento.preventDefault()
      cerrar()
      return
    }

    if (evento.key === 'Tab') {
      cerrar()
      return
    }

    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault()
      if (!abierto) {
        abrir()
        return
      }
      const paso = evento.key === 'ArrowDown' ? 1 : -1
      setActiva((indice) => (indice + paso + opciones.length) % opciones.length)
      return
    }

    if (evento.key === 'Home' || evento.key === 'End') {
      if (!abierto) {
        return
      }
      evento.preventDefault()
      setActiva(evento.key === 'Home' ? 0 : opciones.length - 1)
      return
    }

    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault()
      if (!abierto) {
        abrir()
        return
      }
      const opcion = opciones[activa]
      if (opcion !== undefined) {
        elegir(opcion)
      }
    }
  }

  return (
    <div {...{ [MARCA_UI]: 'select' }} className={`relative ${className}`}>
      {etiqueta !== undefined && (
        <span id={idEtiqueta} className="mb-1 block text-sm font-medium text-slate-700">
          {etiqueta}
        </span>
      )}

      <button
        type="button"
        id={id}
        role="combobox"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-haspopup="listbox"
        aria-labelledby={etiqueta !== undefined ? `${idEtiqueta} ${id}` : undefined}
        aria-activedescendant={abierto ? `${idLista}-${activa}` : undefined}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={alPresionarTecla}
        className="foco-acento flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50"
      >
        <span>{elegida?.etiqueta ?? ''}</span>
        <span aria-hidden="true" className="text-slate-500">
          ▾
        </span>
      </button>

      {abierto && (
        <>
          <div
            className="fixed inset-0 z-10"
            onMouseDown={(evento) => {
              evento.stopPropagation()
              cerrar()
            }}
          />
          <ul
            id={idLista}
            role="listbox"
            aria-labelledby={etiqueta !== undefined ? idEtiqueta : undefined}
            className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {opciones.map((opcion, indice) => (
              <li
                key={opcion.valor}
                id={`${idLista}-${indice}`}
                role="option"
                aria-selected={indice === indiceElegido}
                onMouseDown={(evento) => {
                  evento.preventDefault()
                  evento.stopPropagation()
                  elegir(opcion)
                }}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  indice === activa ? 'bg-slate-100 text-slate-900' : 'text-slate-700'
                }`}
              >
                {opcion.etiqueta}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
