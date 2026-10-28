import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Campo, Card, Input, Modal, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import {
  ESTADO_COBRANZA,
  MEDIO_PAGO_LABELS,
  TIPO_FACTURA,
  TITULAR_SIN_IDENTIFICAR,
  TRANSICIONES_ESTADO_COBRANZA,
} from '../domain/enums'
import { normalizeDocumento, normalizeWords } from '../domain/normalize'
import {
  actualizarEstadoCobranza,
  agregarImputaciones,
  listarAlumnos,
  listarCobranzas,
  listarInscripcionesDeAlumno,
  registrarCobranza,
} from '../services/dataService'
import { formatFechaCorta, formatMoneda } from '../utils/formato'

/**
 * Cobranzas e ingresos (9.6).
 *
 * **El formulario va embebido y no en un modal.** Un modal para registrar un comprobante obliga a
 * abrir, completar y cerrar para ver si el cobro entró en el historial, que es justo lo que la
 * secretaría necesita verificar.
 *
 * **El titular y el alumno imputado son dos campos, y esa separación es el punto de la pantalla.**
 * El pagador puede ser un tercero —un familiar, una empresa— y el pago se imputa al alumno que
 * queda reflejado en su legajo. El modelo lo sostiene con `Pagador` separado de `Alumno` y con la
 * imputación de destino único (D7).
 *
 * **El alumno se elige con un combobox, no con un buscador y un `<select>` separados.** Dos campos
 * para una sola decisión obligaban a buscar, mirar el select y volver a elegir; acá se escribe el
 * nombre, el apellido, el DNI o el email y la coincidencia se elige en la misma lista. Después de
 * elegir, el bloque compacto muestra a quién se imputa y deja cambiarlo sin perder el resto del
 * formulario.
 *
 * **Hu 21:** el botón habla con `POST /cobranzas` y el historial con `GET /cobranzas`. Si el
 * backend rechaza el alta, la pantalla lo dice y no confirma nada: una fila de mentira sería peor
 * que un error visible.
 *
 * **Edición del estado:** cualquier cobranza se corrige desde la columna `ACCIONES`, con un modal
 * que muestra los datos del cobro, ofrece solo los destinos válidos, pide la justificación y
 * confirma antes de guardar. Se actualiza la fila, no se crea otro cobro: el pago y su imputación
 * ya existen.
 *
 * **HU 23:** la imputación tiene tres modos —un alumno, varios alumnos o sin imputar— y el reparto
 * se arma con el mismo editor en el alta y en `Agregar imputación` del historial. Siempre es una
 * sola cobranza: lo que se agrega son imputaciones al saldo, y el backend vuelve a validar el total.
 */

const ESTADOS_GESTION = new Map([
  [ESTADO_COBRANZA.ACREDITADO, { tono: TONO.VERDE }],
  [ESTADO_COBRANZA.OBSERVADO, { tono: TONO.AMBAR }],
  [ESTADO_COBRANZA.RECHAZADO, { tono: TONO.ROJO }],
])

/** El estado como se escribe en un aviso, en el mismo idioma que la pantalla del alumno. */
const ETIQUETA_ESTADO = {
  [ESTADO_COBRANZA.ACREDITADO]: 'Acreditado',
  [ESTADO_COBRANZA.OBSERVADO]: 'Observado',
  [ESTADO_COBRANZA.RECHAZADO]: 'Rechazado',
}

const COLUMNAS = [
  { clave: 'fecha', titulo: 'FECHA', render: (fila) => formatFechaCorta(fila.fecha) },
  {
    clave: 'titular',
    titulo: 'TITULAR DEL PAGO',
    render: (fila) => <span className="font-medium">{fila.pagador.nombre}</span>,
  },
  {
    clave: 'imputado',
    titulo: 'ALUMNO IMPUTADO',
    // Vacía de verdad cuando el comprobante todavía no tiene a quién imputarse. Con un reparto se
    // nombra el primero y cuántos más hay, sin inventar una fila por alumno.
    render: (fila) => {
      const imputaciones = imputacionesDe(fila)
      if (imputaciones.length === 0) {
        return ''
      }
      const [primera, ...resto] = imputaciones
      return resto.length === 0 ? primera.nombre : `${primera.nombre} +${resto.length}`
    },
  },
  {
    clave: 'medio',
    titulo: 'MEDIO',
    render: (fila) => MEDIO_PAGO_LABELS[fila.medio],
  },
  {
    clave: 'factura',
    titulo: 'FACTURA A',
    // La HU 21 guarda la solicitud, no emite la factura. Sin solicitud no se inventa una B.
    render: (fila) => {
      const tipo = fila.factura ?? (fila.factura_a_solicitada ? TIPO_FACTURA.A : null)
      if (tipo === null || tipo === undefined) {
        return <span className="text-slate-400">—</span>
      }
      return <Badge tono={tipo === TIPO_FACTURA.A ? TONO.CELESTE : TONO.GRIS}>{tipo}</Badge>
    },
  },
  { clave: 'importe', titulo: 'IMPORTE', render: (fila) => formatMoneda(fila.importe) },
  {
    clave: 'estado',
    titulo: 'ESTADO GESTIÓN',
    render: (fila) => (
      <span className="inline-flex flex-col items-start gap-1">
        <Badge tono={ESTADOS_GESTION.get(fila.estado)?.tono ?? TONO.GRIS}>{fila.estado}</Badge>
        {fila.estado !== ESTADO_COBRANZA.ACREDITADO && fila.causa !== null && fila.causa !== '' && (
          <span className="text-xs text-amber-800">{fila.causa}</span>
        )}
      </span>
    ),
  },
]

/** Un dato de solo lectura del modal de edición: rótulo arriba, valor abajo. */
function Dato({ etiqueta, valor }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{etiqueta}</dt>
      <dd className="text-slate-900">{valor}</dd>
    </div>
  )
}

const FORMULARIO_VACIO = {
  fecha: '',
  importe: '',
  medio: '',
  titular: '',
  alumnoId: '',
  inscripcionId: '',
  estado: ESTADO_COBRANZA.ACREDITADO,
  causa: '',
  facturaA: false,
  cuitFactura: '',
}

/** La fecha de hoy en el formato del `<input type="date">`. */
function fechaDeHoy() {
  const hoy = new Date()
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  const dia = String(hoy.getDate()).padStart(2, '0')
  return `${hoy.getFullYear()}-${mes}-${dia}`
}

function esFechaFutura(fecha) {
  return fecha !== '' && fecha > fechaDeHoy()
}

