import { ShellFrame } from '../components/shell/ShellFrame'
import { PERIODO_LECTIVO, SECCIONES_DOCENTE, TITULO_MENU } from './navegacion'

/**
 * Armazón del shell de Docente (10.1).
 *
 * **Es el mismo `ShellFrame` que usan los otros dos shells, con el acento verde del rol.** Las
 * piezas fijas —lateral, barra superior, contenido y pie— son las mismas; lo que cambia es el
 * color de acento, que es el verde del diseño y distinguible del azul de Secretaría y del dorado
 * del Alumno (D40). Si el armazón fuera distinto, el ítem deshabilitado de `Notas y Certificación`
 * existiría en dos versiones.
 */
export function TeacherLayout() {
  return (
    <ShellFrame
      acento="docente"
      tituloMenu={TITULO_MENU}
      secciones={SECCIONES_DOCENTE}
      periodoLectivo={PERIODO_LECTIVO}
    />
  )
}
