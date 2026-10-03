import { useSession } from '../../auth/SessionContext'
import { Button } from '../ui'

/**
 * Botón de cerrar sesión (compartido por los tres shells).
 *
 * **La sesión es del contexto, no del shell.** Cada shell muestra un botón, pero ninguno decide
 * a dónde manda: `signOut` borra el token y vuelve al login (M13), y el texto del botón es el
 * mismo en las tres secciones para que quien lo busca lo encuentre en cualquier lado.
 */
export function BotonCerrarSesion({ variante = 'secundario', tamano = 'medio' }) {
  const { signOut } = useSession()

  return (
    <Button variante={variante} tamano={tamano} onClick={signOut}>
      Cerrar sesión
    </Button>
  )
}
