import { useSession } from '../auth/SessionContext'
import { AvisoCambioContrasena } from '../components/session/AvisoCambioContrasena'
import { BotonCerrarSesion } from '../components/session/BotonCerrarSesion'

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
 * Raíz de las secciones de Docente y de Alumno (7.3).
 *
 * **Es un marcador de posición, no una pantalla.** El shell de Administración ya tiene las suyas
 * (grupo 9); los grupos 10 y 11 reemplazan el contenido de estas dos rutas. Acá vive lo que es de
 * todos: quién entró, el aviso de contraseña pendiente y el botón de cerrar sesión, que ahora son
 * los mismos componentes que usa el shell de Administración.
 *
 * El aviso de contraseña pendiente responde al requisito de `auth-and-roles`: cuando
 * `must_change_password` está en `true` la interfaz tiene que avisar. El flujo de cambio no
 * existe todavía, así que el aviso dice eso mismo en lugar de llevar a una pantalla que no hay
 * (D18). Con las cuentas de demostración no aparece: el seed las deja en `false`.
 */
export function LandingPage() {
  const { session } = useSession()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 px-4">
      <h1 className="text-2xl font-semibold text-slate-900">{SECTION_TITLES[session.rol]}</h1>
      <p className="text-sm text-slate-600">
        Sesión de {session.nombre} · {session.email}
      </p>

      <AvisoCambioContrasena pendiente={session.must_change_password} />

      <p className="max-w-md text-center text-sm text-slate-500">
        Esta sección todavía no tiene pantallas. Por ahora funcionan el acceso, la sesión y el ruteo
        por rol.
      </p>

      <BotonCerrarSesion />
    </main>
  )
}
