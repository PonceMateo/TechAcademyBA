import { createApiDataSource } from './apiDataSource'
import { createMockDataSource } from './mockDataSource'

/**
 * Fábrica de la frontera de datos (D13).
 *
 * **Este archivo es el punto de cambio de la aplicación.** Las pantallas piden datos al servicio y
 * no saben de dónde salen; acá se decide si salen de `src/mocks/` o del backend, según
 * `VITE_API_MODE`. Cuando aparezca la API real, se cambia la fábrica —o la variable de entorno— y
 * no se toca ni un componente. Ese es el punto entero de que los datos vivan detrás de una
 * frontera asíncrona.
 *
 * **El valor por defecto es `mock`.** D14 deja una sola llamada de red, el login, así que con la
 * variable en `api` las pantallas no tienen nada contra qué pega. `docker-compose.yml` publica
 * `VITE_API_MODE=mock` y `.env.example` la documenta.
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
 * Resuelve el modo desde el entorno. Cualquier valor que no sea `api` es `mock`: es la respuesta
 * segura, porque un valor mal escrito tiene que dejar funcionando el maquetado, no romperlo.
 */
export function resolveApiMode(env = import.meta.env) {
  return env?.VITE_API_MODE === API_MODE.API ? API_MODE.API : API_MODE.MOCK
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
