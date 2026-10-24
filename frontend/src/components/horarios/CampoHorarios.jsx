import { Button, Campo } from '../ui'
import { resumenHorarios } from '../../domain/horarios'

/**
 * La fila `Días y Horarios` del formulario de comisión (historia #48).
 *
 * **Ocupa el ancho completo del modal y muestra el horario como chips de solo lectura**, uno por
 * grupo de días con igual rango. Los chips se envuelven y no se truncan: un horario recortado con
 * puntos suspensivos no dice qué días se dicta la comisión, que es justo el dato que la secretaría
 * viene a revisar.
 *
 * El botón dice `Agregar horarios` cuando el campo está vacío y `Modificar horarios` cuando ya hay
 * algo, porque son dos acciones distintas: la segunda no arranca de cero. Quien edita y guarda es el
 * selector; este componente solo pinta el estado y avisa que lo abrieron.
 */
export function CampoHorarios({ id, horarios, onAbrir, error }) {
  const chips = resumenHorarios(horarios)

  return (
    <div className="sm:col-span-2">
      <Campo id={id} etiqueta="Días y Horarios" obligatorio error={error}>
        <div className="flex flex-wrap items-center gap-2">
          {chips.length === 0 ? (
            <span className="text-sm text-slate-500">Sin horarios definidos</span>
          ) : (
            chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
              >
                {chip}
              </span>
            ))
          )}
          <Button variante="secundario" tamano="chico" onClick={onAbrir}>
            {chips.length === 0 ? 'Agregar horarios' : 'Modificar horarios'}
          </Button>
        </div>
      </Campo>
    </div>
  )
}
