import { markAsExample } from './placeholderNotice'

/**
 * Links de clase cargados por los docentes (datos de ejemplo, D22).
 *
 * **La colección arranca vacía a propósito.** El link de la clase lo carga el docente de la
 * comisión (10.3) y el alumno solo lo ve si ya está (11.3): con el ejemplo sin link, el shell del
 * alumno abre en el estado en que está de verdad un alumno recién inscripto —habilitado, con el
 * profesor todavía sin publicar el link— en vez de opens en un estado que el cliente no registró.
 *
 * **El link es único por clase del día y no por alumno.** Es el mismo enlace para todos los
 * alumnos habilitados de la comisión, que es lo que hace que el docente lo mande por correo a los
 * habilitados y no tenga que ir almacenándolo por persona.
 *
 * Cuando el docente guarda uno, la implementación de ejemplo lo escribe en su estado en memoria y
 * no acá: este módulo es la carga inicial y no el lugar donde una pantalla acumule lo que hizo un
 * usuario.
 */
export const LINKS_DE_CLASE = markAsExample([])
