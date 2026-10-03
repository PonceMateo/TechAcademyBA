/**
 * Menú del shell de Alumno.
 *
 * **El orden y los dos ítems deshabilitados son requisito del spec, no una preferencia.** El spec
 * de `student-shell` fija los cinco ítems en este orden exacto. `Pagar la cuota` y `Certificados`
 * van deshabilitados: el pago en línea desde la plataforma y la historia académica quedan fuera del
 * alcance mínimo, y el contenido del prototype para certificados —la pantalla con `Descargar
 * certificado`— no se reproduce (D20).
 *
 * **Un ítem deshabilitado no lleva `ruta`.** No es un enlace sin destino: es un texto con la
 * insignia `Próximamente`, y por eso no hay pantalla detrás a la que una prueba pueda llegar.
 */
export const SECCIONES_ALUMNO = Object.freeze([
  Object.freeze({ clave: 'cursos', etiqueta: 'Mis Cursos', ruta: '/alumno', exacta: true }),
  Object.freeze({ clave: 'pagos', etiqueta: 'Mis Pagos', ruta: '/alumno/pagos' }),
  Object.freeze({ clave: 'pagar', etiqueta: 'Pagar la cuota', deshabilitado: true }),
  Object.freeze({ clave: 'certificados', etiqueta: 'Certificados', deshabilitado: true }),
  Object.freeze({ clave: 'perfil', etiqueta: 'Mi Perfil', ruta: '/alumno/perfil' }),
])

/** Etiquetas literales del armazón del shell, fijadas por el spec de `student-shell`. */
export const TITULO_MENU = 'ESPACIO ALUMNO'
export const CHIP_ROL = 'Rol Alumno · Solo mi información'
export const PERIODO_LECTIVO = 'Período Lectivo 2026'
export const PIE_AVATAR = 'CR'
export const PIE_NOMBRE = 'Camila Rodríguez'
export const PIE_ROL = 'ALUMNO'
