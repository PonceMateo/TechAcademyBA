import { API_BASE_URL } from '../config/api'

/**
 * Cliente HTTP del backend. Es **la única llamada de red que hace la interfaz** (D14):
 * autenticar y leer la sesión. El resto de las pantallas consume `src/services/`, que es
 * la frontera de datos de D13 y llega con el grupo 8.
 *
 * Las formas que se consumen acá son exactamente las del backend:
 *
 * - `POST /auth/login` con `{"email", "password"}` (M9) responde `access_token`,
 *   `token_type`, `user_id`, `rol` y `must_change_password`.
 * - `GET /auth/me` con `Authorization: Bearer <token>` responde `id`, `email`, `rol`,
 *   `nombre` y `must_change_password`.
 *
 * **Por qué el mensaje de error viene del backend:** el texto "Credenciales inválidas." es
 * el mismo para un correo inexistente y para una contraseña incorrecta, a propósito, para
 * no confirmar qué correos están registrados (5.5). Si el frontend lo escribiera por su
 * cuenta, habría dos textos que mantener iguales.
 */

/** Fallback cuando la respuesta no trae un `detail` legible. */
export const CREDENTIALS_ERROR_MESSAGE = 'No pudimos validar tus credenciales.'
export const SESSION_ERROR_MESSAGE = 'Tu sesión ya no está vigente.'
export const CONNECTION_ERROR_MESSAGE = 'No pudimos conectar con el servidor.'

export class AuthError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'AuthError'
    /** Código HTTP de la respuesta, o 0 cuando la petición ni siquiera llegó. */
    this.status = status
  }
}

/** El backend responde `{"detail": "..."}` en los errores que él mismo define. */
async function readErrorDetail(response, fallback) {
  try {
    const body = await response.json()
    if (typeof body?.detail === 'string' && body.detail.length > 0) {
      return body.detail
    }
  } catch {
    // El cuerpo no era JSON: nos quedamos con el texto de reserva.
  }
  return fallback
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch {
    // `fetch` solo rechaza cuando la petición no llegó: proxy caído o backend apagado.
    throw new AuthError(CONNECTION_ERROR_MESSAGE)
  }

  if (!response.ok) {
    const fallback = path.endsWith('/login') ? CREDENTIALS_ERROR_MESSAGE : SESSION_ERROR_MESSAGE
    throw new AuthError(await readErrorDetail(response, fallback), response.status)
  }

  return response.json()
}

/**
 * Autentica con email y contraseña.
 *
 * @throws {AuthError} 401 con el mensaje genérico del backend cuando las credenciales no
 * sirven, o el texto de conexión cuando el backend no contesta.
 */
export function login({ email, password }) {
  return request('/auth/login', { method: 'POST', body: { email, password } })
}

/**
 * Devuelve la identidad de quien llama.
 *
 * M7: el token solo afirma la identidad; el rol que manda es el de la fila. Por eso esta
 * llamada, y no el claim del token, es la que define la sesión.
 *
 * @throws {AuthError} 401 cuando el token falta, no valida o venció.
 */
export function fetchCurrentSession(token) {
  return request('/auth/me', { token })
}
