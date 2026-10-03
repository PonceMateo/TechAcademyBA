import { markAsExample } from './placeholderNotice'

/**
 * Inscripción del alumno de ejemplo (datos de ejemplo, D22).
 *
 * **Una sola inscripción, y es la que el cliente registra.** `CUR-102` con `Lic. Laura Benítez` es la
 * inscripción que el prototype muestra, así que la colección tiene una fila y el shell no agrega una
 * segunda para ilustrar el caso bloqueado: el estado bloqueado se alcanza forzando el bloqueo de esta
 * misma inscripción, que es lo que hace la secretaría.
 *
 * **La comisión va completa acá y no en `comisiones.js`.** El catálogo de `comisiones.js` es un
 * subconjunto de cinco filas del cliente y `mocks.test.js` verifica sus totales; agregar `CUR-102`
 * ahí cambiaría el `160` de lugares y el `27%` del tablero por una fila que el catálogo de
 * Administración no muestra. La inscripción lleva lo que la pantalla del alumno necesita y el
 * catálogo no usa: docente, horarios, arancel, cronograma y encuentros.
 *
 * **Los dos horarios son el mismo dato en las dos formas en que lo pide el spec**: la tarjeta del
 * curso muestra `Lun y Miér · 18:30 a 21:30` y el detalle `Lunes y miércoles · 18:30 a 21:30`. No se
 * derivan uno del otro porque un horario no se parte por espacios.
 *
 * **El cronograma y los temas son material de referencia** (P5): tienen forma de fecha y tema, pero
 * la secretaría carga los reales cuando el sistema esté funcional. Las fechas sí son coherentes con
 * los días de cursada: la comisión imparte lunes y miércoles, y el inicio es un lunes y el fin un
 * miércoles.
 */
export const INSCRIPCIONES = markAsExample([
  {
    alumno_id: 2,
    comision: {
      codigo: 'CUR-102',
      nombre: 'Desarrollo Web Full Stack',
      docente_nombre: 'Lic. Laura Benítez',
      horario_legible: 'Lun y Miér · 18:30 a 21:30',
      horario_prolongado: 'Lunes y miércoles · 18:30 a 21:30',
      arancel: 62000,
      sede_nombre: 'Sede Constituciones',
    },
    cronograma: { inicio: '2026-05-04', fin: '2026-07-29' },
    proximos_encuentros: [
      { fecha: '2026-05-25', tema: 'Componentes y props' },
      { fecha: '2026-05-27', tema: 'Estado y eventos' },
      { fecha: '2026-06-01', tema: 'Rutas y formularios' },
    ],
  },
])
