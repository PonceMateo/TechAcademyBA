import { NavLink, Outlet } from 'react-router'
import { useSession } from '../../auth/SessionContext'
import { AvisoCambioContrasena } from '../session/AvisoCambioContrasena'
import { BotonCerrarSesion } from '../session/BotonCerrarSesion'
import { Avatar, Badge } from '../ui'
import { MARCA_UI, TONO } from '../ui/paleta'

/**
 * Armazón de los tres shells (9.1, 10.1, 11.1).
 *
 * **Las tres secciones dibujan su armazón con este componente y no con tres copias.** El armazón
 * es estructura —panel lateral, barra superior, contenido y pie— y no contenido: lo que cambia de
 * una sección a la otra son los rótulos, los ítems del menú y el color de acento, y los tres van
 * como datos. La prueba de consistencia (9.8) puede afirmar que las tres dibujan con los mismos
 * componentes justamente porque hay un solo archivo que las dibuja.
 *
 * **El acento es un solo nombre por shell, no dos colores.** `ACENTOS` decide a la vez el tono del
 * chip de rol y las clases del panel, de modo que nadie pueda cambiar el tono de un lado y dejar el
 * otro del color anterior. Los tres son distinguibles entre sí: `celeste` para Secretaría
 * (historia #9), `verde azulado` para el docente y `terracota` para el alumno.
 *
 * **Un ítem deshabilitado no es un enlace.** Los ítems Won't se dibujan como texto con la insignia
 * `Próximamente` y sin ruta: no hay forma de pulsarlo, y por eso la prueba no necesita simular un
 * clic para comprobar que no abre nada (D20). No es un `<button disabled>` porque no es una acción:
 * es un lugar del menú que todavía no existe.
 *
 * `mostrarNombreSesion` no existe como opción y es a propósito: **el nombre de la cuenta que entró
 * se muestra siempre en la barra superior de las tres secciones.** Es lo único que le dice a la
 * persona cuál de las tres cuentas está abierta, y en el shell de Administración es además el mismo
 * texto que lleva el pie. En los shells de docente y de alumno conviven los dos nombres —el de la
 * sesión y el de la persona del maqueteado que fija el pie— porque las cuentas de demostración del
 * backend no son las personas del prototype (ver M25 en `docs/decisions.md`).
 */
const ACENTOS = Object.freeze({
  secretaria: Object.freeze({
    tono: TONO.CELESTE,
    panel: 'bg-slate-900',
    activo: 'bg-slate-700',
    inactivo: 'text-slate-300 hover:bg-slate-800',
    titulo: 'text-slate-400',
  }),
  docente: Object.freeze({
    tono: TONO.VERDE_AZULADO,
    panel: 'bg-teal-900',
    activo: 'bg-teal-700',
    inactivo: 'text-teal-100 hover:bg-teal-800',
    titulo: 'text-teal-200',
  }),
})

export function ShellFrame({
  acento,
  tituloMenu,
  secciones,
  chipRol,
  chips = [],
  periodoLectivo,
  pie,
}) {
  const { session } = useSession()
  const paleta = ACENTOS[acento]

  if (paleta === undefined) {
    throw new Error(`El armazón no tiene acento para el shell "${acento}".`)
  }

  return (
    <div {...{ [MARCA_UI]: 'shell-frame' }} className="flex min-h-screen flex-col bg-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <Badge tono={paleta.tono}>{chipRol}</Badge>
          {chips.map((chip) => (
            <Badge key={chip.texto} tono={chip.tono ?? TONO.GRIS}>
              {chip.texto}
            </Badge>
          ))}
          <span className="text-sm text-slate-600">{periodoLectivo}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">{session.nombre}</span>
          <BotonCerrarSesion tamano="chico" />
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <nav
          aria-label={tituloMenu}
          className={`w-full shrink-0 border-b border-slate-200 px-4 py-4 lg:w-64 lg:border-r lg:border-b-0 ${paleta.panel}`}
        >
          <h1 className={`px-2 text-xs font-semibold tracking-widest ${paleta.titulo}`}>
            {tituloMenu}
          </h1>

          <ul className="mt-3 space-y-1">
            {secciones.map((seccion) => (
              <li key={seccion.clave}>
                {seccion.deshabilitado === true ? (
                  <span
                    aria-disabled="true"
                    className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-slate-400"
                  >
                    {seccion.etiqueta}
                    <Badge tono={TONO.GRIS}>Próximamente</Badge>
                  </span>
                ) : (
                  <NavLink
                    to={seccion.ruta}
                    end={seccion.exacta === true}
                    className={({ isActive }) =>
                      `block rounded-md px-3 py-2 text-sm ${
                        isActive ? `${paleta.activo} font-medium text-white` : paleta.inactivo
                      }`
                    }
                  >
                    {seccion.etiqueta}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-1 space-y-4 p-6">
          <AvisoCambioContrasena pendiente={session.must_change_password} />
          <Outlet />
        </main>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2">
          {pie.avatar !== undefined && <Avatar iniciales={pie.avatar} />}
          <span>{pie.nombre}</span>
          {pie.rol !== undefined && <span>{pie.rol}</span>}
        </span>
        {pie.extra !== undefined && <span>{pie.extra}</span>}
      </footer>
    </div>
  )
}
