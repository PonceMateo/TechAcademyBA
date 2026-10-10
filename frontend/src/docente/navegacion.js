import { Award, BookOpen, CircleUser, UserCheck, Users } from 'lucide-react'

/**
 * Menú del shell de Docente.
 *
 * **El orden y el cuarto ítem son requisito del spec, no una preferencia.** El spec de
 * `teacher-shell` fija los cinco ítems en este orden exacto, y el cuarto —`Notas y Certificación`—
 * va deshabilitado: las tres historias que agrupa (cargar notas, habilitar la emisión de
 * certificados y consultar el seguimiento de clases dictadas) quedan fuera del alcance mínimo y se
 * muestran como el hueco que son (D20). No se los abre en tres ítems separados.
 *
 * **Un ítem deshabilitado no lleva `ruta`.** No es un enlace sin destino: es un texto con la
 * insignia `Próximamente`, y por eso no hay pantalla detrás a la que una prueba pueda llegar.
 *
 * Cada ítem lleva su ícono (change `ui-figma-dashboards`, D40): el del diseño cuando el ítem está
 * en su menú y el del mismo set que corresponde al significado cuando no.
 */
export const SECCIONES_DOCENTE = Object.freeze([
  Object.freeze({
    clave: 'comisiones',
    etiqueta: 'Mis Comisiones',
    ruta: '/docente',
    exacta: true,
    icono: BookOpen,
  }),
  Object.freeze({
    clave: 'alumnos',
    etiqueta: 'Mis Alumnos',
    ruta: '/docente/alumnos',
    icono: Users,
  }),
  Object.freeze({
    clave: 'asistencia',
    etiqueta: 'Asistencia',
    ruta: '/docente/asistencia',
    icono: UserCheck,
  }),
  Object.freeze({
    clave: 'notas',
    etiqueta: 'Notas y Certificación',
    deshabilitado: true,
    icono: Award,
  }),
  Object.freeze({
    clave: 'perfil',
    etiqueta: 'Mi Perfil',
    ruta: '/docente/perfil',
    icono: CircleUser,
  }),
])

/**
 * Nombre accesible del panel lateral. **Ya no se dibuja como rótulo visible** —el diseño no
 * muestra títulos de sección— pero el `<nav>` lo conserva como `aria-label`.
 */
export const TITULO_MENU = 'ESPACIO DOCENTE'

/** El período lectivo vive en el pie del armazón y su literal lo fija el spec de `teacher-shell`. */
export const PERIODO_LECTIVO = 'Período Lectivo 2026'
