import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Bell, ChevronDown, ChevronRight, GraduationCap, LogOut, Search } from 'lucide-react'
import { useSession } from '../../auth/SessionContext'
import { AvisoCambioContrasena } from '../session/AvisoCambioContrasena'
import { Avatar, Badge, Button } from '../ui'
import { MARCA_UI, TONO } from '../ui/paleta'

/**
 * Armazón de los tres shells (9.1, 10.1, 11.1), con el lenguaje visual del diseño
 * (`docs/design/figma-dashboards-overhaul/`, change `ui-figma-dashboards`).
 *
 * **Las tres secciones dibujan su armazón con este componente y no con tres copias.** El armazón
 * es estructura —lateral, barra superior, contenido y pie— y no contenido: lo que cambia de una
 * sección a la otra es el acento, los ítems del menú y los rótulos, y los tres van como datos. La
 * prueba de consistencia (9.8) puede afirmar que las tres dibujan con los mismos componentes
 * justamente porque hay un solo archivo que las dibuja.
 *
 * **El acento es un solo nombre por shell.** El componente publica `data-acento` y `index.css`
 * traduce ese nombre al color: acento del fondo degradado, de la retícula, del ítem activo, del
 * foco, del botón primario y del avatar. Los tres son distinguibles entre sí: azul para
 * Secretaría, verde para Docente y dorado para Alumno (D40). Ninguna pantalla elige un color.
 *
 * **El panel lateral ya no lleva rótulo visible.** El diseño no muestra títulos de sección, así
 * que el `<nav>` conserva `tituloMenu` como nombre accesible y nada más: quien navega con lector
 * de pantalla sigue oyendo de qué panel se trata.
 *
 * **La barra superior es la del diseño, y lo que el diseño saca, sale.** El breadcrumb reemplaza a
 * los chips de rol y de sede; el período lectivo se muda al pie, y el nombre y el rol de la cuenta
 * viven en el bloque de perfil, que abre un menú con la única entrada real: `Cerrar sesión`. La
 * búsqueda `⌘ K` y la campana son composición inerte, igual que los botones del tablero que
 * ninguna historia cubre: se ven y no hacen nada, en vez de prometer una función que no existe.
 *
 * **El cierre de sesión sigue siendo el botón compartido.** Cambió de lugar —del pie al menú de
 * perfil— pero no de implementación: la entrada del menú es `Button`, el mismo componente que usan
 * las pantallas, para no tener dos botones distintos que además cierran la sesión de dos maneras.
 *
 * **Un ítem deshabilitado no es un enlace.** Los ítems Won't se dibujan como texto con la insignia
 * `Próximamente` y sin ruta: no hay forma de pulsarlo, y por eso la prueba no necesita simular un
 * clic para comprobar que no abre nada (D20). No es un `<button disabled>` porque no es una
 * acción: es un lugar del menú que todavía no existe.
 */
const ACENTOS = Object.freeze({
  secretaria: Object.freeze({ rol: 'Secretaría' }),
  docente: Object.freeze({ rol: 'Docente' }),
  alumno: Object.freeze({ rol: 'Alumno' }),
})

/** Pie del armazón: el tagline del maquetado y la marca de actualización, ambas literales. */
const TAGLINE = 'TechAcademy BA · Aprendemos, crecemos, conectamos.'
const ULTIMA_ACTUALIZACION = 'Última actualización: 09:41'

/** Iniciales de la cuenta para el avatar: dos palabras, dos letras. */
function inicialesDe(nombre) {
  return nombre
    .split(/\s+/)
    .filter((parte) => parte.length > 0)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join('')
}

