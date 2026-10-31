import { MODALIDAD } from '../domain/enums'
import { DIAS, textoHorarios } from '../domain/horarios'
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
 *
 * **El período lo tienen cuatro de las cinco comisiones (historia #49).** La de Marketing Digital
 * es la que llega sin fechas del cliente y se queda así a propósito: es el caso de la comisión
 * heredada, que la tabla muestra como `Sin definir` y que la edición obliga a completar (D64). La
 * cantidad de clases no se escribe a mano: sale de las fechas y los días de cursada con
 * `clasesDelPeriodo`, que es la misma cuenta que hace el backend.
 */

export const CATALOGO_TOTAL_COMISIONES = 10

/**
 * Cuántas clases caen en un período de cursada (historia #49), para los datos de ejemplo.
 *
 * **Es propio de la demo, no de la pantalla.** El sistema no cuenta clases en el navegador: la
 * cantidad la devuelve la API, que la deriva de las fechas y los días de cursada de la comisión. Acá
 * existe para que el ejemplo pueda responder lo mismo cuando se crea o se edita una comisión sin
 * backend; la pantalla se limita a mostrar el número que llega (D64).
 *
 * Los dos extremos se cuentan y se miran los días de la semana del horario, no las filas: dos rangos
 * del mismo día no se modelan (historia #48). Las fechas se leen al mediodía UTC para que el huso del
 * navegador no corra el día y cambie el conteo.
 */
export function clasesDelPeriodo(inicio, fin, horarios) {
  if (!inicio || !fin || fin < inicio) {
    return 0
  }

  const diasDeCursada = new Set((horarios ?? []).map((horario) => horario.dia))
  let cantidad = 0
  const fecha = new Date(`${inicio}T12:00:00Z`)
  const ultima = new Date(`${fin}T12:00:00Z`)

  while (fecha <= ultima) {
    // `getUTCDay()` da 0 para el domingo y `DIAS` empieza en lunes, de ahí la rotación.
    if (diasDeCursada.has(DIAS[(fecha.getUTCDay() + 6) % 7].valor)) {
      cantidad += 1
    }
    fecha.setUTCDate(fecha.getUTCDate() + 1)
  }

  return cantidad
}

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
    // Los horarios estructurados son el dato; el texto sale de ellos (historia #48). Escrito a
    // mano, el ejemplo podría guardar un horario que el selector no puede producir.
    horarios: [
      { dia: 'MAR', inicio: '19:00', fin: '21:00' },
      { dia: 'JUE', inicio: '19:00', fin: '21:00' },
    ],
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
    // Período de cursada del cuatrimestre (historia #49): martes y jueves de agosto a noviembre.
    fecha_inicio: '2026-08-04',
    fecha_fin: '2026-11-26',
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
    horarios: [{ dia: 'MIE', inicio: '19:00', fin: '22:00' }],
    fecha_inicio: '2026-08-05',
    fecha_fin: '2026-11-25',
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
    horarios: [{ dia: 'SAB', inicio: '09:00', fin: '13:00' }],
    fecha_inicio: '2026-08-08',
    fecha_fin: '2026-11-28',
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
    horarios: [
      { dia: 'MAR', inicio: '18:30', fin: '20:30' },
      { dia: 'JUE', inicio: '18:30', fin: '20:30' },
    ],
    fecha_inicio: '2026-09-01',
    fecha_fin: '2026-12-17',
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
    horarios: [{ dia: 'SAB', inicio: '10:00', fin: '13:00' }],
    // La comisión heredada: llegó del cliente sin fechas y así se muestra, como `Sin definir`.
    fecha_inicio: null,
    fecha_fin: null,
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
    dias_horarios: textoHorarios(comision.horarios),
    sede_nombre: SEDES.find((sede) => sede.id === comision.sede_id)?.nombre ?? null,
    vacantes: comision.cupo_maximo - comision.inscriptos,
    cantidad_clases:
      comision.fecha_inicio === null
        ? null
        : clasesDelPeriodo(comision.fecha_inicio, comision.fecha_fin, comision.horarios),
    // Estado que la planilla del cliente registra para la comisión, no el `estado` del modelo:
    // el modelo no tiene columna de estado de comisión (`catalogo.py` lo deja escrito).
    cerrada_por_cupo: comision.cupo_maximo - comision.inscriptos === 0,
  })),
)
