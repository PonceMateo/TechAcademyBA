import { ESTADO_ASISTENCIA } from '../domain/enums'
import { markAsExample } from './placeholderNotice'

/**
 * Asistencia de las comisiones que muestra el shell de Docente (datos de ejemplo, D22).
 *
 * **La planilla del cliente no tiene una columna de asistencia.** El prototype sí muestra la
 * pantalla, con tres fechas y dos alumnos, así que las clases y las marcas van como dato de
 * referencia, igual que el cronograma del alumno (P5). Lo que no es de referencia son las fechas:
 * tienen que ser las que corresponden a los días de cursada que la propia comisión declara.
 *
 * **`CUR-101` imparte `Mar y Jue`.** El 12 de mayo de 2026 es martes, el 14 y el 21 son jueves, y
 * los tres rótulos dicen el día de la semana que le corresponde. La barra de sesión dice
 * `Jueves · 19 a 21 hs` porque la clase del día es un jueves. Si algún día alguien cambia una
 * fecha sin cambiar el rótulo, la pantalla miente sobre el calendario, que es exactamente el error
 * que el spec avisa.
 *
 * **Solo la clase del día es editable** y por eso `editable` viaja con la clase y no se deduce de
 * la posición: una columna anterior editable sería un alumno anotando una clase que todavía no se
 * dictó.
 *
 * **Las marcas se guardan por id de alumno y no por nombre**, que es lo que haría el padrón. Los dos
 * ids son los de `CUR-101` en `alumnos.js`: Juan Ignacio Pérez es el 1 y Agustina Benítez el 5.
 * Los totales de la barra de sesión salen de contar estas marcas, no de un texto.
 */

/** Los dos estados de una marca de asistencia viven en `src/domain/enums.js`. */
export const ASISTENCIAS = markAsExample([
  {
    comision: 'CUR-101',
    // La barra de la clase del día: día de la semana y horario de la comisión.
    sesion: { rotulo: 'Jueves · 19 a 21 hs' },
    clases: [
      { fecha: '2026-05-12', titulo: 'MAR 12/05', editable: false },
      { fecha: '2026-05-14', titulo: 'JUE 14/05', editable: false },
      { fecha: '2026-05-21', titulo: 'HOY · JUE 21/05', editable: true },
    ],
    marcas: {
      1: {
        '2026-05-12': ESTADO_ASISTENCIA.AUSENTE,
        '2026-05-14': ESTADO_ASISTENCIA.PRESENTE,
        '2026-05-21': ESTADO_ASISTENCIA.PRESENTE,
      },
      5: {
        '2026-05-12': ESTADO_ASISTENCIA.PRESENTE,
        '2026-05-14': ESTADO_ASISTENCIA.AUSENTE,
        '2026-05-21': ESTADO_ASISTENCIA.AUSENTE,
      },
    },
  },
])
