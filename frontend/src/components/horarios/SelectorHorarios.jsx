import { useEffect, useState } from 'react'
import DatePicker from 'react-datepicker'
import { Button, Modal } from '../ui'
import {
  DIAS,
  HORA_MAXIMA,
  HORA_MINIMA,
  aHora,
  aMinutos,
  agruparHorarios,
  finAlCambiarInicio,
  redondearHoraEscrita,
} from '../../domain/horarios'

/**
 * Selector de horarios de cursada (historia #48).
 *
 * **Trabaja sobre una copia y solo la devuelve con `Listo`.** `Cancelar` y el cierre descartan los
 * cambios, así que el formulario de comisión no puede quedar con un horario a medio armar; el
 * guardado contra la API lo decide el formulario padre, que es el que llama a la API.
 *
 * **Dos modos, y el switch arranca en «mismo horario todos los días».** Es el caso normal de una
 * comisión —dos o tres días con el mismo rango— y evita pedir el mismo dato varias veces. Al pasar a
 * «distinto» se copia el rango a los días activos, para que el operador no arranque de cero; al
 * volver a «mismo» con rangos distintos se pide confirmación, porque descartar horarios sin avisar
 * sería perder trabajo.
 *
 * **Un rango por día.** Dos rangos del mismo día no existen en el modelo (la tabla tiene una fila por
 * día), así que el selector no los ofrece.
 *
 * El título de la maqueta decía «Indica el horario de atención»; acá se llama «Horario de cursada»,
 * que es lo que el dato significa.
 */

/** El rango que propone el selector cuando la comisión todavía no tiene horarios. */
const RANGO_POR_DEFECTO = { inicio: '19:00', fin: '21:00' }

function ordenarDias(dias) {
  const posicion = new Map(DIAS.map((dia, indice) => [dia.valor, indice]))
  return [...new Set(dias)].sort((uno, otro) => posicion.get(uno) - posicion.get(otro))
}

function fechaDeHora(hora) {
  const minutos = aMinutos(hora) ?? 0
  return new Date(2000, 0, 1, Math.floor(minutos / 60), minutos % 60)
}

function horaDeFecha(fecha) {
  if (!(fecha instanceof Date)) {
    return null
  }
  return aHora(fecha.getHours() * 60 + fecha.getMinutes())
}

/**
 * **`true` cuando la pantalla no da para desplegar el popover al lado del campo.**
 *
 * En PC la lista de horas se abre pegada al campo, como cualquier desplegable: es el mismo objeto
 * visual, no una ventana aparte. En móvil el modal ocupa casi toda la pantalla y el popover no
 * tiene dónde quedarse, así que va al portal centrado, que es como se venía usando.
 */
function usePantallaChica() {
  const consulta = '(max-width: 767px)'
  const [chica, setChica] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia(consulta).matches,
  )

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined
    }
    const media = window.matchMedia(consulta)
    const alCambiar = (evento) => setChica(evento.matches)
    media.addEventListener('change', alCambiar)
    return () => media.removeEventListener('change', alCambiar)
  }, [])

  return chica
}

/**
 * Un campo de hora del selector.
 *
 * **Se puede tipear, y lo tipeado se normaliza al confirmar.** El valor vive como string `"HH:MM"`
 * en todo el formulario; el `Date` existe solo acá, en el borde, porque el picker lo pide. Al
 * confirmar —`blur` o `Enter`— los minutos se redondean al múltiplo de 15 más cercano (`13:42` →
 * `13:45`) y, si el texto no se entiende, se restaura el valor anterior: un campo que se queda con
 * algo que no se puede interpretar guardaría un horario que no existe.
 *
 * **El texto que se ve es el tipeado mientras se escribe y el valor normalizado después.** El picker
 * guarda en su propio estado lo que se escribe y no lo vuelve a leer de `selected`; pasarle `value`
 * como string es la única forma de que el campo muestre el valor normalizado al confirmar.
 */
