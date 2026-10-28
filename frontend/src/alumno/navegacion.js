import { Award, BookOpen, CircleUser, CreditCard, LayoutDashboard, Wallet } from 'lucide-react'

/**
 * Menú del shell de Alumno.
 *
 * **El orden y los dos ítems deshabilitados son requisito del spec, no una preferencia.** El spec
 * de `student-shell` fija los seis ítems en este orden exacto. `Pagar la cuota` y `Certificados`
 * van deshabilitados: el pago en línea desde la plataforma y la historia académica quedan fuera del
 * alcance mínimo, y el contenido del prototype para certificados —la pantalla con `Descargar
 * certificado`— no se reproduce (D20).
 *
 * **Un ítem deshabilitado no lleva `ruta`.** No es un enlace sin destino: es un texto con la
 * insignia `Próximamente`, y por eso no hay pantalla detrás a la que una prueba pueda llegar.
 *
 * **`Dashboard` es la raíz y `Mis Cursos` es una pantalla propia.** El tablero vive en `/alumno`
 * —por eso su ítem es `exacta`— y las tarjetas de las cursadas, que antes eran una sección del
 * tablero, se abren desde `Mis Cursos` en `/alumno/cursos`. El ítem de cursos no es `exacta`: así
 * el detalle de una cursada sigue destacando `Mis Cursos` y el breadcrumb sigue nombrándola.
 *
 * Cada ítem lleva su ícono (change `ui-figma-dashboards`, D40): el del diseño cuando el ítem está
 * en su menú y el del mismo set que corresponde al significado cuando no.
 */
export const SECCIONES_ALUMNO = Object.freeze([
  Object.freeze({
    clave: 'dashboard',
    etiqueta: 'Dashboard',
    ruta: '/alumno',
    exacta: true,
    icono: LayoutDashboard,
  }),
  Object.freeze({
    clave: 'cursos',
    etiqueta: 'Mis Cursos',
    ruta: '/alumno/cursos',
    icono: BookOpen,
  }),
  Object.freeze({
    clave: 'pagos',
    etiqueta: 'Mis Pagos',
    ruta: '/alumno/pagos',
    icono: Wallet,
  }),
  Object.freeze({ clave: 'pagar', etiqueta: 'Pagar la cuota', deshabilitado: true, icono: CreditCard }),
  Object.freeze({ clave: 'certificados', etiqueta: 'Certificados', deshabilitado: true, icono: Award }),
  Object.freeze({
    clave: 'perfil',
    etiqueta: 'Mi Perfil',
    ruta: '/alumno/perfil',
    icono: CircleUser,
  }),
])

/**
 * Nombre accesible del panel lateral. **Ya no se dibuja como rótulo visible** —el diseño no
 * muestra títulos de sección— pero el `<nav>` lo conserva como `aria-label`.
 */
export const TITULO_MENU = 'ESPACIO ALUMNO'

/** El período lectivo vive en el pie del armazón y su literal lo fija el spec de `student-shell`. */
export const PERIODO_LECTIVO = 'Período Lectivo 2026'
