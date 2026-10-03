import { useState } from 'react'
import { Navigate } from 'react-router'
import { AuthError } from '../auth/authClient'
import { SESSION_STATUS, useSession } from '../auth/SessionContext'
import { homePathForRole } from '../auth/roleRoutes'

/**
 * Aviso informativo del patrón único de login del prototipo (desviación 12 de
 * `design.md`: el prototipo tenía dos variantes del botón, una de pantalla completa y otra
 * compacta; acá hay una sola pantalla con un solo botón).
 */
const DEMO_NOTICE = 'Las cuentas de demostración y sus contraseñas están en el README del proyecto.'

const UNEXPECTED_ERROR_MESSAGE = 'No pudimos iniciar sesión. Probá de nuevo.'

/**
 * Pantalla de acceso (7.5).
 *
 * **Sin selector de rol, a propósito.** El rol sale de la cuenta, no de lo que elija
 * quien entra: mandarlo en el pedido sería permitir que un usuario pida ser otro, y el
 * backend no lo lee. Es además la desviación 12 del prototipo.
 *
 * **El mensaje de error es el del backend** (`AuthError.message`), que es el mismo para un
 * correo inexistente y para una contraseña incorrecta.
 */
export function LoginPage() {
  const { status, session, signIn } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      // `signIn` guarda la sesión y redirige según el rol; si falla, no guarda nada.
      await signIn({ email, password })
    } catch (authError) {
      setError(authError instanceof AuthError ? authError.message : UNEXPECTED_ERROR_MESSAGE)
      // El correo se conserva para no hacer escribirlo de nuevo; la contraseña se borra,
      // porque dejarla cargada invita a volver a apretar el mismo botón.
      setPassword('')
      setSubmitting(false)
    }
  }

  if (status === SESSION_STATUS.AUTHENTICATED) {
    return <Navigate to={homePathForRole(session.rol)} replace />
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        <h1 className="text-2xl font-semibold text-slate-900">TechAcademy BA</h1>
        <p className="mt-1 text-sm text-slate-600">Ingresá con tu correo y tu contraseña.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-6 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {DEMO_NOTICE}
        </p>
      </div>
    </main>
  )
}
