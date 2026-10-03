/**
 * Marcas de datos de ejemplo (D22).
 *
 * **Nada de lo que hay en `src/mocks/` es dato de negocio.** Son valores de ejemplo para que el
 * maquetado se pueda leer, derivados de los casos que el cliente cuenta en su primer mail. El
 * objetivo del proyecto es reemplazar la planilla del cliente: si el maquetado mostrara datos
 * que parecen reales, estaría contando que la información ya se migró, y no es así. La
 * secretaría carga los reales cuando el sistema esté funcional.
 *
 * Los valores reconocibles están a propósito —que el cliente se ubique al verlos y detecte
 * errores de criterio—, y por eso el aviso dice que son de ejemplo en lugar de disimularlo.
 */

/** Bandera explícita: el módulo es de datos de ejemplo. */
export const IS_PLACEHOLDER_DATA = true

/** Aviso que las pantallas pueden mostrar y que el maquetado incluye en su documentación. */
export const PLACEHOLDER_DATA_NOTICE =
  'Datos de ejemplo. No son datos reales del instituto: la secretaría carga los reales cuando el sistema esté funcional.'

/**
 * Sella cada registro de ejemplo con `_ejemplo: true`.
 *
 * El sello viaja con el dato a través de la capa de servicios, así que una pantalla que
 * encuentre un registro sin él sabe que está mirando algo que la API real no devolvería. Es lo
 * que hace verificable el "están marcados como tal" de 8.1 sin tener que confiar en un
 * comentario.
 */
export function markAsExample(records) {
  return Object.freeze(records.map((record) => Object.freeze({ ...record, _ejemplo: true })))
}
