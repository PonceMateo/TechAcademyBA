/**
 * Menú del shell de Administración.
 *
 * **El orden es parte del requisito**, no una preferencia: el spec de `admin-shell` fija los seis
 * ítems en este orden exacto. Por eso la lista es un dato y no seis `<Link>` escritos en el
 * layout, que es la forma en la que un reordenamiento se cuela sin que nada lo note.
 *
 * La etiqueta visible es distinta de la ruta: Administración y Secretaría son el mismo rol (D3) y
 * la interfaz lo llama siempre `Secretaría`, pero la URL identifica quién entra (M10).
 */
export const SECCIONES_ADMIN = Object.freeze([
  Object.freeze({ clave: 'dashboard', etiqueta: 'Dashboard', ruta: '/admin' }),
  Object.freeze({ clave: 'cursos', etiqueta: 'Cursos y Comisiones', ruta: '/admin/cursos' }),
  Object.freeze({ clave: 'docentes', etiqueta: 'Docentes', ruta: '/admin/docentes' }),
  Object.freeze({
    clave: 'alumnos',
    etiqueta: 'Alumnos e Inscripciones',
    ruta: '/admin/alumnos',
  }),
  Object.freeze({
    clave: 'cobranzas',
    etiqueta: 'Cobranzas e Ingresos',
    ruta: '/admin/cobranzas',
  }),
  Object.freeze({
    clave: 'habilitacion',
    etiqueta: 'Habilitación de Accesos',
    ruta: '/admin/habilitacion',
  }),
])

/** Etiquetas literales del armazón del shell, fijadas por el spec de `admin-shell`. */
export const TITULO_MENU = 'MENÚ OPERATIVO'
export const CHIP_ROL = 'Secretaría'
export const CHIP_SEDE = 'Sede Constituciones'
export const PERIODO_LECTIVO = 'Período Lectivo 2026'
export const PIE_NOMBRE = 'Secretaria BA'
export const PIE_TERMINAL = 'Terminal Interna 04'
