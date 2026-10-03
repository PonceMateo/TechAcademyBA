/**
 * Enums del dominio, replicados del backend (D23).
 *
 * **Por qué una copia y no una importación:** el frontend es JavaScript y el backend es
 * Python, así que no hay nada que importar. Lo que hay es una fuente de verdad: el enum del
 * backend es la autoridad y no los rótulos del Excel del cliente. Este módulo existe para que
 * el frontend tenga los mismos nombres de valor y no invente variantes.
 *
 * Cuando aparezca la API real, estos valores dejan de ser necesarios para los mocks: pasan a
 * ser los que devuelve el servidor. Hasta entonces, el mock los expone con la misma forma
 * que usará la API (D13), así que un cambio acá y un cambio allá se ven juntos en el diff.
 *
 * El código de cada valor es el del enum de Python, con el prefijo que lo distingue, y el
 * nombre de la miembro va sin tildes y en `SCREAMING_SNAKE_CASE` porque es lo que viaja en el
 * JSON. La forma visible en pantalla la decide cada pantalla, no este archivo.
 */
export const MODALIDAD = Object.freeze({
  VIRTUAL: 'VIRTUAL',
  PRESENCIAL: 'PRESENCIAL',
  HIBRIDO: 'HIBRIDO',
})

export const CATEGORIA_INSCRIPCION = Object.freeze({
  PARTICULAR: 'PARTICULAR',
  BECADO_PARCIAL: 'BECADO_PARCIAL',
  BECADO_TOTAL: 'BECADO_TOTAL',
  CORPORATIVO: 'CORPORATIVO',
})

export const ESTADO_HABILITACION = Object.freeze({
  HABILITADO: 'HABILITADO',
  BLOQUEADO: 'BLOQUEADO',
})

export const ESTADO_COBRANZA = Object.freeze({
  ACREDITADO: 'ACREDITADO',
  OBSERVADO: 'OBSERVADO',
  RECHAZADO: 'RECHAZADO',
})

export const MEDIO_PAGO = Object.freeze({
  TRANSFERENCIA: 'TRANSFERENCIA',
  EFECTIVO: 'EFECTIVO',
  CHEQUE: 'CHEQUE',
  TARJETA: 'TARJETA',
  BILLETERA: 'BILLETERA',
  OTRO: 'OTRO',
})

export const TIPO_FACTURA = Object.freeze({
  A: 'A',
  B: 'B',
})

export const TIPO_DOCUMENTO = Object.freeze({
  DNI: 'DNI',
  PASAPORTE: 'PASAPORTE',
})

/**
 * Etiquetas de medio de pago. El spec de `admin-shell` obliga a que el formulario y la
 * columna `MEDIO` del historial usen **el mismo** conjunto de rótulos, tomado del dominio: el
 * prototipo los rotulaba distinto en los dos lugares y eso se resolvió a favor del vocabulario
 * del dominio. Un solo lugar para los dos, entonces.
 */
export const MEDIO_PAGO_LABELS = Object.freeze({
  TRANSFERENCIA: 'Transferencia',
  EFECTIVO: 'Efectivo',
  CHEQUE: 'Cheque',
  TARJETA: 'Tarjeta',
  BILLETERA: 'Billetera',
  OTRO: 'Otro',
})
