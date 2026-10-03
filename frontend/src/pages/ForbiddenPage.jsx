import { Link } from 'react-router'
import { SESSION_STATUS, useSession } from '../auth/SessionContext'
import { LOGIN_PATH, homePathForRole } from '../auth/roleRoutes'

/**
 * Pantalla 403 (7.4).
 *
 * Solo la ve alguien que ya se autenticó, así que sí puede decir qué pasó y a dónde ir: el
 * backend usa el mismo criterio en `MENSAJE_SIN_PERMISOS` y en el encabezado
 * `X-Roles-Admitidos`.
 *
 * El enlace de abajo no es decorativo: sale de `homePathForRole`, o sea de la misma tabla
 * que usa la redirección de entrada, para que un usuario rechazado por una sección no
 * quede mirando un error sin salida.
 */
export function ForbiddenPage() {
  const { status, session } = useSession()
  const destination =
    status === SESSION_STATUS.AUTHENTICATED ? homePathForRole(session.rol) : LOGIN_PATH

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 px-4 text-center">
      <p className="text-4xl font-semibold text-slate-900">403</p>
      <h1 className="text-xl font-semibold text-slate-900">No tenés acceso a esta sección</h1>
      <p className="max-w-md text-sm text-slate-600">
        Tu rol no tiene acceso a esta sección. Si creés que debería, hablá con la secretaría.
      </p>
      <Link to={destination} className="text-sm font-medium text-slate-900 underline">
        {status === SESSION_STATUS.AUTHENTICATED ? 'Ir a mi inicio' : 'Iniciar sesión'}
      </Link>
    </main>
  )
}
