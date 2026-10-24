/**
 * Horarios de cursada (historia #48).
 *
 * **Una sola función describe los horarios, y de ella salen el chip del formulario y el texto de la
 * tabla.** Si hubiera dos, el chip y la columna dirían cosas distintas del mismo dato. La misma
 * agrupación la escribe el backend para `dias_horarios`; el formato está fijado en el spec
 * (`Lun y Mié 19-21hs`, `Mar 18:15-21:30hs`).
 *
 * **El valor interno es un string `"HH:MM"`**, no un `Date`: un horario de cursada no tiene fecha
 * ni zona horaria, y un `Date` obligaría a inventarle un día. La conversión a `Date` ocurre solo en
 * el borde del selector de hora.
 *
 * Todo lo de acá es puro: no toca el DOM ni el estado de React, así que se prueba sin renderizar.
 */

/** Los días en orden de semana, con el rótulo corto que se ve en los chips y en el resumen. */
export const DIAS = [
  { valor: 'LUN', corto: 'Lun', largo: 'Lunes' },
  { valor: 'MAR', corto: 'Mar', largo: 'Martes' },
  { valor: 'MIE', corto: 'Mié', largo: 'Miércoles' },
  { valor: 'JUE', corto: 'Jue', largo: 'Jueves' },
  { valor: 'VIE', corto: 'Vie', largo: 'Viernes' },
  { valor: 'SAB', corto: 'Sáb', largo: 'Sábado' },
  { valor: 'DOM', corto: 'Dom', largo: 'Domingo' },
]

const POSICION_DIA = new Map(DIAS.map((dia, posicion) => [dia.valor, posicion]))
const ROTULO_CORTO = new Map(DIAS.map((dia) => [dia.valor, dia.corto]))

/** El primer y el último horario que se pueden cargar, y el paso de la grilla. */
export const HORA_MINIMA = '06:00'
export const HORA_MAXIMA = '22:00'
export const PASO_MINUTOS = 15
/** Lo que dura una clase por defecto, para proponer el fin al elegir el inicio. */
export const DURACION_POR_DEFECTO = 120

/** Los minutos desde la medianoche de un `"HH:MM"`. `null` si no se puede leer. */
export function aMinutos(hora) {
  const partes = /^(\d{1,2}):(\d{2})$/.exec(String(hora ?? '').trim())
  if (partes === null) {
    return null
  }
  const horas = Number(partes[1])
  const minutos = Number(partes[2])
  if (horas > 23 || minutos > 59) {
    return null
  }
  return horas * 60 + minutos
}

