import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react'

/**
 * Menú del shell de Administración.
 *
 * **El orden es parte del requisito**, no una preferencia: el spec de `admin-shell` fija los seis
 * ítems en este orden exacto. Por eso la lista es un dato y no seis `<Link>` escritos en el
 * layout, que es la forma en la que un reordenamiento se cuela sin que nada lo note.
 *
 * La etiqueta visible es distinta de la ruta: Administración y Secretaría son el mismo rol (D3) y
 * la interfaz lo llama siempre `Secretaría`, pero la URL identifica quién entra (M10).
 *
 * `exacta` marca la sección raíz: sin ella, `/admin` sería el prefijo de las otras cinco rutas y
 * el menú dejaría `Dashboard` y `Cursos y Comisiones` marcados a la vez.
 *
 * **Cada ítem lleva su ícono** (change `ui-figma-dashboards`, D40). Los del diseño son de lucide;
 * donde el menú del Figma no tiene el ítem —`Docentes` no aparece en su lista— se elige el ícono
 * del mismo set que corresponde al significado, y eso queda anotado como la única concesión.
 */
export const SECCIONES_ADMIN = Object.freeze([
  Object.freeze({
    clave: 'dashboard',
    etiqueta: 'Dashboard',
    ruta: '/admin',
    exacta: true,
    icono: LayoutDashboard,
  }),
  Object.freeze({
    clave: 'cursos',
    etiqueta: 'Cursos y Comisiones',
    ruta: '/admin/cursos',
    icono: BookOpen,
  }),
  Object.freeze({
    clave: 'docentes',
    etiqueta: 'Docentes',
    ruta: '/admin/docentes',
    icono: GraduationCap,
  }),
  Object.freeze({
    clave: 'alumnos',
    etiqueta: 'Alumnos e Inscripciones',
    ruta: '/admin/alumnos',
    icono: Users,
  }),
  Object.freeze({
    clave: 'cobranzas',
    etiqueta: 'Cobranzas e Ingresos',
    ruta: '/admin/cobranzas',
    icono: Wallet,
  }),
  Object.freeze({
    clave: 'habilitacion',
    etiqueta: 'Habilitación de Accesos',
    ruta: '/admin/habilitacion',
    icono: ShieldCheck,
  }),
])

/**
 * Nombre accesible del panel lateral. **Ya no se dibuja como rótulo visible** —el diseño no
 * muestra títulos de sección— pero el `<nav>` lo conserva como `aria-label`: un panel de
 * navegación sin nombre es un panel que un lector de pantalla anuncia como "navegación" a secas.
 */
export const TITULO_MENU = 'MENÚ OPERATIVO'

/** El período lectivo vive en el pie del armazón y su literal lo fija el spec de `admin-shell`. */
export const PERIODO_LECTIVO = 'Período Lectivo 2026'
