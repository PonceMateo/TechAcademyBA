import { Card } from '../ui/Card'

/**
 * Tarjeta de indicador de los tres tableros (H/U 55, 56 y 57).
 *
 * El rótulo y el valor usan los tokens de superficie del rol, así que la misma tarjeta se ve azul
 * en Secretaría, verde en Docente y dorada en Alumno sin que la pantalla elija un color. `valor`
 * acepta texto o un nodo —el acceso del alumno es un `Badge`— y `apoyo` queda vacío cuando no hay
 * contexto que mostrar, en vez de dejar una línea en blanco.
 */
export function Indicador({ rotulo, valor, apoyo = null, icono: Icono = null }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-wide text-[var(--texto-etiqueta)] uppercase">
          {rotulo}
        </p>
        {Icono !== null && (
          <Icono className="h-4 w-4 shrink-0 text-[var(--texto-apoyo)]" aria-hidden="true" />
        )}
      </div>
      <div className="mt-2 text-3xl font-extrabold text-[var(--texto-valor)]">{valor}</div>
      {apoyo !== null && apoyo !== '' && (
        <p className="mt-1 text-xs text-[var(--texto-apoyo)]">{apoyo}</p>
      )}
    </Card>
  )
}
