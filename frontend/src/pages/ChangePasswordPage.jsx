import { useState } from 'react'
import { Navigate } from 'react-router'
import { AuthError } from '../auth/authClient'
import { SESSION_STATUS, useSession } from '../auth/SessionContext'
import { LOGIN_PATH, homePathForRole } from '../auth/roleRoutes'
import { LoadingPage } from './LoadingPage'

const UNEXPECTED_ERROR_MESSAGE = 'No pudimos cambiar la contraseña. Probá de nuevo.'
const MIN_LENGTH = 8

/**
 * Cambio obligatorio de contraseña en el primer ingreso (D45).
 *
 * **Es una pantalla y no un aviso.** La cuenta que el administrador acaba de crear entra con la
 * contraseña inicial y no puede usar nada más: el backend responde 403 en todas las rutas de rol
 * hasta que la cambie. Esta pantalla es el único camino para salir de ese estado.
 *
 * **Reutiliza la identidad visual del login** —misma tarjeta, mismos campos y mismo botón— para
 * no inventar un estilo nuevo en un flujo de dos pasos.
 */
export function ChangePasswordPage() {
  const { status, session, changePassword } = useSession()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === SESSION_STATUS.LOADING) {
    return <LoadingPage />
  }

  if (status === SESSION_STATUS.ANONYMOUS) {
    return <Navigate to={LOGIN_PATH} replace />
  }

  if (!session.must_change_password) {
    return <Navigate to={homePathForRole(session.rol)} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)

    if (newPassword.length < MIN_LENGTH) {
      setError(`La contraseña nueva tiene que tener al menos ${MIN_LENGTH} caracteres.`)
      return
    }
    if (newPassword === currentPassword) {
      setError('La contraseña nueva tiene que ser distinta de la actual.')
      return
    }
    if (newPassword !== confirmation) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }

    setSubmitting(true)
    try {
      await changePassword({ currentPassword, newPassword })
    } catch (authError) {
      setError(authError instanceof AuthError ? authError.message : UNEXPECTED_ERROR_MESSAGE)
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Cambiá tu contraseña</h1>
        <p className="mt-1 text-sm text-slate-600">
          Es tu primer ingreso. Antes de usar el sistema tenés que reemplazar la contraseña inicial
          que te entregó Secretaría.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-slate-700">
              Contraseña actual
            </label>
            <input
              id="current-password"
              name="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="foco-acento mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
              Contraseña nueva
            </label>
            <input
              id="new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="foco-acento mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="password-confirmation"
              className="block text-sm font-medium text-slate-700"
            >
              Repetí la contraseña nueva
            </label>
            <input
              id="password-confirmation"
              name="password-confirmation"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="foco-acento mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>

          {error !== null && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="boton-primario foco-acento w-full rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60"
          >
            {submitting ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </main>
  )
}
