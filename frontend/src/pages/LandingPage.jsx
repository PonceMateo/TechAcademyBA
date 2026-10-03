import { useSession } from '../auth/SessionContext'

/**
 * Nombre visible de cada sección. Administración y Secretaría son el mismo rol (D3): la
 * interfaz lo llama siempre `Secretaría`.
 */
const SECTION_TITLES = {
  ADMIN: 'Secretaría',
  DOCENTE: 'Espacio Docente',
  ALUMNO: 'Espacio Alumno',
}

/**
 * Raíz de las tres secciones (7.3).
 *
 * **Es un marcador de posición, no una pantalla.** Los grupos 9, 10 y 11 reemplazan el
 * contenido de cada ruta con el shell real. Acá vive lo que es de todos: quién entró, el
 * aviso de contraseña pendiente y el botón de cerrar sesión.
 *
 * El aviso de contraseña pendiente responde al requisito de `auth-and-roles`: cuando
 * `must_change_password` está en `true` la interfaz tiene que avisar. El flujo de cambio no
 * existe todavía, así que el aviso dice eso mismo en lugar de llevar a una pantalla que no
 * hay (D18). Con las cuentas de demostración no aparece: el seed las deja en `false`.
 */
export function LandingPage() {
  const { session, signOut } = useSession()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 px-4">
      <h1 className="text-2xl font-semibold text-slate-900">{SECTION_TITLES[session.rol]}</h1>
      <p className="text-sm text-slate-600">
        Sesión de {session.nombre} · {session.email}
      </p>

      {session.must_change_password && (
        <p
          role="alert"
          className="max-w-md rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          Tu cuenta tiene pendiente el cambio de contraseña. El flujo de cambio todavía no está
          disponible: avisale a la secretaría para que te mande una clave nueva.
        </p>
      )}

      <p className="max-w-md text-center text-sm text-slate-500">
        Esta sección todavía no tiene pantallas. Por ahora funcionan el acceso, la sesión y el ruteo
        por rol.
      </p>

      <button
        type="button"
        onClick={signOut}
        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
      >
        Cerrar sesión
      </button>
    </main>
  )
}
