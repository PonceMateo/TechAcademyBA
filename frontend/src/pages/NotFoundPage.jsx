import { Link } from 'react-router'
import { SESSION_STATUS, useSession } from '../auth/SessionContext'
import { LOGIN_PATH, homePathForRole } from '../auth/roleRoutes'

/**
 * Pantalla 404 (7.4). La captura la ruta `*` de la tabla de ruteo.
 *
 * La ruta inexistente **no** se distingue de la que existe pero no se puede ver: acá no se
 * filtra nada, el 404 no revela si lo que se pidió estaba ahí. Lo que protege el backend es
 * otra cosa, y lo hace con 401 sin mencionar el recurso.
 */
export function NotFoundPage() {
  const { status, session } = useSession()
  const destination =
    status === SESSION_STATUS.AUTHENTICATED ? homePathForRole(session.rol) : LOGIN_PATH

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 px-4 text-center">
      <p className="text-4xl font-semibold text-slate-900">404</p>
      <h1 className="text-xl font-semibold text-slate-900">No encontramos esa página</h1>
      <p className="max-w-md text-sm text-slate-600">
        La dirección no existe o todavía no tiene una pantalla.
      </p>
      <Link to={destination} className="foco-acento rounded text-sm font-medium text-slate-900 underline">
        {status === SESSION_STATUS.AUTHENTICATED ? 'Ir a mi inicio' : 'Iniciar sesión'}
      </Link>
    </main>
  )
}