/** Dígito verificador de CUIT, con la misma regla que el backend (historia #18). */
function cuitValido(valor) {
  const digitos = String(valor).replace(/\D/g, '')
  if (digitos.length !== 11) {
    return false
  }
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((total, peso, indice) => total + Number(digitos[indice]) * peso, 0)
  const resto = suma % 11
  const verificador = resto === 0 ? '0' : resto === 1 ? '9' : String(11 - resto)
  return digitos[10] === verificador
}

/**
 * Coincidencia parcial del combobox: nombre, apellido, DNI o email.
 *
 * Se comparan palabras normalizadas —sin tildes ni signos— y, aparte, el documento normalizado.
 * Así `perez`, `Pérez`, `38.456` y `@gmail` encuentran al mismo alumno.
 */
function alumnoCoincide(alumno, consulta) {
  const palabras = normalizeWords(consulta).join(' ')
  const documento = normalizeDocumento(consulta)

  if (palabras === '' && documento === '') {
    return false
  }

  const texto = normalizeWords(`${alumno.nombre} ${alumno.email ?? ''}`).join(' ')
  const documentoAlumno = normalizeDocumento(alumno.documento)

  return (
    (palabras !== '' && texto.includes(palabras)) ||
    (documento !== '' && documentoAlumno.includes(documento))
  )
}

/**
 * Cómo se reparte el pago (HU 23). `UNO` es el comportamiento de la HU 21: el importe completo va
 * al alumno elegido. `VARIOS` reparte entre varias inscripciones y `SIN_IMPUTAR` deja el saldo para
 * imputarlo después desde el historial.
 */
const MODO = { UNO: 'UNO', VARIOS: 'VARIOS', SIN_IMPUTAR: 'SIN_IMPUTAR' }

const MODOS = [
  { valor: MODO.UNO, etiqueta: 'Un alumno' },
  { valor: MODO.VARIOS, etiqueta: 'Varios alumnos' },
  { valor: MODO.SIN_IMPUTAR, etiqueta: 'Sin imputar' },
]

/** Imputaciones de una fila, con o sin el arreglo explícito que agrega la HU 23. */
function imputacionesDe(fila) {
  if (fila.imputaciones !== undefined) {
    return fila.imputaciones
  }
  return fila.imputacion === null || fila.imputacion === undefined ? [] : [fila.imputacion]
}

function sumaDeImputaciones(fila) {
  return imputacionesDe(fila).reduce(
    (suma, imputacion) => suma + Number(imputacion.monto ?? fila.importe ?? 0),
    0,
  )
}

/** Cuántos alumnos distintos tiene imputados la cobranza (las empresas no cuentan). */
function cantidadDeAlumnosImputados(fila) {
  const claves = imputacionesDe(fila)
    .filter((imputacion) => imputacion.destino !== 'EMPRESA')
    .map((imputacion) => imputacion.alumno_id ?? imputacion.nombre)
  return new Set(claves).size
}

function saldoDe(fila) {
  return Math.max(Number(fila.importe ?? 0) - sumaDeImputaciones(fila), 0)
}

let siguienteFila = 0

function filaDeDistribucion() {
  siguienteFila += 1
  return {
    clave: `fila-distribucion-${siguienteFila}`,
    alumnoId: '',
    inscripcionId: '',
    monto: '',
    inscripciones: [],
    cargando: false,
    error: null,
  }
}

/**
 * Filas de una distribución entre varios alumnos. Cada fila resuelve su inscripción activa con el
 * mismo servicio que usa el alta de un solo alumno, así la regla no se duplica.
 */
function useDistribucion() {
  const [filas, setFilas] = useState([])

  function actualizar(clave, cambios) {
    setFilas((actuales) =>
      actuales.map((fila) => (fila.clave === clave ? { ...fila, ...cambios } : fila)),
    )
  }

  function agregar() {
    setFilas((actuales) => [...actuales, filaDeDistribucion()])
  }

  function quitar(clave) {
    setFilas((actuales) => actuales.filter((fila) => fila.clave !== clave))
  }

  function cambiarMonto(clave, monto) {
    actualizar(clave, { monto })
  }

  function cambiarInscripcion(clave, inscripcionId) {
    actualizar(clave, { inscripcionId })
  }

  async function elegirAlumno(clave, alumnoId) {
    actualizar(clave, {
      alumnoId,
      inscripcionId: '',
      inscripciones: [],
      error: null,
      cargando: alumnoId !== '',
    })
    if (alumnoId === '') {
      return
    }
    try {
      const lista = await listarInscripcionesDeAlumno(Number(alumnoId))
      actualizar(clave, {
        inscripciones: lista,
        inscripcionId: lista.length === 1 ? String(lista[0].id) : '',
        cargando: false,
        error:
          lista.length === 0
            ? 'El alumno no tiene una inscripción activa para imputar el pago.'
            : null,
      })
    } catch (error) {
      actualizar(clave, {
        cargando: false,
        error: error?.message ?? 'No pudimos consultar las inscripciones.',
      })
    }
  }

  /** Reparte el total en partes iguales, con los centavos del redondeo en la última fila. */
  function distribuir(total) {
    setFilas((actuales) => {
      const centavos = Math.round(Number(total) * 100)
      if (actuales.length === 0 || !Number.isFinite(centavos) || centavos <= 0) {
        return actuales
      }
      const base = Math.floor(centavos / actuales.length)
      return actuales.map((fila, indice) => ({
        ...fila,
        monto: (
          (indice === actuales.length - 1 ? centavos - base * (actuales.length - 1) : base) / 100
        ).toFixed(2),
      }))
    })
  }

  function reiniciar(cantidad = 0) {
    setFilas(Array.from({ length: cantidad }, () => filaDeDistribucion()))
  }

  return {
    filas,
    agregar,
    quitar,
    elegirAlumno,
    cambiarMonto,
    cambiarInscripcion,
    distribuir,
    reiniciar,
  }
}

/** Reglas de la distribución que la pantalla puede avisar antes de mandar el alta. */
function erroresDeDistribucion(filas, total, minimoAlumnos = 1) {
  const errores = []
  if (filas.length < minimoAlumnos) {
    errores.push(`Agregá al menos ${minimoAlumnos} alumnos.`)
  }
  filas.forEach((fila, indice) => {
    if (fila.alumnoId === '') {
      errores.push(`Elegí el alumno de la fila ${indice + 1}.`)
    } else if (fila.inscripcionId === '') {
      errores.push(`Elegí la inscripción de la fila ${indice + 1}.`)
    }
    if (fila.monto.trim() === '' || !(Number(fila.monto) > 0)) {
      errores.push(`El importe de la fila ${indice + 1} tiene que ser mayor a cero.`)
    }
  })
  const alumnosElegidos = filas.map((fila) => fila.alumnoId).filter((id) => id !== '')
  if (new Set(alumnosElegidos).size !== alumnosElegidos.length) {
    errores.push('Cada alumno tiene que ser distinto.')
  }
  const repartido = filas.reduce((suma, fila) => suma + Number(fila.monto || 0), 0)
  if (repartido > Number(total)) {
    errores.push('La suma de las imputaciones no puede superar el importe cobrado.')
  }
  return errores
}

