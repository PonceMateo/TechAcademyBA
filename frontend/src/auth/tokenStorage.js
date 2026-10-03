/**
 * Dónde vive el token entre recargas de la página.
 *
 * **Por qué `sessionStorage` y no `localStorage`:** el token es una credencial que alcanza
 * para actuar como la cuenta (D2), y la secretaría comparte la máquina. Con
 * `sessionStorage`, recargar la página no cierra la sesión, pero cerrar el navegador sí, y
 * el token no queda en disco para el próximo que use el equipo.
 *
 * **Lo que NO es esto:** una sesión confiable. El backend resuelve el token contra la base
 * en cada request (M7), así que un token alterado, vencido o de una cuenta dada de baja no
 * abre nada. Acá solo se evita perder la sesión al recargar.
 */
export const TOKEN_STORAGE_KEY = 'techacademy.token'

export function readStoredToken() {
  return window.sessionStorage.getItem(TOKEN_STORAGE_KEY)
}

export function storeToken(token) {
  window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearStoredToken() {
  window.sessionStorage.removeItem(TOKEN_STORAGE_KEY)
}
