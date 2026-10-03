import { Navigate } from 'react-router'
import { LoadingPage } from '../pages/LoadingPage'
import { FORBIDDEN_PATH, LOGIN_PATH } from './roleRoutes'
import { SESSION_STATUS, useSession } from './SessionContext'

/**
 * Envuelve una sección y declara qué roles la atraviesan (7.4).
 *
 * **Esto oculta rutas, no protege nada.** El frontend no es una frontera de seguridad: la
 * autorización es del backend, que devuelve 401 sin sesión y 403 para un rol que no está
 * entre los admitidos. Lo que hace esta función es no dejar ver al usuario una pantalla
 * que su rol no tiene, y no dejarle una pantalla a medio cargar mientras se resuelve la
 * sesión.
 *
 * - Sin sesión todavía resuelta: la pantalla de carga. Recién ahí se puede decir a dónde
 *   va.
 * - Sin sesión: al login. Nunca a la sección, aunque la URL diga lo contrario.
 * - Con sesión de otro rol: a la pantalla 403, con su propia ruta.
 */
export function RequireRole({ allowedRoles, children }) {
  const { status, session } = useSession()

  if (status === SESSION_STATUS.LOADING) {
    return <LoadingPage />
  }

  if (status === SESSION_STATUS.ANONYMOUS) {
    return <Navigate to={LOGIN_PATH} replace />
  }

  if (!allowedRoles.includes(session.rol)) {
    return <Navigate to={FORBIDDEN_PATH} replace />
  }

  return children
}
