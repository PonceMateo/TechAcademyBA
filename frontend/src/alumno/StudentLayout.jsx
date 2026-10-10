import { ShellFrame } from '../components/shell/ShellFrame'
import { PERIODO_LECTIVO, SECCIONES_ALUMNO, TITULO_MENU } from './navegacion'

/**
 * Armazón del shell de Alumno (11.1).
 *
 * **Es el mismo `ShellFrame` que usan los otros dos shells, con el acento dorado del rol.** El
 * spec lo pide distinguible del azul de Secretaría y del verde del docente; desde el change
 * `ui-figma-dashboards` el acento es el dorado del diseño (`#d0a52c`) y reemplaza al terracota
 * anterior (D40).
 */
export function StudentLayout() {
  return (
    <ShellFrame
      acento="alumno"
      tituloMenu={TITULO_MENU}
      secciones={SECCIONES_ALUMNO}
      periodoLectivo={PERIODO_LECTIVO}
    />
  )
}