/**
 * Buscador de alumno por nombre, apellido, DNI o email (HU 21, reutilizado por la HU 23).
 *
 * Es el mismo combobox en `Un alumno` y en cada fila de una distribución: se escribe y la
 * coincidencia se elige en la misma lista. Al elegir queda el bloque compacto con `Cambiar`.
 */
function BuscadorAlumno({
  id,
  etiqueta,
  alumnos,
  alumnoId,
  obligatorio = false,
  onElegir,
  onLimpiar,
}) {
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [indiceActivo, setIndiceActivo] = useState(-1)
  const inputRef = useRef(null)
  const volverAlBuscador = useRef(false)

  const elegido = alumnos.find((alumno) => String(alumno.id) === String(alumnoId)) ?? null

  /** El input se remonta al volver de `Cambiar`; el foco tiene que seguir donde estaba. */
  useEffect(() => {
    if (alumnoId === '' && volverAlBuscador.current) {
      volverAlBuscador.current = false
      inputRef.current?.focus()
    }
  }, [alumnoId])

  const visibles = useMemo(() => {
    const consulta = busqueda.trim()
    return consulta === '' ? alumnos : alumnos.filter((alumno) => alumnoCoincide(alumno, consulta))
  }, [alumnos, busqueda])

  function elegir(alumno) {
    setBusqueda('')
    setAbierto(false)
    setIndiceActivo(-1)
    onElegir(alumno)
  }

  function cambiar() {
    volverAlBuscador.current = true
    onLimpiar()
  }

  function cambiarBusqueda(evento) {
    setBusqueda(evento.target.value)
    setAbierto(true)
    setIndiceActivo(-1)
  }

  /** Teclado del combobox: flechas para recorrer, Enter para elegir, Escape para cerrar. */
  function tecla(evento) {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setAbierto(true)
      setIndiceActivo((indice) => Math.min(indice + 1, visibles.length - 1))
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setIndiceActivo((indice) => Math.max(indice - 1, 0))
    } else if (evento.key === 'Enter') {
      const alumno = visibles[indiceActivo]
      if (abierto && alumno !== undefined) {
        evento.preventDefault()
        elegir(alumno)
      }
    } else if (evento.key === 'Escape') {
      setAbierto(false)
      setIndiceActivo(-1)
    } else if (evento.key === 'Tab') {
      setAbierto(false)
    }
  }

  return (
    <Campo id={id} etiqueta={etiqueta} obligatorio={obligatorio}>
      {elegido !== null ? (
        <div
          role="group"
          aria-label={etiqueta}
          className="flex items-center justify-between gap-3 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{elegido.nombre}</p>
            <p className="text-xs text-slate-600">
              {elegido.documento ? `DNI ${elegido.documento}` : 'Sin documento'}
            </p>
          </div>
          <Button variante="secundario" tamano="chico" onClick={cambiar}>
            Cambiar
          </Button>
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            id={id}
            type="text"
            role="combobox"
            aria-expanded={abierto}
            aria-controls={`${id}-coincidencias`}
            aria-autocomplete="list"
            aria-activedescendant={
              abierto && visibles[indiceActivo] !== undefined
                ? `${id}-opcion-${visibles[indiceActivo].id}`
                : undefined
            }
            autoComplete="off"
            placeholder="Buscar por nombre, apellido, DNI o email…"
            value={busqueda}
            onChange={cambiarBusqueda}
            onKeyDown={tecla}
            onFocus={() => setAbierto(true)}
            onBlur={() => setAbierto(false)}
            className="foco-acento w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
          />
          {abierto && (
            <ul
              id={`${id}-coincidencias`}
              role="listbox"
              aria-label="Alumnos coincidentes"
              className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            >
              {visibles.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-500">No hay alumnos que coincidan.</li>
              ) : (
                visibles.map((alumno, indice) => (
                  <li
                    key={alumno.id}
                    id={`${id}-opcion-${alumno.id}`}
                    role="option"
                    aria-selected={indice === indiceActivo}
                    onMouseDown={(evento) => evento.preventDefault()}
                    onClick={() => elegir(alumno)}
                    className={`cursor-pointer px-3 py-2 text-sm ${
                      indice === indiceActivo ? 'bg-slate-100' : ''
                    }`}
                  >
                    <span className="block font-medium text-slate-900">{alumno.nombre}</span>
                    <span className="block text-xs text-slate-500">
                      {alumno.documento ? `DNI ${alumno.documento}` : 'Sin documento'}
                      {alumno.email ? ` · ${alumno.email}` : ''}
                    </span>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </Campo>
  )
}

/**
 * Editor de una distribución: una fila por alumno con su inscripción y su importe, más el total
 * recibido, lo distribuido y el saldo sin imputar. Se usa en el alta y en la imputación posterior.
 */
function EditorDistribucion({
  idPrefijo,
  filas,
  total,
  alumnos,
  error = null,
  etiquetaAgregar = 'Agregar alumno',
  minimoAlumnos = 1,
  onAgregar,
  onQuitar,
  onAlumno,
  onMonto,
  onInscripcion,
  onDistribuir,
}) {
  const repartido = filas.reduce((suma, fila) => suma + Number(fila.monto || 0), 0)
  const totalRecibido = Number(total || 0)
  const saldo = totalRecibido - repartido
  const alumnosElegidos = filas.map((fila) => fila.alumnoId).filter((id) => id !== '')
  const hayRepetidos = new Set(alumnosElegidos).size !== alumnosElegidos.length

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variante="secundario" tamano="chico" onClick={onAgregar}>
          {etiquetaAgregar}
        </Button>
        <Button
          variante="secundario"
          tamano="chico"
          onClick={() => onDistribuir(total)}
          disabled={filas.length === 0}
        >
          Distribuir en partes iguales
        </Button>
      </div>

      {filas.length === 0 ? (
        <p className="text-xs text-slate-500">Agregá un alumno para repartir el pago.</p>
      ) : (
        <>
          {filas.length < minimoAlumnos && (
            <p className="text-xs text-slate-500">
              Necesitás al menos {minimoAlumnos} alumnos distintos.
            </p>
          )}
          {hayRepetidos && (
            <p role="alert" className="text-xs font-medium text-red-700">
              Cada alumno tiene que ser distinto.
            </p>
          )}
        </>
      )}
      {filas.length > 0 && (
        <ul className="space-y-2">
          {filas.map((fila, indice) => (
            <li
              key={fila.clave}
              className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2"
            >
              <BuscadorAlumno
                id={`${idPrefijo}-${fila.clave}-alumno`}
                etiqueta={`Alumno ${indice + 1}`}
                alumnos={alumnos}
                alumnoId={fila.alumnoId}
                obligatorio
                onElegir={(alumno) => onAlumno(fila.clave, String(alumno.id))}
                onLimpiar={() => onAlumno(fila.clave, '')}
              />

              <Campo
                id={`${idPrefijo}-${fila.clave}-inscripcion`}
                etiqueta={`Inscripción del alumno ${indice + 1}`}
                obligatorio
                error={fila.error}
              >
                {fila.alumnoId === '' ? (
                  <p className="text-xs text-slate-500">
                    Elegí el alumno para ver sus inscripciones.
                  </p>
                ) : fila.cargando ? (
                  <p className="text-xs text-slate-500">Cargando inscripciones…</p>
                ) : fila.inscripciones.length > 1 ? (
                  <select
                    id={`${idPrefijo}-${fila.clave}-inscripcion`}
                    value={fila.inscripcionId}
                    onChange={(evento) => onInscripcion(fila.clave, evento.target.value)}
                  >
                    <option value="">Seleccionar…</option>
                    {fila.inscripciones.map((inscripcion) => (
                      <option key={inscripcion.id} value={String(inscripcion.id)}>
                        {inscripcion.comision.codigo} — {inscripcion.comision.nombre}
                      </option>
                    ))}
                  </select>
                ) : fila.inscripciones.length === 1 ? (
                  <p className="text-sm text-slate-700">
                    {fila.inscripciones[0].comision.codigo} —{' '}
                    {fila.inscripciones[0].comision.nombre}
                  </p>
                ) : null}
              </Campo>

              <Input
                id={`${idPrefijo}-${fila.clave}-monto`}
                etiqueta="Importe imputado (AR$)"
                type="number"
                valor={fila.monto}
                onChange={(evento) => onMonto(fila.clave, evento.target.value)}
                obligatorio
              />

              <div className="flex items-end">
                <Button variante="fantasma" tamano="chico" onClick={() => onQuitar(fila.clave)}>
                  Quitar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <dl className="grid gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-3">
        <Dato etiqueta="Total recibido" valor={formatMoneda(totalRecibido)} />
        <Dato etiqueta="Distribuido" valor={formatMoneda(repartido)} />
        <Dato etiqueta="Sin imputar" valor={formatMoneda(saldo)} />
      </dl>

      {/* Con el importe cobrado vacío los avisos de saldo no dicen nada útil. */}
      {totalRecibido > 0 && saldo > 0 && (
        <p role="status" className="text-sm text-amber-800">
          Quedan {formatMoneda(saldo)} sin imputar.
        </p>
      )}

      {totalRecibido > 0 && saldo < 0 && (
        <p role="alert" className="text-sm font-medium text-red-700">
          La distribución supera el importe recibido en {formatMoneda(-saldo)}.
        </p>
      )}

      {error !== null && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Detalle de las imputaciones de una cobranza, desplegado debajo de su fila (HU 23).
 *
 * Se lee con los datos que ya trae `GET /cobranzas`: nombre y monto de cada imputación, más el
 * total del comprobante, lo imputado y el saldo. No hay endpoint nuevo.
 */
function DetalleImputaciones({ fila }) {
  const imputaciones = imputacionesDe(fila)

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Imputaciones</p>
        {imputaciones.length === 0 ? (
          <p className="text-sm text-slate-600">Sin imputaciones: el importe está sin asignar.</p>
        ) : (
          <ul className="mt-1 divide-y divide-slate-200">
            {imputaciones.map((imputacion) => (
              <li
                key={imputacion.id}
                className="flex flex-wrap items-center justify-between gap-2 py-1 text-sm"
              >
                <span className="text-slate-900">
                  {imputacion.nombre}
                  {imputacion.destino === 'EMPRESA' && (
                    <span className="ml-2 text-xs text-slate-500">(empresa)</span>
                  )}
                </span>
                <span className="font-medium text-slate-900 tabular-nums">
                  {formatMoneda(Number(imputacion.monto ?? fila.importe ?? 0))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <dl className="grid gap-3 rounded-lg bg-white p-3 text-sm sm:grid-cols-3">
        <Dato etiqueta="Importe total" valor={formatMoneda(fila.importe)} />
        <Dato etiqueta="Total imputado" valor={formatMoneda(sumaDeImputaciones(fila))} />
        <Dato etiqueta="Saldo disponible" valor={formatMoneda(saldoDe(fila))} />
      </dl>
    </div>
  )
}

export function PaymentsPage() {
  const [cobranzas, setCobranzas] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO)
  const [busquedaTitular, setBusquedaTitular] = useState('')
  const [inscripciones, setInscripciones] = useState([])
  const [cargandoInscripciones, setCargandoInscripciones] = useState(false)
  const [errorInscripciones, setErrorInscripciones] = useState(null)
  const [errores, setErrores] = useState([])
  const [aviso, setAviso] = useState(null)
  const [errorApi, setErrorApi] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [cobranzaEnEdicion, setCobranzaEnEdicion] = useState(null)
  const [estadoNuevo, setEstadoNuevo] = useState('')
  const [titularNuevo, setTitularNuevo] = useState('')
  const [justificacion, setJustificacion] = useState('')
  const [confirmandoCambio, setConfirmandoCambio] = useState(false)
  const [errorEstado, setErrorEstado] = useState(null)
  const [guardandoEstado, setGuardandoEstado] = useState(false)
  const [modo, setModo] = useState(MODO.UNO)
  const distribucion = useDistribucion()
  const [cobranzaAImputar, setCobranzaAImputar] = useState(null)
  const imputacionPosterior = useDistribucion()
  const [errorImputacion, setErrorImputacion] = useState(null)
  const [guardandoImputacion, setGuardandoImputacion] = useState(false)
  const [detalleAbierto, setDetalleAbierto] = useState(null)
  //: Saldo que se confirmó al intentar registrar un reparto parcial; `null` si no hay confirmación.
  const [confirmandoParcial, setConfirmandoParcial] = useState(null)

  useEffect(() => {
    listarCobranzas()
      .then(setCobranzas)
      .catch(() => setCobranzas([]))
    listarAlumnos()
      .then(setAlumnos)
      .catch(() => setAlumnos([]))
  }, [])

  const cobranzasVisibles = useMemo(() => {
    const aguja = busquedaTitular.trim().toLowerCase()
    if (aguja === '') {
      return cobranzas
    }
    return cobranzas.filter((fila) => fila.pagador.nombre.toLowerCase().includes(aguja))
  }, [cobranzas, busquedaTitular])

  function cambiar(campo) {
    return (evento) => setFormulario((anterior) => ({ ...anterior, [campo]: evento.target.value }))
  }

  /**
   * Al elegir un alumno se traen sus inscripciones activas. Con una sola se selecciona sola;
   * con varias el administrador tiene que elegir; sin ninguna no se puede imputar el pago.
   */
  async function elegirAlumno(alumno) {
    setFormulario((anterior) => ({
      ...anterior,
      alumnoId: String(alumno.id),
      inscripcionId: '',
    }))
    setInscripciones([])
    setErrorInscripciones(null)
    setCargandoInscripciones(true)

    try {
      const lista = await listarInscripcionesDeAlumno(alumno.id)
      setInscripciones(lista)
      if (lista.length === 1) {
        setFormulario((anterior) => ({
          ...anterior,
          inscripcionId: String(lista[0].id),
        }))
      } else if (lista.length === 0) {
        setErrorInscripciones('El alumno no tiene una inscripción activa para imputar el pago.')
      }
    } catch (error) {
      setErrorInscripciones(error?.message ?? 'No pudimos consultar las inscripciones.')
    } finally {
      setCargandoInscripciones(false)
    }
  }

  /** El botón `Cambiar` devuelve el formulario al combobox sin tocar el resto de los datos. */
  function volverAElegirAlumno() {
    setFormulario((anterior) => ({ ...anterior, alumnoId: '', inscripcionId: '' }))
    setInscripciones([])
    setErrorInscripciones(null)
    setCargandoInscripciones(false)
  }

  function faltantes() {
    const errores = []

    if (formulario.fecha === '') {
      errores.push('Fecha Pago')
    } else if (esFechaFutura(formulario.fecha)) {
      errores.push('Fecha Pago')
    }
    if (formulario.importe.trim() === '' || Number(formulario.importe) <= 0) {
      errores.push('Importe Cobrado (AR$)')
    }
    if (formulario.medio === '') {
      errores.push('Medio de Pago')
    }
    if (modo === MODO.UNO && formulario.alumnoId !== '' && formulario.inscripcionId === '') {
      errores.push('Inscripción a imputar')
    }
    if (modo === MODO.VARIOS) {
      errores.push(...erroresDeDistribucion(distribucion.filas, formulario.importe, 2))
    }
    if (formulario.facturaA) {
      if (formulario.cuitFactura.trim() === '' || !cuitValido(formulario.cuitFactura)) {
        errores.push('CUIT del Titular')
      }
    }
    if (formulario.estado !== ESTADO_COBRANZA.ACREDITADO && formulario.causa.trim() === '') {
      errores.push('Causa del comprobante no acreditado')
    }

    return errores
  }

  async function registrar() {
    const faltando = faltantes()
    setErrores(faltando)
    setErrorApi(null)

    if (faltando.length > 0) {
      setAviso(null)
      return
    }

    // Un reparto incompleto se puede guardar, pero la pantalla lo dice antes y pide confirmación.
    // La confirmación vale para este saldo: si cambia el reparto, hay que volver a confirmarla.
    if (modo === MODO.VARIOS && confirmandoParcial !== saldoDistribucion && saldoDistribucion > 0) {
      setConfirmandoParcial(saldoDistribucion)
      setAviso(null)
      return
    }

    setEnviando(true)
    try {
      const soloUnAlumno = modo === MODO.UNO && formulario.alumnoId !== ''
      const nueva = await registrarCobranza({
        fecha: formulario.fecha,
        titular:
          formulario.titular.trim() === '' ? TITULAR_SIN_IDENTIFICAR : formulario.titular.trim(),
        medio: formulario.medio,
        importe: Number(formulario.importe),
        estado: formulario.estado,
        causa: formulario.estado === ESTADO_COBRANZA.ACREDITADO ? null : formulario.causa,
        alumno_id: soloUnAlumno ? Number(formulario.alumnoId) : null,
        inscripcion_id:
          soloUnAlumno && formulario.inscripcionId !== '' ? Number(formulario.inscripcionId) : null,
        // El backend valida otra vez el saldo: acá solo se arma el reparto.
        imputaciones:
          modo === MODO.VARIOS
            ? distribucion.filas.map((fila) => ({
                inscripcion_id: Number(fila.inscripcionId),
                monto: Number(fila.monto),
              }))
            : null,
        factura_a_solicitada: formulario.facturaA,
        cuit_titular: formulario.facturaA ? formulario.cuitFactura.trim() : null,
      })

      setFormulario(FORMULARIO_VACIO)
      setInscripciones([])
      setErrorInscripciones(null)
      setModo(MODO.UNO)
      distribucion.reiniciar()
      setConfirmandoParcial(null)
      setAviso(`Se registró el cobro del ${formatFechaCorta(nueva.fecha)}.`)

      try {
        setCobranzas(await listarCobranzas())
      } catch {
        // El alta ya está confirmada por el backend: si falla la recarga, no se niega el pago.
        setCobranzas((anteriores) => [nueva, ...anteriores])
      }
    } catch (error) {
      setAviso(null)
      setErrorApi(error?.message ?? 'No pudimos registrar el cobro.')
    } finally {
      setEnviando(false)
    }
  }

  /**
   * Cambiar de modo no arrastra datos del anterior: el alumno elegido en `UNO` no puede quedar
   * imputado por accidente al pasar a `VARIOS`, y las filas del reparto no sobreviven al volver.
   */
  function cambiarModo(nuevoModo) {
    setModo(nuevoModo)
    setConfirmandoParcial(null)
    if (nuevoModo !== MODO.UNO) {
      setFormulario((anterior) => ({ ...anterior, alumnoId: '', inscripcionId: '' }))
      setInscripciones([])
      setErrorInscripciones(null)
    }
    // El reparto arranca con dos filas: con una sola el modo se confundía con `Un alumno`.
    distribucion.reiniciar(nuevoModo === MODO.VARIOS ? 2 : 0)
  }

  function abrirImputacionPosterior(fila) {
    setCobranzaAImputar(fila)
    imputacionPosterior.reiniciar()
    setErrorImputacion(null)
    setAviso(null)
  }

  function cerrarImputacionPosterior() {
    if (guardandoImputacion) {
      return
    }
    setCobranzaAImputar(null)
    setErrorImputacion(null)
  }

  /** Reparte solo el saldo: el backend lo vuelve a validar con la cobranza bloqueada. */
  async function guardarImputacionPosterior() {
    const saldo = saldoDe(cobranzaAImputar)
    const faltantes = erroresDeDistribucion(imputacionPosterior.filas, saldo)
    setErrorImputacion(faltantes.length > 0 ? faltantes.join(' ') : null)
    if (faltantes.length > 0) {
      return
    }

    setGuardandoImputacion(true)
    try {
      const actualizada = await agregarImputaciones(cobranzaAImputar.id, {
        imputaciones: imputacionPosterior.filas.map((fila) => ({
          inscripcion_id: Number(fila.inscripcionId),
          monto: Number(fila.monto),
        })),
      })
      setCobranzas((anteriores) =>
        anteriores.map((fila) => (fila.id === actualizada.id ? actualizada : fila)),
      )
      setAviso(`Se agregó una imputación a la cobranza del ${formatFechaCorta(actualizada.fecha)}.`)
      setCobranzaAImputar(null)
    } catch (error) {
      setErrorImputacion(error?.message ?? 'No pudimos imputar el pago.')
    } finally {
      setGuardandoImputacion(false)
    }
  }

  const fechaFutura = esFechaFutura(formulario.fecha)
  const cuitInvalido =
    formulario.facturaA &&
    formulario.cuitFactura.trim() !== '' &&
    !cuitValido(formulario.cuitFactura)

  /** El titular solo se completa cuando el comprobante quedó sin identificar. */
  const completandoTitular =
    cobranzaEnEdicion !== null && cobranzaEnEdicion.pagador.nombre === TITULAR_SIN_IDENTIFICAR
  const titularParaGuardar = titularNuevo.trim()

  const saldoDistribucion =
    Number(formulario.importe || 0) -
    distribucion.filas.reduce((suma, fila) => suma + Number(fila.monto || 0), 0)
  /** `Varios alumnos` exige dos alumnos distintos y completos antes de habilitar el alta. */
  const distribucionCompleta =
    erroresDeDistribucion(distribucion.filas, formulario.importe, 2).length === 0
  const puedeRegistrar = modo !== MODO.VARIOS || distribucionCompleta

  /** Toda cobranza se puede corregir: los destinos válidos dependen del estado actual. */
  const columnas = [
    ...COLUMNAS,
    {
      clave: 'acciones',
      titulo: 'ACCIONES',
      render: (fila) => (
        <span className="inline-flex flex-wrap gap-2">
          <Button variante="secundario" tamano="chico" onClick={() => abrirEdicionDeEstado(fila)}>
            Editar estado
          </Button>
          {cantidadDeAlumnosImputados(fila) >= 2 && (
            <Button
              variante="secundario"
              tamano="chico"
              onClick={() => alternarDetalle(fila)}
              aria-expanded={detalleAbierto === fila.id}
              aria-controls={`detalle-cobranza-${fila.id}`}
            >
              {detalleAbierto === fila.id ? 'Ocultar detalle' : 'Ver imputaciones'}
            </Button>
          )}
          {saldoDe(fila) > 0 && (
            <Button
              variante="secundario"
              tamano="chico"
              onClick={() => abrirImputacionPosterior(fila)}
            >
              Agregar imputación
            </Button>
          )}
        </span>
      ),
    },
  ]

  function alternarDetalle(fila) {
    setDetalleAbierto((actual) => (actual === fila.id ? null : fila.id))
  }

  function abrirEdicionDeEstado(fila) {
    setCobranzaEnEdicion(fila)
    setEstadoNuevo('')
    setTitularNuevo('')
    setJustificacion('')
    setConfirmandoCambio(false)
    setErrorEstado(null)
    // El aviso de la última acción no describe lo que se está por hacer: no se arrastra al modal.
    setAviso(null)
  }

  function cerrarEdicionDeEstado() {
    if (guardandoEstado) {
      return
    }
    setCobranzaEnEdicion(null)
    setErrorEstado(null)
  }

  /**
   * Guarda el cambio y reemplaza la fila con la respuesta del backend. No se recarga el historial:
   * la respuesta ya trae la cobranza actualizada, y si falla no se toca la tabla.
   */
  async function guardarCambioDeEstado() {
    setGuardandoEstado(true)
    setErrorEstado(null)

    const titular = titularNuevo.trim()
    try {
      const datos = {}
      if (estadoNuevo !== '') {
        datos.estado = estadoNuevo
      }
      if (titular !== '') {
        datos.titular = titular
      }
      if (justificacion.trim() !== '') {
        datos.justificacion = justificacion.trim()
      }
      const actualizada = await actualizarEstadoCobranza(cobranzaEnEdicion.id, datos)
      setCobranzas((anteriores) =>
        anteriores.map((fila) => (fila.id === actualizada.id ? actualizada : fila)),
      )
      const avisos = []
      if (estadoNuevo !== '') {
        avisos.push(
          `Estado actualizado a ${ETIQUETA_ESTADO[actualizada.estado] ?? actualizada.estado}.`,
        )
      }
      if (titular !== '') {
        avisos.push('Se completó el titular del comprobante.')
      }
      setAviso(avisos.join(' '))
      setCobranzaEnEdicion(null)
    } catch (error) {
      setErrorEstado(error?.message ?? 'No pudimos actualizar el estado de la cobranza.')
    } finally {
      setGuardandoEstado(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card titulo="Registrar Cobranza Manual">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="fecha"
            etiqueta="Fecha Pago"
            type="date"
            valor={formulario.fecha}
            onChange={cambiar('fecha')}
            obligatorio
            error={
              errores.includes('Fecha Pago')
                ? fechaFutura
                  ? 'La fecha del pago no puede ser futura.'
                  : 'La fecha del pago es obligatoria.'
                : null
            }
          />

          <Input
            id="importe"
            etiqueta="Importe Cobrado (AR$)"
            type="number"
            valor={formulario.importe}
            onChange={cambiar('importe')}
            obligatorio
            error={
              errores.includes('Importe Cobrado (AR$)')
                ? 'El importe cobrado tiene que ser mayor a cero.'
                : null
            }
          />

          <Campo
            id="medio"
            etiqueta="Medio de Pago"
            obligatorio
            error={errores.includes('Medio de Pago') ? 'Elegí el medio de pago.' : null}
          >
            <select id="medio" value={formulario.medio} onChange={cambiar('medio')}>
              <option value="">Seleccionar…</option>
              {Object.entries(MEDIO_PAGO_LABELS).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </Campo>

          <Input
            id="titular"
            etiqueta="Titular del Comprobante"
            valor={formulario.titular}
            onChange={cambiar('titular')}
          />

          <Campo id="modo-imputacion" etiqueta="Imputación del Pago">
            <div
              role="radiogroup"
              aria-label="Imputación del Pago"
              className="flex flex-wrap gap-4 py-1"
            >
              {MODOS.map((opcion) => (
                <label
                  key={opcion.valor}
                  className="flex items-center gap-2 text-sm text-slate-700"
                >
                  <input
                    type="radio"
                    name="modo-imputacion"
                    value={opcion.valor}
                    checked={modo === opcion.valor}
                    onChange={() => cambiarModo(opcion.valor)}
                  />
                  {opcion.etiqueta}
                </label>
              ))}
            </div>
          </Campo>

          {modo === MODO.UNO && (
            <>
              <BuscadorAlumno
                id="alumno"
                etiqueta="Alumno a Imputar Pago"
                alumnos={alumnos}
                alumnoId={formulario.alumnoId}
                onElegir={elegirAlumno}
                onLimpiar={volverAElegirAlumno}
              />

              <Campo
                id="inscripcion"
                etiqueta="Inscripción a imputar"
                obligatorio={formulario.alumnoId !== ''}
                error={
                  errorInscripciones ??
                  (errores.includes('Inscripción a imputar')
                    ? 'Elegí la inscripción a la que se imputa el pago.'
                    : null)
                }
              >
                {formulario.alumnoId === '' ? (
                  <p className="text-xs text-slate-500">
                    Elegí un alumno para imputar el pago a una de sus inscripciones.
                  </p>
                ) : cargandoInscripciones ? (
                  <p className="text-xs text-slate-500">Cargando inscripciones…</p>
                ) : inscripciones.length > 1 ? (
                  <select
                    id="inscripcion"
                    value={formulario.inscripcionId}
                    onChange={cambiar('inscripcionId')}
                  >
                    <option value="">Seleccionar…</option>
                    {inscripciones.map((inscripcion) => (
                      <option key={inscripcion.id} value={String(inscripcion.id)}>
                        {inscripcion.comision.codigo} — {inscripcion.comision.nombre}
                      </option>
                    ))}
                  </select>
                ) : inscripciones.length === 1 ? (
                  <p className="text-sm text-slate-700">
                    Se imputará a {inscripciones[0].comision.codigo} —{' '}
                    {inscripciones[0].comision.nombre}
                  </p>
                ) : null}
              </Campo>
            </>
          )}

          {modo === MODO.VARIOS && (
            <EditorDistribucion
              idPrefijo="alta"
              filas={distribucion.filas}
              total={formulario.importe}
              alumnos={alumnos}
              etiquetaAgregar="Agregar otro alumno"
              minimoAlumnos={2}
              onAgregar={distribucion.agregar}
              onQuitar={distribucion.quitar}
              onAlumno={distribucion.elegirAlumno}
              onMonto={distribucion.cambiarMonto}
              onInscripcion={distribucion.cambiarInscripcion}
              onDistribuir={distribucion.distribuir}
            />
          )}

          {modo === MODO.SIN_IMPUTAR && (
            <p className="text-xs text-slate-500 sm:col-span-2">
              El cobro queda registrado sin imputar. Podés repartirlo después desde el historial.
            </p>
          )}

          <Campo id="estado" etiqueta="Estado Inicial">
            <select id="estado" value={formulario.estado} onChange={cambiar('estado')}>
              {Object.values(ESTADO_COBRANZA).map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </Campo>

          {formulario.estado !== ESTADO_COBRANZA.ACREDITADO && (
            <Input
              id="causa"
              etiqueta="Causa del comprobante no acreditado"
              valor={formulario.causa}
              onChange={cambiar('causa')}
            />
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              id="factura-a"
              type="checkbox"
              checked={formulario.facturaA}
              onChange={(evento) =>
                setFormulario((anterior) => ({ ...anterior, facturaA: evento.target.checked }))
              }
            />
            El titular solicita Factura tipo A con CUIT vinculada
          </label>

          {formulario.facturaA && (
            <Input
              id="cuit"
              etiqueta="CUIT del Titular"
              valor={formulario.cuitFactura}
              onChange={cambiar('cuitFactura')}
              obligatorio
              error={
                errores.includes('CUIT del Titular') || cuitInvalido
                  ? 'Ingresá un CUIT de 11 dígitos con dígito verificador válido.'
                  : null
              }
            />
          )}
        </div>

        {errores.length > 0 && (
          <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {`Faltan datos obligatorios: ${errores.join(', ')}.`}
          </p>
        )}

        {errorApi !== null && (
          <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorApi}
          </p>
        )}

        {aviso !== null && (
          <p role="status" className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            {aviso}
          </p>
        )}

        <div className="mt-4">
          {confirmandoParcial !== null && confirmandoParcial === saldoDistribucion ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>
                Quedan {formatMoneda(saldoDistribucion)} sin imputar. ¿Registrar la cobranza igual?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variante="secundario"
                  onClick={() => setConfirmandoParcial(null)}
                  disabled={enviando}
                >
                  Volver
                </Button>
                <Button onClick={registrar} disabled={enviando}>
                  {enviando ? 'Registrando…' : 'Sí, registrar con saldo pendiente'}
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={registrar} disabled={enviando || !puedeRegistrar}>
              Registrar Cobro
            </Button>
          )}
        </div>
      </Card>

      <Card titulo="Historial de Ingresos Registrados">
        <div className="mb-3 max-w-xs">
          <Input
            id="buscar-titular"
            etiqueta="Buscar por titular"
            valor={busquedaTitular}
            onChange={(evento) => setBusquedaTitular(evento.target.value)}
            placeholder="Nombre del titular…"
          />
        </div>
        <Table
          columnas={columnas}
          filas={cobranzasVisibles}
          detalle={(fila) =>
            detalleAbierto === fila.id ? (
              <div id={`detalle-cobranza-${fila.id}`}>
                <DetalleImputaciones fila={fila} />
              </div>
            ) : null
          }
        />
      </Card>

      <Modal
        abierto={cobranzaEnEdicion !== null}
        titulo="Editar estado de la cobranza"
        onClose={cerrarEdicionDeEstado}
        pie={
          cobranzaEnEdicion === null ? null : confirmandoCambio ? (
            <>
              <Button
                variante="secundario"
                onClick={() => setConfirmandoCambio(false)}
                disabled={guardandoEstado}
              >
                Volver
              </Button>
              <Button onClick={guardarCambioDeEstado} disabled={guardandoEstado}>
                {guardandoEstado ? 'Guardando…' : 'Confirmar y guardar'}
              </Button>
            </>
          ) : (
            <>
              <Button variante="secundario" onClick={cerrarEdicionDeEstado}>
                Cancelar
              </Button>
              <Button
                onClick={() => setConfirmandoCambio(true)}
                disabled={
                  (estadoNuevo !== '' && justificacion.trim() === '') ||
                  (estadoNuevo === '' && titularParaGuardar === '')
                }
              >
                Continuar
              </Button>
            </>
          )
        }
      >
        {cobranzaEnEdicion !== null && (
          <div className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {completandoTitular ? (
                <div className="sm:col-span-2">
                  <Input
                    id="titular-cobranza"
                    etiqueta="Titular del comprobante"
                    valor={titularNuevo}
                    onChange={(evento) => setTitularNuevo(evento.target.value)}
                    placeholder="Nombre de quien pagó"
                    leyenda="el comprobante no lo tenía identificado"
                  />
                </div>
              ) : (
                <Dato etiqueta="Titular del pago" valor={cobranzaEnEdicion.pagador.nombre} />
              )}
              <Dato
                etiqueta="Alumno imputado"
                valor={cobranzaEnEdicion.imputacion?.nombre ?? 'Sin imputar'}
              />
              <Dato etiqueta="Importe" valor={formatMoneda(cobranzaEnEdicion.importe)} />
              <Dato etiqueta="Fecha" valor={formatFechaCorta(cobranzaEnEdicion.fecha)} />
              <Dato etiqueta="Estado actual" valor={cobranzaEnEdicion.estado} />
            </dl>

            {confirmandoCambio ? (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {estadoNuevo !== '' ? (
                  <p>
                    Vas a pasar la cobranza de <strong>{cobranzaEnEdicion.estado}</strong> a{' '}
                    <strong>{estadoNuevo}</strong>.
                  </p>
                ) : (
                  <p>No vas a cambiar el estado de la cobranza.</p>
                )}
                {titularParaGuardar !== '' && (
                  <p className="mt-2">
                    Vas a completar el titular como <strong>{titularParaGuardar}</strong>.
                  </p>
                )}
                {justificacion.trim() !== '' && (
                  <p className="mt-2">
                    <span className="font-medium">Justificación:</span> {justificacion.trim()}
                  </p>
                )}
              </div>
            ) : (
              <>
                <Campo id="estado-nuevo" etiqueta="Nuevo estado" obligatorio={!completandoTitular}>
                  <select
                    id="estado-nuevo"
                    value={estadoNuevo}
                    onChange={(evento) => setEstadoNuevo(evento.target.value)}
                  >
                    <option value="">Seleccionar…</option>
                    {TRANSICIONES_ESTADO_COBRANZA[cobranzaEnEdicion.estado].map((destino) => (
                      <option key={destino} value={destino}>
                        {destino}
                      </option>
                    ))}
                  </select>
                  {completandoTitular && (
                    <p className="mt-1 text-xs text-slate-500">
                      Dejalo vacío para guardar solo el titular y conservar el estado actual.
                    </p>
                  )}
                </Campo>

                <Campo
                  id="justificacion"
                  etiqueta="Justificación del cambio"
                  obligatorio={!completandoTitular || estadoNuevo !== ''}
                >
                  <textarea
                    id="justificacion"
                    rows={3}
                    value={justificacion}
                    onChange={(evento) => setJustificacion(evento.target.value)}
                    placeholder="Por qué se acredita el comprobante…"
                    className="foco-acento w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                  />
                  {completandoTitular && estadoNuevo === '' && (
                    <p className="mt-1 text-xs text-slate-500">
                      Opcional si solo completás el titular.
                    </p>
                  )}
                </Campo>
              </>
            )}

            {errorEstado !== null && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorEstado}
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        abierto={cobranzaAImputar !== null}
        titulo="Agregar imputación"
        onClose={cerrarImputacionPosterior}
        pie={
          cobranzaAImputar === null ? null : (
            <>
              <Button
                variante="secundario"
                onClick={cerrarImputacionPosterior}
                disabled={guardandoImputacion}
              >
                Cancelar
              </Button>
              <Button onClick={guardarImputacionPosterior} disabled={guardandoImputacion}>
                {guardandoImputacion ? 'Imputando…' : 'Imputar saldo'}
              </Button>
            </>
          )
        }
      >
        {cobranzaAImputar !== null && (
          <div className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Dato etiqueta="Titular del pago" valor={cobranzaAImputar.pagador.nombre} />
              <Dato etiqueta="Importe" valor={formatMoneda(cobranzaAImputar.importe)} />
              <Dato
                etiqueta="Imputado"
                valor={formatMoneda(sumaDeImputaciones(cobranzaAImputar))}
              />
              <Dato etiqueta="Saldo sin imputar" valor={formatMoneda(saldoDe(cobranzaAImputar))} />
            </dl>

            <div>
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Imputaciones existentes
              </p>
              {imputacionesDe(cobranzaAImputar).length === 0 ? (
                <p className="text-sm text-slate-600">Todavía no tiene imputaciones.</p>
              ) : (
                <ul className="mt-1 divide-y divide-slate-100 text-sm">
                  {imputacionesDe(cobranzaAImputar).map((imputacion) => (
                    <li key={imputacion.id} className="flex justify-between gap-2 py-1">
                      <span>{imputacion.nombre}</span>
                      <span className="font-medium">
                        {formatMoneda(Number(imputacion.monto ?? cobranzaAImputar.importe ?? 0))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <EditorDistribucion
              idPrefijo="posterior"
              filas={imputacionPosterior.filas}
              total={saldoDe(cobranzaAImputar)}
              alumnos={alumnos}
              error={errorImputacion}
              onAgregar={imputacionPosterior.agregar}
              onQuitar={imputacionPosterior.quitar}
              onAlumno={imputacionPosterior.elegirAlumno}
              onMonto={imputacionPosterior.cambiarMonto}
              onInscripcion={imputacionPosterior.cambiarInscripcion}
              onDistribuir={imputacionPosterior.distribuir}
            />
          </div>
        )}
      </Modal>

      <Card titulo="Acreditamiento Automático de Pagos">
        {/* Fuera del alcance mínimo: se muestra el hueco, sin pantalla detrás (D20). */}
        <div className="flex items-center gap-2">
          <Button variante="secundario" disabled>
            Acreditar pagos automáticamente
          </Button>
          <Badge tono={TONO.GRIS}>Próximamente</Badge>
        </div>
      </Card>
    </div>
  )
}
