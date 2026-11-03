import { Badge } from './Badge'
import { ESTADO_HABILITACION } from '../../domain/enums'
import { MARCA_UI, TONO } from './paleta'

const TONOS_POR_ESTADO = {
  [ESTADO_HABILITACION.HABILITADO]: TONO.VERDE,
  [ESTADO_HABILITACION.BLOQUEADO]: TONO.ROJO,
}

export function StatusIndicator({ estado, causa = null, habilitadoTexto = null, forzado = false, mostrarCausa = true }) {
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
      {bloqueado && mostrarCausa ? (
        <span className="text-xs text-red-700">
          {causa}
          {forzado ? ' (forzado)' : ''}
        </span>
      ) : (
        habilitadoTexto !== null && (
          <span className="text-xs text-slate-500">{habilitadoTexto}</span>
        )
      )}
    </span>
  )
}
