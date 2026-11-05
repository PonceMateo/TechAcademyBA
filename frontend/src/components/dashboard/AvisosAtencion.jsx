import { Link } from 'react-router'
import { AlertCircle, ChevronRight } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { TONO } from '../ui/paleta'

/**
 * Panel de avisos de la campana del armazón (H/U 55, 56 y 57).
 *
 * **Solo aparece lo que tiene cantidad y destino.** Un aviso sin número o sin ruta no se dibuja:
 * el prototipo mostraba líneas inertes y este bloque existe para que lo que se ve se pueda abrir.
 * Cuando no hay ninguno, el bloque no desaparece: muestra el mensaje de que no hay nada pendiente.
 */
export function AvisosAtencion({ avisos = [], vacio = 'No tenés nada pendiente por revisar.' }) {
  if (avisos.length === 0) {
    return (
      <p className="flex items-start gap-2 text-sm text-[var(--texto-etiqueta)]">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {vacio}
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {avisos.map((aviso) => (
        <li key={aviso.texto}>
          <Link
            to={aviso.ruta}
            className="foco-acento flex items-center justify-between gap-3 rounded-xl bg-[var(--superficie-interna)] px-3 py-2 transition hover:brightness-[0.98]"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--texto-valor)]">
                {aviso.texto}
              </span>
              {aviso.detalle && (
                <span className="mt-0.5 block text-xs text-[var(--texto-apoyo)]">
                  {aviso.detalle}
                </span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <Badge tono={TONO.AMBAR}>{aviso.cantidad}</Badge>
              <ChevronRight
                className="h-4 w-4 text-[var(--texto-etiqueta)]"
                aria-hidden="true"
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
