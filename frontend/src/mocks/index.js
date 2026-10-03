/**
 * Datos de ejemplo del maquetado (D22).
 *
 * **Este módulo es la última palabra sobre dónde no se importa.** D13 deja a `src/services/` como
 * la única frontera de datos del frontend, así que ninguna pantalla importa de acá: pide los
 * datos al servicio y el servicio elige esta implementación o la real. `mocksBoundary.test.js` lo
 * verifica sobre el código, no sobre la confianza.
 *
 * Para qué están los datos si nadie los importa directo: la fábrica de `src/services/` los carga
 * cuando `VITE_API_MODE` es `mock`, que es el valor por defecto del entorno de desarrollo.
 *
 * Todos los datos son de ejemplo. Ninguno es dato de negocio y ninguno implica que la
 * información del cliente ya se haya migrado.
 */
export { CATALOGO_TOTAL_COMISIONES, COMISIONES, SEDES } from './comisiones'
export { COBRANZAS, DESTINO_IMPUTACION } from './cobranzas'
export { ALUMNOS } from './alumnos'
export { DOCENTES } from './docentes'
export { EMPRESAS } from './empresas'
export { IS_PLACEHOLDER_DATA, PLACEHOLDER_DATA_NOTICE } from './placeholderNotice'
