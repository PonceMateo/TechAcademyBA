import { createApiDataSource } from './apiDataSource'
import { createMockDataSource } from './mockDataSource'

/**
 * Fábrica de la frontera de datos (D13).
 *
 * **Este archivo es el punto de cambio de la aplicación.** Las pantallas piden datos al servicio y
 * no saben de dónde salen; acá se decide si salen de `src/mocks/` o del backend, según
 * `VITE_API_MODE`. El modo se cambia acá —o con la variable de entorno— y no se toca ni un
 * componente. Ese es el punto entero de que los datos vivan detrás de una frontera asíncrona.
 *
 * **El valor por defecto es `api`.** D14 dejó el maquetado como valor por defecto porque el
 * frontend hacía una sola llamada de red, el login. El change `altas-catalogo-docentes` escribió
 * los primeros endpoints reales y subió el modo real a omisión, así que la aplicación ahora
 * guarda de verdad.
 *
 * **Lo que todavía no tiene endpoint cae al ejemplo, no al revés.** Lo resuelve
 * `apiDataSource.js`, y solo para las lecturas y solo con un 404: los shells de alumno y docente
 * y las pantallas de alumnos, cobranzas y habilitación siguen mostrando el ejemplo hasta que
 * existan sus endpoints.
 */
export const API_MODE = Object.freeze({
  MOCK: 'mock',
  API: 'api',
})

const IMPLEMENTACIONES = Object.freeze({
  [API_MODE.MOCK]: createMockDataSource,
  [API_MODE.API]: createApiDataSource,
})

/**
 * Resuelve el modo desde el entorno. **`api` es el valor por omisión y `mock` hay que pedirlo.**
 *
 * La asimetría es deliberada: el default real hace que las altas se guarden, que es lo que la
 * secretaría necesita para trabajar (D36). Un valor mal escrito cae en `api` y no en `mock`
 * porque el error de un default que no guarda es invisible hasta que alguien pierde un día de
 * carga, mientras que el de una pantalla vacía se ve enseguida.
 */
export function resolveApiMode(env = import.meta.env) {
  return env?.VITE_API_MODE === API_MODE.MOCK ? API_MODE.MOCK : API_MODE.API
}

export function createDataSource({
  modo = resolveApiMode(),
  implementaciones = IMPLEMENTACIONES,
} = {}) {
  const crear = implementaciones[modo]
  if (crear === undefined) {
    throw new Error(
      `No hay implementación de datos para el modo "${modo}". Admitidos: ${Object.keys(implementaciones).join(', ')}.`,
    )
  }
  return crear()
}

/**
 * Fuente de datos en uso, una sola por aplicación.
 *
 * Existe como módulo y no como contexto porque el objetivo es que cambiar de implementación no
 * obligue a tocar los componentes: si el servicio tomara la fuente por parámetro, cada pantalla
 * tendría que resolverla y el acoplamiento volvería por la puerta de atrás.
 *
 * `configurarFuenteDeDatos` existe para los tests y para el día que el origen deje de ser una
 * variable de entorno. Nadie más la llama.
 */
let fuenteDeDatos = createDataSource()

export function getDataSource() {
  return fuenteDeDatos
}

export function configurarFuenteDeDatos(fuente) {
  fuenteDeDatos = fuente
  return fuenteDeDatos
}
