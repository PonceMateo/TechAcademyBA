import { ShellFrame } from '../components/shell/ShellFrame'
import {
  CHIP_ROL,
  PERIODO_LECTIVO,
  PIE_AVATAR,
  PIE_NOMBRE,
  PIE_ROL,
  SECCIONES_ALUMNO,
  TITULO_MENU,
} from './navegacion'

/**
 * Armazón del shell de Alumno (11.1).
 *
 * **Es el mismo `ShellFrame` que usan los otros dos shells, con el acento terracota.** El spec lo
 * pide distinguible del celeste de Secretaría y del verde azulado del docente, y con el acento como
 * un solo nombre por shell no hay forma de que el chip y el panel queden de colores distintos.
 *
 * **El pie lleva la persona del maqueteado** —`CR`, `Camila Rodríguez`, `ALUMNO`— porque el spec los
 * fija como literales. En la barra superior sigue estando el nombre de la cuenta que entró: son dos
 * personas distintas solo porque las cuentas de demostración del backend no son las del prototype
 * (M25).
 */
export function StudentLayout() {
  return (
    <ShellFrame
      acento="alumno"
      tituloMenu={TITULO_MENU}
      secciones={SECCIONES_ALUMNO}
      chipRol={CHIP_ROL}
      periodoLectivo={PERIODO_LECTIVO}
      pie={{ avatar: PIE_AVATAR, nombre: PIE_NOMBRE, rol: PIE_ROL }}
    />
  )
}
