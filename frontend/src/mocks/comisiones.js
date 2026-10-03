import { MODALIDAD } from '../domain/enums'
import { markAsExample } from './placeholderNotice'

/**
 * Catálogo de comisiones (datos de ejemplo, D22).
 *
 * **Estas cinco filas son un subconjunto.** El cliente tiene diez comisiones; el spec de
 * `admin-shell` obliga a mostrar estas cinco y prohíbe inventar las que faltan para completar
 * el catálogo. El total del cliente vive en `CATALOGO_TOTAL_COMISIONES` y es el número que
 * muestra el chip `10 en el catálogo`: si se derivara de las filas, el chip mentiría.
 *
 * **Las vacantes no se guardan.** D10: las vacantes se derivan de `cupo_maximo` menos la
 * cantidad de inscripciones activas, porque una columna persistida se desincroniza apenas
 * alguien se inscribe. El mock guarda `inscriptos` y `vacantes` sale de calcular, igual que
 * sale del servidor el día que exista.
 *
 * Sobre las cinco filas: 160 lugares, 43 ocupados y 117 vacantes. Es el número que sostiene el
 * `27%` fijo del tablero, y por eso `mocks.test.js` lo verifica.
 */

export const CATALOGO_TOTAL_COMISIONES = 10

/** Sede de ejemplo. El modelo la elige la modalidad de la comisión (historia #8). */
export const SEDES = markAsExample([
  { id: 1, nombre: 'Sede Constituciones' },
  { id: 2, nombre: 'Sede Villa Crespo' },
])

const RAW_COMISIONES = [
  {
    id: 1,
    codigo: 'CUR-101',
    curso: { codigo: 'CUR-101', nombre: 'Python Inicial' },
    docente_id: 1,
    docente_nombre: 'Profe Martín',
    dias_horarios: 'Mar y Jue 19 a 21 hs',
    // Las dos formas del mismo horario. `dias_horarios` es la columna corta del catálogo de
    // Administración; `horario_legible` es la que muestran los shells de docente y de alumno, con
    // el punto medio. No se deriva del corto con operaciones de texto porque un horario no se
    // parte por espacios: sale escrito. Solo lo llevan las comisiones que esos shells muestran, que
    // son las asignadas al docente del maqueteado.
    horario_legible: 'Mar y Jue · 19 a 21 hs',
    // Próxima clase del docente del maqueteado. La planilla del cliente no tiene columna de
    // próximo evento: es dato de referencia, y por eso va como texto y no como fecha que el
    // navegador pueda deserializar (P5 cubre el cronograma real).
    proxima_clase: 'Hoy · 19:00',
    cupo_maximo: 30,
    inscriptos: 23,
    arancel: 45000,
    // La planilla del cliente no tiene columna de modalidad. El modelo la exige (historia #8),
    // así que se completa con valor de ejemplo: las cinco comisiones de ejemplo son presenciales
    // en la sede del chip de la barra superior. La columna NO se muestra en la tabla porque el
    // spec fija las columnas literales de esa pantalla.
    modalidad: MODALIDAD.PRESENCIAL,
    sede_id: 1,
  },
  {
    id: 2,
    codigo: 'CUR-104',
    curso: { codigo: 'CUR-104', nombre: 'Diseño UX/UI Avanzado' },
    // El cliente la registra con estado `Cerrada por cupo`: 20 inscriptos sobre un cupo de 20.
    docente_id: null,
    docente_nombre: 'Caro UX',
    dias_horarios: 'Miércoles 19 a 22',
    cupo_maximo: 20,
    inscriptos: 20,
    arancel: 52000,
    modalidad: MODALIDAD.PRESENCIAL,
    sede_id: 1,
  },
  {
    id: 3,
    codigo: 'CUR-108',
    curso: { codigo: 'CUR-108', nombre: 'Java Backend Spring' },
    docente_id: 5,
    docente_nombre: 'Ing. González',
    dias_horarios: 'Sábados intensivo',
    cupo_maximo: 30,
    inscriptos: 0,
    arancel: 58000,
    modalidad: MODALIDAD.PRESENCIAL,
    sede_id: 1,
  },
  {
    id: 4,
    codigo: 'CUR-110',
    curso: { codigo: 'CUR-110', nombre: 'Power BI & Dashboards' },
    docente_id: null,
    docente_nombre: 'Mariana Data',
    dias_horarios: 'Mar y Jue 18:30',
    cupo_maximo: 40,
    inscriptos: 0,
    arancel: 39000,
    modalidad: MODALIDAD.PRESENCIAL,
    sede_id: 1,
  },
  {
    id: 5,
    codigo: 'CUR-103',
    curso: { codigo: 'CUR-103', nombre: 'Marketing Digital & Ads' },
    docente_id: 3,
    docente_nombre: 'Santi Ads',
    dias_horarios: 'Sábados 10 a 13 hs',
    cupo_maximo: 40,
    inscriptos: 0,
    arancel: 38000,
    modalidad: MODALIDAD.PRESENCIAL,
    sede_id: 1,
  },
]

/**
 * Comisiones del maquetado.
 *
 * `docente_id` es nulo en las dos filas cuyo docente el cliente nombra en la hoja de cursos pero
 * no están en el padrón que esta pantalla muestra. El modelo admite `docente_id` nulo; el
 * padrón del spec tiene cinco filas y no se le inventan una sexta para que calce el nombre.
 *
 * `docente_nombre` va desnormalizado a propósito: es lo que la planilla del cliente muestra en
 * esa columna y lo que la tabla necesita sin una segunda vuelta.
 */
export const COMISIONES = markAsExample(
  RAW_COMISIONES.map((comision) => ({
    ...comision,
    sede_nombre: SEDES.find((sede) => sede.id === comision.sede_id)?.nombre ?? null,
    vacantes: comision.cupo_maximo - comision.inscriptos,
    // Estado que la planilla del cliente registra para la comisión, no el `estado` del modelo:
    // el modelo no tiene columna de estado de comisión (`catalogo.py` lo deja escrito).
    cerrada_por_cupo: comision.cupo_maximo - comision.inscriptos === 0,
  })),
)
