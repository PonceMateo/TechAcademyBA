/**
 * Los componentes compartidos por los tres shells (8.3).
 *
 * Los tres shells de la interfaz —Administración, Docente y Alumno— dibujan con estos mismos
 * componentes. La consecuencia práctica es que un estado bloqueado se ve igual en el padrón de
 * alumnos y en la ficha de habilitación, y que una tabla de la secretaría y una del docente no
 * pueden terminar con estilos distintos por copiarse a mano.
 *
 * Este archivo solo reexporta componentes: las constantes de color viven en `paleta.js` porque un
 * archivo que exporta un componente y además una constante rompe la regla de recarga en caliente
 * de `eslint-plugin-react-refresh`.
 */
export { Badge } from './Badge'
export { Button } from './Button'
export { Card } from './Card'
export { Campo, Input } from './Input'
export { Modal } from './Modal'
export { StatusIndicator } from './StatusIndicator'
export { Table } from './Table'
