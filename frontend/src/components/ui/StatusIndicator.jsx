import { Badge } from './Badge'
import { ESTADO_HABILITACION } from '../../domain/enums'
import { MARCA_UI, TONO } from './paleta'

/**
 * Indicador de acceso a la plataforma (8.3).
 *
 * **Es el componente que hace visible la diferencia entre "no pagó" y "no se pudo leer el
 * comprobante".** El prototipo muestra `BLOQUEADO` sin más; el modelo deriva el estado de la
 * situación arancelaria y guarda la causa (D9 y D28), así que el estado bloqueado sin texto al
 * lado es una pérdida de información que el cliente pidió poder distinguir.
 *
 * Por eso el bloqueado exige la causa y no es opcional: `causa` es obligatoria en el modelo cuando
 * el comprobante no está acreditado, y una fila bloqueada sin causa sería un dato que la base
 * real no puede contener.
 */
const TONOS_POR_ESTADO = {
  [ESTADO_HABILITACION.HABILITADO]: TONO.VERDE,
  [ESTADO_HABILITACION.BLOQUEADO]: TONO.ROJO,
}

export function StatusIndicator({ estado, causa = null, habilitadoTexto = null }) {
  const bloqueado = estado === ESTADO_HABILITACION.BLOQUEADO

  if (bloqueado && (causa === null || causa === '')) {
    throw new Error(
      'StatusIndicator con estado BLOQUEADO necesita la causa: un bloqueo sin causa es exactamente el dato que el cliente pidió poder distinguir.',
    )
  }

  return (
    <span
      {...{ [MARCA_UI]: 'status-indicator' }}
      className="inline-flex flex-col items-start gap-1"
    >
      <Badge tono={TONOS_POR_ESTADO[estado] ?? TONO.GRIS}>{estado}</Badge>
      {bloqueado ? (
        <span className="text-xs text-red-700">{causa}</span>
      ) : (
        habilitadoTexto !== null && (
          <span className="text-xs text-slate-500">{habilitadoTexto}</span>
        )
      )}
    </span>
  )
}
