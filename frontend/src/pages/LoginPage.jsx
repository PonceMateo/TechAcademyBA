import { useState } from 'react'
import { Navigate } from 'react-router'
import { GraduationCap } from 'lucide-react'
import { AuthError } from '../auth/authClient'
import { SESSION_STATUS, useSession } from '../auth/SessionContext'
import { CHANGE_PASSWORD_PATH, homePathForRole } from '../auth/roleRoutes'
import { Button, Card, Input } from '../components/ui'

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
    return (
      <Navigate
        to={session.must_change_password ? CHANGE_PASSWORD_PATH : homePathForRole(session.rol)}
        replace
      />
    )
  }

  return (
    <main
      data-acento="secretaria"
      className="flex min-h-screen items-center justify-center px-4 py-10"
    >
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_420px] lg:gap-16">
        <header className="text-center lg:text-left">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--acento-fuerte)] text-white shadow-sm">
            <GraduationCap className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl xl:text-6xl">
            TechAcademy <span className="text-[var(--acento-texto)]">BA</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-base leading-7 text-slate-600 lg:mx-0">
            Cursos, comisiones, alumnos y accesos a clase, en un solo lugar.
          </p>
          <p className="mt-4 text-sm text-slate-500">Acceso para Secretaría, Docentes y Alumnos.</p>
        </header>

        <div>
          <Card className="shadow-[0_18px_50px_-24px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-900">Ingresá a tu cuenta</h2>
            <p className="mt-1 text-sm text-slate-500">
              Usá el correo y la contraseña de la academia.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
              <Input
                etiqueta="Correo electrónico"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                valor={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nombre@techacademy.invalid"
              />

              <Input
                etiqueta="Contraseña"
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                valor={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu contraseña"
              />

              {error !== null && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Ingresando…' : 'Ingresar'}
              </Button>
            </form>
          </Card>

          <p className="mt-5 text-center text-xs leading-5 text-slate-500">{DEMO_NOTICE}</p>
        </div>
      </div>
    </main>
  )
}