/** El `"HH:MM"` de unos minutos desde la medianoche. */
export function aHora(minutos) {
  const horas = Math.floor(minutos / 60)
  return `${String(horas).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
}

/**
 * La hora como se escribe en el resumen: sin minutos cuando valen cero.
 *
 * `19:00` se lee `19` y `18:15` se lee `18:15`. Es la regla del spec y la misma que aplica el
 * backend, para que el texto guardado y el chip digan lo mismo.
 */
export function horaCorta(hora) {
  const minutos = aMinutos(hora)
  if (minutos === null) {
    return null
  }
  if (minutos % 60 === 0) {
    return String(minutos / 60)
  }
  return aHora(minutos)
}

/**
 * Agrupa los horarios que comparten rango, con sus días en orden de semana.
 *
 * Dos días que se dictan a la misma hora son un solo chip: `Lun y Mié 19-21hs` se lee mejor que dos
 * chips iguales salvo por el día. Los grupos salen ordenados por el primer día de la semana que
 * contienen, y los días de cada grupo en el mismo orden.
 */
export function agruparHorarios(horarios) {
  const grupos = new Map()

  for (const horario of horarios ?? []) {
    const clave = `${horario.inicio}-${horario.fin}`
    const grupo = grupos.get(clave) ?? { inicio: horario.inicio, fin: horario.fin, dias: [] }
    if (!grupo.dias.includes(horario.dia)) {
      grupo.dias.push(horario.dia)
    }
    grupos.set(clave, grupo)
  }

  return [...grupos.values()]
    .map((grupo) => ({
      ...grupo,
      dias: [...grupo.dias].sort((uno, otro) => (POSICION_DIA.get(uno) ?? 0) - (POSICION_DIA.get(otro) ?? 0)),
    }))
    .sort((uno, otro) => (POSICION_DIA.get(uno.dias[0]) ?? 0) - (POSICION_DIA.get(otro.dias[0]) ?? 0))
}

/**
 * El texto de un grupo de días con igual rango: `Lun y Mié 19-21hs`.
 *
 * Con más de dos días se enumeran como en castellano —`Lun, Mié y Vie`— porque encadenar `y` entre
 * siete días se lee peor que la lista.
 */
export function describirGrupo(grupo) {
  const dias = grupo.dias.map((dia) => ROTULO_CORTO.get(dia) ?? dia)
  const etiqueta =
    dias.length === 1 ? dias[0] : `${dias.slice(0, -1).join(', ')} y ${dias.at(-1)}`
  return `${etiqueta} ${horaCorta(grupo.inicio)}-${horaCorta(grupo.fin)}hs`
}

/** Los chips del horario, uno por grupo: `['Lun y Mié 19-21hs', 'Mar 18:15-21:30hs']`. */
export function resumenHorarios(horarios) {
  return agruparHorarios(horarios).map(describirGrupo)
}

/** El resumen en una línea, para `dias_horarios` y el texto plano de la tabla. */
export function textoHorarios(horarios) {
  return resumenHorarios(horarios).join(', ')
}

/**
 * Redondea lo que el operador tipeó al múltiplo de 15 más cercano, acotado a 6:00-22:00.
 *
 * Acepta lo que se escribe a mano en el campo de hora: `19`, `19:00`, `19.40`, `13:42`. Devuelve
 * `null` cuando el texto no se puede leer, y quien llama restaura el valor anterior: un campo que
 * se queda con lo que el usuario tipeó sin poder interpretarlo guardaría un horario que no existe.
 */
export function redondearHoraEscrita(texto) {
  const partes = /^(\d{1,2})(?:[:.hm]\s*(\d{1,2}))?$/.exec(String(texto ?? '').trim())
  if (partes === null) {
    return null
  }

  let horas = Number(partes[1])
  let minutos = partes[2] === undefined ? null : Number(partes[2])
  if (horas > 23) {
    return null
  }
  if (minutos !== null && minutos > 59) {
    return null
  }

  // Sin minutos escritos se toma el inicio de la hora: `19` es `19:00`.
  minutos = minutos === null ? 0 : Math.round(minutos / PASO_MINUTOS) * PASO_MINUTOS
  if (minutos === 60) {
    horas += 1
    minutos = 0
  }

  const total = Math.min(Math.max(horas * 60 + minutos, aMinutos(HORA_MINIMA)), aMinutos(HORA_MAXIMA))
  return aHora(total)
}

/**
 * El fin que propone el selector al elegir un inicio: dos horas, topeado en las 22:00.
 *
 * `19:00` propone `21:00` y `21:00` propone `22:00`; `21:30` no puede proponer `23:30` porque el
 * horario no existe, y queda en `22:00`.
 */
export function finSugerido(inicio) {
  const minutos = aMinutos(inicio)
  if (minutos === null) {
    return HORA_MAXIMA
  }
  return aHora(Math.min(minutos + DURACION_POR_DEFECTO, aMinutos(HORA_MAXIMA)))
}

/**
 * El fin después de cambiar el inicio.
 *
 * Se recalcula cuando el fin no se editó a mano, y también cuando el fin que había dejó de ser
 * posterior al inicio: un formulario que conserva un fin anterior al inicio no se puede guardar, y
 * dejar el error a la vista cuando el operador acaba de cambiar el inicio es peor que corregirlo.
 */
export function finAlCambiarInicio(inicio, fin, finEditado) {
  const finAnterior = aMinutos(fin)
  const inicioNuevo = aMinutos(inicio)
  if (!finEditado || finAnterior === null || inicioNuevo === null || finAnterior <= inicioNuevo) {
    return finSugerido(inicio)
  }
  return fin
}
