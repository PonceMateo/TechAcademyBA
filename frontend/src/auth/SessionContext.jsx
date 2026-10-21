import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { changePassword as changePasswordRequest, fetchCurrentSession, login } from './authClient'
import { CHANGE_PASSWORD_PATH, LOGIN_PATH, homePathForRole } from './roleRoutes'
import { clearStoredToken, readStoredToken, storeToken } from './tokenStorage'

/**
 * Contexto de sesión: quién está entrando y cómo se entra y se sale (7.2, 7.3).
 *
 * **Por qué el login real y el resto datos de ejemplo conviven acá:** D14 deja una sola
 * llamada de red, el login. Este contexto es el dueño de esa llamada y del token. Las
 * pantallas no lo tocan: leen de acá, y la capa `src/services/` de D13 llega en el
 * grupo 8.
 *
 * **Por qué el contexto navega y no devuelve la ruta:** la redirección por rol es una
 * regla del proyecto, no una decisión de cada pantalla (7.3). Si el contexto no la
 * aplica, los tres shells de los grupos 9, 10 y 11 podrían cerrarse sin volver al login
 * y nadie lo notaría hasta probarlo a mano. Por eso `SessionProvider` va **dentro** del
 * router: los tests lo montan con `MemoryRouter`.
 *
 * **El token no es la autoridad:** el backend resuelve la cuenta contra la base en cada
 * request (M7). Guardar el token es para no perder la sesión al recargar, no para decidir
 * permisos: eso es de la ruta protegida y, en última instancia, del backend.
 */
export const SESSION_STATUS = Object.freeze({
  LOADING: 'loading',
  AUTHENTICATED: 'authenticated',
  ANONYMOUS: 'anonymous',
})

const ANONYMOUS_STATE = { status: SESSION_STATUS.ANONYMOUS, session: null }

/**
 * Se resuelve en el inicializador y no en un efecto: sin token no hay nada que esperar, y
 * entrar a `/` no tiene que mostrar un cartel de carga para volver al login.
 */
function readInitialState() {
  return readStoredToken() ? { status: SESSION_STATUS.LOADING, session: null } : ANONYMOUS_STATE
}

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const navigate = useNavigate()
  const [state, setState] = useState(readInitialState)

  useEffect(() => {
    const token = readStoredToken()
    if (!token) {
      return undefined
    }

    // Recargar no cierra la sesión: se relee la identidad desde el backend. Si el token ya
    // no sirve —venció, se dio de baja la cuenta— se descarta y se queda anónimo.
    let active = true
    fetchCurrentSession(token)
      .then((session) => {
        if (active) {
          setState({ status: SESSION_STATUS.AUTHENTICATED, session })
        }
      })
      .catch(() => {
        if (active) {
          clearStoredToken()
          setState(ANONYMOUS_STATE)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const signIn = useCallback(
    async (credentials) => {
      // El token se guarda recién después de que `GET /auth/me` respondió: si las
      // credenciales fallan, o si la sesión no se puede leer, no queda nada guardado.
      const result = await login(credentials)
      const session = await fetchCurrentSession(result.access_token)
      storeToken(result.access_token)
      setState({ status: SESSION_STATUS.AUTHENTICATED, session })
      // D45: una cuenta pendiente no entra a su sección; va directo al cambio obligatorio.
      navigate(session.must_change_password ? CHANGE_PASSWORD_PATH : homePathForRole(session.rol), {
        replace: true,
      })
      return session
    },
    [navigate],
  )

  /**
   * Cambia la contraseña y actualiza la sesión en memoria (D45).
   *
   * La respuesta del backend ya trae `must_change_password` en `false`, así que no hace falta
   * releer el `/auth/me`. Recién después de esto la cuenta puede entrar a su sección.
   */
  const changePassword = useCallback(
    async ({ currentPassword, newPassword }) => {
      const token = readStoredToken()
      if (!token || !state.session) {
        throw new Error('No hay una sesión para cambiar la contraseña.')
      }

      const session = await changePasswordRequest({
        token,
        currentPassword,
        newPassword,
      })
      setState({ status: SESSION_STATUS.AUTHENTICATED, session })
      navigate(homePathForRole(session.rol), { replace: true })
      return session
    },
    [navigate, state.session],
  )

  const signOut = useCallback(() => {
    clearStoredToken()
    setState(ANONYMOUS_STATE)
    navigate(LOGIN_PATH, { replace: true })
  }, [navigate])

  const value = useMemo(
    () => ({ status: state.status, session: state.session, signIn, changePassword, signOut }),
    [state.status, state.session, signIn, changePassword, signOut],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = useContext(SessionContext)
  if (context === null) {
    throw new Error('useSession se usó fuera de <SessionProvider>.')
  }
  return context
}
