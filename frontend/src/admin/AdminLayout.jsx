import { ShellFrame } from '../components/shell/ShellFrame'
import { TONO } from '../components/ui/paleta'
import {
  CHIP_ROL,
  CHIP_SEDE,
  PERIODO_LECTIVO,
  PIE_NOMBRE,
  PIE_TERMINAL,
  SECCIONES_ADMIN,
  TITULO_MENU,
} from './navegacion'

/**
 * Armazón del shell de Administración y Secretaría (9.1).
 *
 * **Acá no hay estructura: la del shell la dibuja `ShellFrame`.** Esta pantalla pasa los rótulos
 * del spec de `admin-shell` —`MENÚ OPERATIVO`, el chip `Secretaría`, el de la sede, el período
 * lectivo y el pie— y el armazón compartido los acomoda. El shell de Docente (10.1) y el de Alumno
 * (11.1) hacen exactamente lo mismo con los suyos: la diferencia entre las tres secciones son datos,
 * no tres copias del mismo HTML.
 *
 * **El rol se muestra siempre como `Secretaría`** (D3): Administración y Secretaría son el mismo rol
 * y tener las dos palabras en pantalla haría creer que hay dos cuentas distintas.
 *
 * **El contenido de la sección entra por `<Outlet />`**, que dibuja el armazón compartido: el layout
 * no sabe qué pantalla hay, solo la dibuja. Así el armazón no cambia cuando aparece una pantalla
 * nueva.
 */
export function AdminLayout() {
  return (
    <ShellFrame
      acento="secretaria"
      tituloMenu={TITULO_MENU}
      secciones={SECCIONES_ADMIN}
      chipRol={CHIP_ROL}
      chips={[{ texto: CHIP_SEDE, tono: TONO.GRIS }]}
      periodoLectivo={PERIODO_LECTIVO}
      pie={{ nombre: PIE_NOMBRE, extra: PIE_TERMINAL }}
    />
  )
}
