/**
 * Causas de bloqueo que produce derivar_estado (HU 61).
 *
 * Solo las causas reales que el backend devuelve para una inscripción activa.
 * No se inventan; la causa desconocida se muestra tal cual llega.
 */
export const CAUSAS_BLOQUEO = {
  'falta la empresa': 'No está registrada la empresa de la inscripción corporativa.',
  'empresa impaga': 'La empresa no acreditó los pagos correspondientes.',
  'pago pendiente': 'No hay comprobantes de pago acreditados para esta inscripción.',
  'saldo pendiente': 'Hay pagos acreditados pero no cubren el arancel requerido.',
  'comprobante observado': 'Hay comprobantes observados que impiden acreditar el pago.',
  'comprobante rechazado': 'Hay comprobantes rechazados que impiden acreditar el pago.',
}

export function textoCausa(causa) {
  return CAUSAS_BLOQUEO[causa] ?? causa
}