function SelectorHora({ id, etiqueta, valor, minimo, maximo, onCambiar }) {
  const [textoTipeado, setTextoTipeado] = useState(null)
  const enPantallaChica = usePantallaChica()

  function aplicar(hora) {
    if (hora !== null && hora !== valor) {
      onCambiar(hora)
    }
  }

  function alTipear(evento) {
    const texto = evento?.target?.value
    if (typeof texto === 'string') {
      setTextoTipeado(texto)
    }
  }

  /** Al confirmar se vuelve al valor del formulario: el normalizado si se pudo leer, o el anterior. */
  function confirmarTipeo(evento) {
    const texto = evento?.target?.value
    if (typeof texto !== 'string') {
      return
    }
    setTextoTipeado(null)
    aplicar(redondearHoraEscrita(texto))
  }

  return (
    <span className="inline-flex items-center gap-1">
      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>
      <DatePicker
        id={id}
        value={textoTipeado ?? valor}
        selected={fechaDeHora(valor)}
        onChange={(fecha) => aplicar(horaDeFecha(fecha))}
        onChangeRaw={alTipear}
        onBlur={confirmarTipeo}
        onKeyDown={(evento) => {
          if (evento.key === 'Enter') {
            confirmarTipeo(evento)
          }
        }}
        showTimeSelect
        showTimeSelectOnly
        timeIntervals={15}
        timeFormat="HH:mm"
        dateFormat="HH:mm"
        minTime={fechaDeHora(minimo)}
        maxTime={fechaDeHora(maximo)}
        // En pantalla ancha el popover se queda adentro del modal, pegado al campo; en chica se
        // va al portal de `document.body`. El `portalId` tiene que viajar solo con el portal:
        // react-datepicker lo usa en los dos caminos, y con el popover adentro del modal el
        // contenedor del portal —que va al body sin `z-index`— lo dejaba detrás del modal.
        withPortal={enPantallaChica}
        portalId={enPantallaChica ? 'selector-hora' : undefined}
        popperClassName="z-[70]"
        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-800"
        ariaLabelClose="Cerrar el selector de hora"
      />
    </span>
  )
}

/**
 * El estado con el que abre el selector, derivado de los horarios del formulario.
 *
 * **El estado nace acá y no en un efecto que lo reinicie al abrir.** El padre remonta el componente
 * con una `key` distinta en cada apertura, así que lo que el operador canceló no se conserva y el
 * estado inicial se calcula una sola vez por apertura, sin renders en cascada.
 *
 * **Sin horarios guardados no arranca ningún día activo.** Prender los siete por defecto le hace
 * creer al operador que la comisión se dicta todos los días; los días son dato, no valor inicial.
 * Con horarios guardados sí se prenden los que ya tienen fila: editar no puede desmarcar nada.
 */
function estadoInicial(horarios) {
  const grupos = agruparHorarios(horarios ?? [])
  const primero = grupos[0] ?? RANGO_POR_DEFECTO
  const activos = (horarios ?? []).map((dato) => dato.dia)

  return {
    modo: grupos.length <= 1 ? 'mismo' : 'distinto',
    diasActivos: ordenarDias(activos),
    rangoUnico: { inicio: primero.inicio, fin: primero.fin },
    rangos: Object.fromEntries(
      (horarios ?? []).map((dato) => [dato.dia, { inicio: dato.inicio, fin: dato.fin }]),
    ),
  }
}

