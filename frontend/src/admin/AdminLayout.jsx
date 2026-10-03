import { NavLink, Outlet } from 'react-router'
import { useSession } from '../auth/SessionContext'
import { AvisoCambioContrasena } from '../components/session/AvisoCambioContrasena'
import { BotonCerrarSesion } from '../components/session/BotonCerrarSesion'
import { Badge } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import {
  CHIP_ROL,
  CHIP_SEDE,
  PERIODO_LECTIVO,
  PIE_NOMBRE,
  PIE_TERMINAL,
  SECCIONES_ADMIN,
  TITULO_MENU,
} from './navegacion'

/**
 * Armazón del shell de Administración y Secretaría (9.1).
 *
 * Tres piezas fijas —panel lateral, barra superior y pie— y en el medio la pantalla de la sección.
 * El panel lateral lleva el título `MENÚ OPERATIVO` y los seis ítems en el orden del spec; la barra
 * superior lleva el chip `Sede Constituciones` y `Período Lectivo 2026`; el pie, `Secretaria BA` y
 * `Terminal Interna 04`.
 *
 * **`Sede Constituciones` y `Período Lectivo 2026` son literales.** El prototipo muestra
 * `Periodo Lectivo 2025` y el texto va corregido a propósito porque la línea temporal del
 * proyecto es 2026; `Período` con acento porque es la grafía correcta de la palabra.
 *
 * **El rol se muestra siempre como `Secretaría`** (D3): Administración y Secretaría son el mismo
 * rol y tener las dos palabras en pantalla haría creer que hay dos cuentas distintas.
 *
 * El contenido de la sección entra por `<Outlet />`: el layout no sabe qué pantalla hay, solo la
 * dibuja. Así el armazón no cambia cuando aparece una pantalla nueva, que es lo que va a pasar con
 * los grupos 10 y 11 en los otros dos shells.
 */
export function AdminLayout() {
  const { session } = useSession()

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <Badge tono={TONO.CELESTE}>{CHIP_ROL}</Badge>
          <Badge tono={TONO.GRIS}>{CHIP_SEDE}</Badge>
          <span className="text-sm text-slate-600">{PERIODO_LECTIVO}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">{session.nombre}</span>
          <BotonCerrarSesion tamano="chico" />
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <nav
          aria-label={TITULO_MENU}
          className="w-full shrink-0 border-b border-slate-200 bg-slate-900 px-4 py-4 lg:w-64 lg:border-r lg:border-b-0"
        >
          <h1 className="px-2 text-xs font-semibold tracking-widest text-slate-400">
            {TITULO_MENU}
          </h1>

          <ul className="mt-3 space-y-1">
            {SECCIONES_ADMIN.map((seccion) => (
              <li key={seccion.clave}>
                <NavLink
                  to={seccion.ruta}
                  end={seccion.clave === 'dashboard'}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-2 text-sm ${
                      isActive
                        ? 'bg-slate-700 font-medium text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`
                  }
                >
                  {seccion.etiqueta}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-1 space-y-4 p-6">
          <AvisoCambioContrasena pendiente={session.must_change_password} />
          <Outlet />
        </main>
      </div>

      <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3 text-xs text-slate-500">
        <span>{PIE_NOMBRE}</span>
        <span>{PIE_TERMINAL}</span>
      </footer>
    </div>
  )
}
