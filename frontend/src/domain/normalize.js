/**
 * Normalización de códigos y documentos (D6).
 *
 * El modelo no es tolerante a formato en la base: guarda el valor tal como lo escribe el
 * operador en `codigo` y, aparte, una forma normalizada en `codigo_norm` con el índice único.
 * `CUR-101` y `CUR101` son la misma comisión, y la segunda forma tiene que colisionar con la
 * primera.
 *
 * Estas funciones son esa normalización del lado del frontend. Sirven para dos cosas del
 * maquetado: deduplicar los datos de ejemplo por código normalizado y comprobar que los mocks
 * no traigan dos filas que la base real no aceptaría.
 *
 * **No son la validación del backend.** El backend es la autoridad y valida en la base; esto
 * es el mismo criterio, para no mostrar en pantalla algo que después rebotaría.
 */

/**
 * Deja solo letras y números, en mayúscula: `cur-101` → `CUR101`.
 *
 * No hace falta descomponer los acentos: los caracteres acentuados no son alfanuméricos y
 * desaparecen igual que los signos.
 */
export function normalizeCode(value) {
  return String(value ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
}

/**
 * Documento normalizado: los puntos y los guiones desaparecen. `38.456.789` y `38456789` son
 * el mismo documento, igual que en la base.
 */
export function normalizeDocumento(value) {
  return String(value ?? '')
    .replace(/[^0-9A-Za-z]/g, '')
    .toUpperCase()
}

/** CUIT normalizado a once dígitos: `30-71665544-9` → `30716655449`. */
export function normalizeCuit(value) {
  return String(value ?? '').replace(/\D/g, '')
}
