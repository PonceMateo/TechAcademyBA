import { ShellFrame } from '../components/shell/ShellFrame'
import { PERIODO_LECTIVO, SECCIONES_ADMIN, TITULO_MENU } from './navegacion'

/**
 * Armazón del shell de Administración y Secretaría (9.1).
 *
 * **Acá no hay estructura: la del shell la dibuja `ShellFrame`.** Esta pantalla pasa el acento
 * azul del rol, el nombre accesible del panel, los ítems del menú y el período lectivo, y el
 * armazón compartido los acomoda. El shell de Docente (10.1) y el de Alumno (11.1) hacen
 * exactamente lo mismo con los suyos: la diferencia entre las tres secciones son datos, no tres
 * copias del mismo HTML.
 *
 * **El rol se muestra siempre como `Secretaría`** (D3): Administración y Secretaría son el mismo
 * rol y tener las dos palabras en pantalla haría creer que hay dos cuentas distintas. Desde el
 * change `ui-figma-dashboards` ese rótulo vive en el bloque de perfil de la barra superior, que
 * `ShellFrame` arma con el nombre de la cuenta y el rol del shell.
 *
 * **El contenido de la sección entra por `<Outlet />`**, que dibuja el armazón compartido: el
 * layout no sabe qué pantalla hay, solo la dibuja.
 */
export function AdminLayout() {
  return (
    <ShellFrame
      acento="secretaria"
      tituloMenu={TITULO_MENU}
      secciones={SECCIONES_ADMIN}
      periodoLectivo={PERIODO_LECTIVO}
    />
  )
}