export function ShellFrame({ acento, tituloMenu, secciones, periodoLectivo }) {
  const { session, signOut } = useSession()
  const { pathname } = useLocation()
  const [menuPerfilAbierto, setMenuPerfilAbierto] = useState(false)
  const contenedorPerfil = useRef(null)

  const paleta = ACENTOS[acento]

  if (paleta === undefined) {
    throw new Error(`El armazón no tiene acento para el shell "${acento}".`)
  }

  // El breadcrumb sigue a la pantalla abierta: la sección cuya ruta coincide con la dirección.
  const activa =
    secciones.find((seccion) => {
      if (!seccion.ruta) {
        return false
      }
      return seccion.exacta === true ? pathname === seccion.ruta : pathname.startsWith(seccion.ruta)
    }) ?? secciones[0]

  useEffect(() => {
    if (!menuPerfilAbierto) {
      return undefined
    }

    function cerrarPorClickAfuera(evento) {
      if (contenedorPerfil.current && !contenedorPerfil.current.contains(evento.target)) {
        setMenuPerfilAbierto(false)
      }
    }

    function cerrarPorEscape(evento) {
      if (evento.key === 'Escape') {
        setMenuPerfilAbierto(false)
      }
    }

    document.addEventListener('mousedown', cerrarPorClickAfuera)
    document.addEventListener('keydown', cerrarPorEscape)
    return () => {
      document.removeEventListener('mousedown', cerrarPorClickAfuera)
      document.removeEventListener('keydown', cerrarPorEscape)
    }
  }, [menuPerfilAbierto])

  return (
    <div
      {...{ [MARCA_UI]: 'shell-frame' }}
      data-acento={acento}
      className="flex min-h-screen flex-col lg:flex-row"
    >
      <nav
        aria-label={tituloMenu}
        className="superficie-cristal w-full shrink-0 overflow-x-hidden border-b border-white/60 px-4 py-4 lg:w-60 lg:border-r lg:border-b-0 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:overflow-y-auto"
      >
        <div className="flex items-center gap-3 px-2 pb-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--acento-fuerte)] text-white">
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-base font-bold text-slate-800">TechAcademyBA</span>
        </div>

        <ul className="min-w-0 space-y-1">
          {secciones.map((seccion) => (
            <li key={seccion.clave} className="min-w-0">
              {seccion.deshabilitado === true ? (
                <span
                  aria-disabled="true"
                  className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-slate-400"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2.5 leading-snug break-words">
                    <seccion.icono className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {seccion.etiqueta}
                  </span>
                  <span className="shrink-0">
                    <Badge tono={TONO.GRIS}>Próximamente</Badge>
                  </span>
                </span>
              ) : (
                <NavLink
                  to={seccion.ruta}
                  end={seccion.exacta === true}
                  className={({ isActive }) =>
                    `foco-acento flex min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                      isActive
                        ? 'bg-[var(--acento-suave)] font-semibold text-[var(--acento-texto)]'
                        : 'text-slate-600 hover:bg-white/70'
                    }`
                  }
                >
                  <seccion.icono className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {seccion.etiqueta}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="superficie-cristal sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-white/60 px-4 py-3 sm:px-6">
        <nav aria-label="Ubicación" className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Mi espacio</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <span className="font-semibold text-slate-800">{activa.etiqueta}</span>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Composición inerte: la búsqueda de la plataforma todavía no existe. */}
          <div
            aria-hidden="true"
            className="hidden items-center gap-2 rounded-lg border border-slate-200/80 bg-white/70 px-3 py-1.5 text-xs text-slate-400 sm:flex"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="w-40">Buscar en la plataforma</span>
            <span>⌘ K</span>
          </div>

          {/* Composición inerte: la bandeja de notificaciones todavía no existe. */}
          <span
            aria-hidden="true"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[var(--acento)] ring-2 ring-white" />
          </span>

          <div className="relative" ref={contenedorPerfil}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuPerfilAbierto}
              onClick={() => setMenuPerfilAbierto((abierto) => !abierto)}
              className="foco-acento flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/70"
            >
              <Avatar iniciales={inicialesDe(session.nombre)} />
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-semibold text-slate-800">{session.nombre}</span>
                <span className="block text-xs text-slate-500">{paleta.rol}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </button>

            {menuPerfilAbierto && (
              <div
                role="menu"
                aria-label="Opciones de la cuenta"
                className="absolute right-0 z-40 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              >
                <Button
                  variante="fantasma"
                  role="menuitem"
                  onClick={signOut}
                  className="w-full justify-start gap-2.5 rounded-none px-3 py-2 text-sm"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Cerrar sesión
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

        <main className="flex-1 space-y-6 p-4 sm:p-6">
          <AvisoCambioContrasena pendiente={session.must_change_password} />
          <Outlet />
        </main>

        <footer className="superficie-cristal flex flex-wrap items-center justify-between gap-3 border-t border-white/60 px-4 py-3 text-xs text-slate-500 sm:px-6">
          <span>{TAGLINE}</span>
          <span className="flex flex-wrap items-center gap-3">
            <span>{periodoLectivo}</span>
            <span>{ULTIMA_ACTUALIZACION}</span>
          </span>
        </footer>
      </div>
    </div>
  )
}