export function SelectorHorarios({ abierto, horarios, onListo, onCancelar }) {
  const inicial = estadoInicial(horarios)
  const [modo, setModo] = useState(inicial.modo)
  const [diasActivos, setDiasActivos] = useState(inicial.diasActivos)
  const [rangoUnico, setRangoUnico] = useState(inicial.rangoUnico)
  const [rangos, setRangos] = useState(inicial.rangos)
  const [finesEditados, setFinesEditados] = useState({})

  function alternarDia(dia) {
    setDiasActivos((anteriores) =>
      anteriores.includes(dia)
        ? anteriores.filter((candidato) => candidato !== dia)
        : ordenarDias([...anteriores, dia]),
    )
  }

  function cambiarInicioDeLaSemana(inicio) {
    setRangoUnico((anterior) => ({
      inicio,
      fin: finAlCambiarInicio(inicio, anterior.fin, Boolean(finesEditados.unico)),
    }))
  }

  function cambiarFinDeLaSemana(fin) {
    setFinesEditados((anteriores) => ({ ...anteriores, unico: true }))
    setRangoUnico((anterior) => ({ ...anterior, fin }))
  }

  function cambiarInicioDelDia(dia, inicio) {
    setRangos((anteriores) => {
      const actual = anteriores[dia] ?? rangoUnico
      return {
        ...anteriores,
        [dia]: { inicio, fin: finAlCambiarInicio(inicio, actual.fin, Boolean(finesEditados[dia])) },
      }
    })
  }

  function cambiarFinDelDia(dia, fin) {
    setFinesEditados((anteriores) => ({ ...anteriores, [dia]: true }))
    setRangos((anteriores) => ({
      ...anteriores,
      [dia]: { ...(anteriores[dia] ?? rangoUnico), fin },
    }))
  }

  function cambiarModo() {
    if (modo === 'mismo') {
      // Pasar a distinto copia el rango único a los días activos: arrancar con filas vacías
      // obligaría a cargar otra vez algo que el operador ya eligió.
      setRangos(Object.fromEntries(diasActivos.map((dia) => [dia, { ...rangoUnico }])))
      setFinesEditados({})
      setModo('distinto')
      return
    }

    const rangosDeLosDias = diasActivos.map((dia) => rangos[dia] ?? rangoUnico)
    const distintos = new Set(rangosDeLosDias.map((rango) => `${rango.inicio}-${rango.fin}`))
    if (distintos.size > 1) {
      const confirmado = window.confirm(
        'Los días tienen horarios distintos. Se va a usar el horario del primer día activo para ' +
          'todos. ¿Continuar?',
      )
      if (!confirmado) {
        return
      }
    }

    const primero = ordenarDias(diasActivos)[0]
    setRangoUnico({ ...(rangos[primero] ?? rangoUnico) })
    setFinesEditados({})
    setModo('mismo')
  }

  function confirmar() {
    const resultado = ordenarDias(diasActivos).map((dia) => ({
      dia,
      ...(modo === 'mismo' ? rangoUnico : (rangos[dia] ?? rangoUnico)),
    }))
    onListo(resultado)
  }

  const diasDeLaSemana = modo === 'mismo' ? [] : ordenarDias(diasActivos)

  return (
    <Modal
      abierto={abierto}
      titulo="Horario de cursada"
      onClose={onCancelar}
      pie={
        <>
          <Button variante="secundario" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={diasActivos.length === 0}>
            Listo
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-3 py-2">
          <span className="text-sm font-medium text-slate-700">Mismo horario todos los días</span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Mismo horario todos los días"
            checked={modo === 'mismo'}
            onChange={cambiarModo}
            className="foco-acento h-5 w-9 cursor-pointer accent-[color:var(--acento)]"
          />
        </label>

        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-500">DÍAS</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DIAS.map((dia) => {
              const activo = diasActivos.includes(dia.valor)
              return (
                <button
                  key={dia.valor}
                  type="button"
                  aria-pressed={activo}
                  aria-label={dia.largo}
                  onClick={() => alternarDia(dia.valor)}
                  className={`foco-acento inline-flex h-10 w-12 items-center justify-center rounded-lg border text-sm font-medium transition ${
                    activo
                      ? 'boton-primario border-transparent text-white'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {dia.corto}
                </button>
              )
            })}
          </div>
        </div>

        {modo === 'mismo' ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-3">
            <span className="text-sm text-slate-600">De</span>
            <SelectorHora
              id="horario-inicio"
              etiqueta="Hora de inicio"
              valor={rangoUnico.inicio}
              minimo={HORA_MINIMA}
              maximo="21:45"
              onCambiar={cambiarInicioDeLaSemana}
            />
            <span className="text-sm text-slate-600">a</span>
            <SelectorHora
              id="horario-fin"
              etiqueta="Hora de fin"
              valor={rangoUnico.fin}
              minimo={rangoUnico.inicio}
              maximo={HORA_MAXIMA}
              onCambiar={cambiarFinDeLaSemana}
            />
            <span className="text-sm text-slate-500">hs</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {diasDeLaSemana.map((dia) => {
              const rango = rangos[dia] ?? rangoUnico
              const etiqueta = DIAS.find((candidato) => candidato.valor === dia)?.largo ?? dia
              return (
                <div key={dia} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="w-24 text-sm font-medium text-slate-700">{etiqueta}</span>
                  <SelectorHora
                    id={`horario-inicio-${dia}`}
                    etiqueta={`Hora de inicio del ${etiqueta}`}
                    valor={rango.inicio}
                    minimo={HORA_MINIMA}
                    maximo="21:45"
                    onCambiar={(inicio) => cambiarInicioDelDia(dia, inicio)}
                  />
                  <span className="text-sm text-slate-600">a</span>
                  <SelectorHora
                    id={`horario-fin-${dia}`}
                    etiqueta={`Hora de fin del ${etiqueta}`}
                    valor={rango.fin}
                    minimo={rango.inicio}
                    maximo={HORA_MAXIMA}
                    onCambiar={(fin) => cambiarFinDelDia(dia, fin)}
                  />
                  <span className="text-sm text-slate-500">hs</span>
                </div>
              )
            })}
          </div>
        )}

        {diasActivos.length === 0 && (
          <p role="alert" className="text-sm text-red-700">
            Elegí al menos un día para poder guardar el horario.
          </p>
        )}
      </div>
    </Modal>
  )
}
