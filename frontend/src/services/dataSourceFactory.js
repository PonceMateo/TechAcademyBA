import { createApiDataSource } from './apiDataSource'
import { createMockDataSource } from './mockDataSource'

/**
 * Fábrica de la frontera de datos (D13).
 *
 * **Este archivo es el punto de cambio de la aplicación.** Las pantallas piden datos al servicio y
 * no saben de dónde salen; acá se decide qué implementación responde, sin que se toque ni un
 * componente. Ese es el punto entero de que los datos vivan detrás de una frontera asíncrona.
 *
 * **En ejecución la fuente es siempre la API real.** El modo por omisión es `api` y la aplicación
 * no ofrece ningún modo de datos de ejemplo seleccionable desde su entorno (D42). Los mocks y el
 * modo `mock` quedan solo como infraestructura de test: los piden explícitamente
 * `test/setup.js` y `test/support.jsx`.
 */
export const API_MODE = Object.freeze({
  MOCK: 'mock',
  API: 'api',
})

const IMPLEMENTACIONES = Object.freeze({
  [API_MODE.MOCK]: createMockDataSource,
  [API_MODE.API]: createApiDataSource,
})

export function createDataSource({
  modo = API_MODE.API,
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
