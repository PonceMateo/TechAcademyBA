/**
 * Origen del backend para el navegador.
 *
 * **Por qué la misma ruta que usa la aplicación y no una constante escrita a mano:** el
 * servidor de desarrollo de Vite hace proxy de `/api` hacia el backend (D14), así que en
 * desarrollo el navegador nunca cruza de origen. `docker-compose.yml` publica
 * `VITE_API_BASE_URL` y el proxy se configura en `vite.config.js`.
 *
 * **Por qué la usa solo el cliente de autenticación:** D14 deja una única llamada de red,
 * el login. El resto de las pantallas consume `src/services/`, que es la frontera de
 * datos de D13 y llega con el grupo 8. Esa capa no se resuelve con esta constante.
 */
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL

export const API_BASE_URL = (configuredBaseUrl || '/api').replace(/\/+$/, '')
