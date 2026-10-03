/**
 * Menú del shell de Docente.
 *
 * **El orden y el quinto ítem son requisito del spec, no una preferencia.** El spec de
 * `teacher-shell` fija los cinco ítems en este orden exacto, y el cuarto —`Notas y Certificación`—
 * va deshabilitado: las tres historias que agrupa (cargar notas, habilitar la emisión de
 * certificados y consultar el seguimiento de clases dictadas) quedan fuera del alcance mínimo y se
 * muestran como el hueco que son (D20). No se los abre en tres ítems separados.
 *
 * **Un ítem deshabilitado no lleva `ruta`.** No es un enlace sin destino: es un texto con la
 * insignia `Próximamente`, y por eso no hay pantalla detrás a la que una prueba pueda llegar.
 */
export const SECCIONES_DOCENTE = Object.freeze([
  Object.freeze({
    clave: 'comisiones',
    etiqueta: 'Mis Comisiones',
    ruta: '/docente',
    exacta: true,
  }),
  Object.freeze({ clave: 'alumnos', etiqueta: 'Mis Alumnos', ruta: '/docente/alumnos' }),
  Object.freeze({ clave: 'asistencia', etiqueta: 'Asistencia', ruta: '/docente/asistencia' }),
  Object.freeze({
    clave: 'notas',
    etiqueta: 'Notas y Certificación',
    deshabilitado: true,
  }),
  Object.freeze({ clave: 'perfil', etiqueta: 'Mi Perfil', ruta: '/docente/perfil' }),
])

/** Etiquetas literales del armazón del shell, fijadas por el spec de `teacher-shell`. */
export const TITULO_MENU = 'ESPACIO DOCENTE'
export const CHIP_ROL = 'Rol Docente · Solo mis comisiones'
export const PERIODO_LECTIVO = 'Período Lectivo 2026'
export const PIE_AVATAR = 'PM'
export const PIE_NOMBRE = 'Profe Martín'
export const PIE_ROL = 'DOCENTE'
