/**
 * Rutas de entrada de cada rol. Es la tabla de ruteo en su forma final: los grupos 9, 10 y
 * 11 agregan las pantallas de cada sección debajo de estos mismos prefijos, sin mover la
 * raíz de ninguno.
 *
 * Las tres raíces coinciden con los tres shells: `/admin`, `/docente` y `/alumno`.
 *
 * **Por qué el prefijo del rol y no un nombre de sección:** el nombre visible de cada rol es
 * cosa de la interfaz —`Secretaría`, `Espacio Docente`, `Espacio Alumno`— y cambia según la
 * pantalla (D3). La URL identifica quién entra, no cómo se lo llama.
 */
export const ROLE_HOME_PATHS = Object.freeze({
  ADMIN: '/admin',
  DOCENTE: '/docente',
  ALUMNO: '/alumno',
})

export const LOGIN_PATH = '/login'
export const FORBIDDEN_PATH = '/403'

/** Un rol que no está en el mapa no tiene sección propia: vuelve al login. */
export function homePathForRole(role) {
  return ROLE_HOME_PATHS[role] ?? LOGIN_PATH
}
