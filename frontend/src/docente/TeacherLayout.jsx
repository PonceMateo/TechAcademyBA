import { ShellFrame } from '../components/shell/ShellFrame'
import {
  CHIP_ROL,
  PERIODO_LECTIVO,
  PIE_AVATAR,
  PIE_NOMBRE,
  PIE_ROL,
  SECCIONES_DOCENTE,
  TITULO_MENU,
} from './navegacion'

/**
 * Armazón del shell de Docente (10.1).
 *
 * **Es el mismo `ShellFrame` que usa el shell de Administración, con otro acento.** Las tres
 * piezas fijas —panel lateral, barra superior y pie— son las de siempre; lo que cambia es el color
 * de acento, que es verde azulado y distinguible del celeste de Secretaría. Si el armazón fuera
 * distinto, el ítem deshabilitado de `Notas y Certificación` existiría en dos versiones.
 *
 * **El pie lleva la persona del maqueteado** —`PM`, `Profe Martín`, `DOCENTE`— porque el spec los
 * fija como literales. En la barra superior sigue estando el nombre de la cuenta que entró: son dos
 * personas distintas solo porque las cuentas de demostración del backend no son las del prototype
 * (M25), y ocultar con cuál se entró no es una decisión de un shell.
 */
export function TeacherLayout() {
  return (
    <ShellFrame
      acento="docente"
      tituloMenu={TITULO_MENU}
      secciones={SECCIONES_DOCENTE}
      chipRol={CHIP_ROL}
      periodoLectivo={PERIODO_LECTIVO}
      pie={{ avatar: PIE_AVATAR, nombre: PIE_NOMBRE, rol: PIE_ROL }}
    />
  )
}
