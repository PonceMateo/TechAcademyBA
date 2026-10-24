import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Campo, Card, Input, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { ESTADO_COBRANZA, MEDIO_PAGO_LABELS, TIPO_FACTURA } from '../domain/enums'
import { normalizeDocumento, normalizeWords } from '../domain/normalize'
import {
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
 */

const ESTADOS_GESTION = new Map([
  [ESTADO_COBRANZA.ACREDITADO, { tono: TONO.VERDE }],
  [ESTADO_COBRANZA.OBSERVADO, { tono: TONO.AMBAR }],
  [ESTADO_COBRANZA.RECHAZADO, { tono: TONO.ROJO }],
])

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
    // Vacía de verdad cuando el comprobante todavía no tiene a quién imputarse.
    render: (fila) => fila.imputacion?.nombre ?? '',
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
        {fila.causa !== null && fila.causa !== '' && (
          <span className="text-xs text-amber-800">{fila.causa}</span>
        )}
      </span>
    ),
  },
]

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

export function PaymentsPage() {
  const [cobranzas, setCobranzas] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO)
  const [busquedaAlumno, setBusquedaAlumno] = useState('')
  const [comboboxAbierto, setComboboxAbierto] = useState(false)
  const [indiceActivo, setIndiceActivo] = useState(-1)
  const [busquedaTitular, setBusquedaTitular] = useState('')
  const [inscripciones, setInscripciones] = useState([])
  const [cargandoInscripciones, setCargandoInscripciones] = useState(false)
  const [errorInscripciones, setErrorInscripciones] = useState(null)
  const [errores, setErrores] = useState([])
  const [aviso, setAviso] = useState(null)
  const [errorApi, setErrorApi] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const inputAlumnoRef = useRef(null)
  const volverAlBuscador = useRef(false)

  useEffect(() => {
    listarCobranzas()
      .then(setCobranzas)
      .catch(() => setCobranzas([]))
    listarAlumnos()
      .then(setAlumnos)
      .catch(() => setAlumnos([]))
  }, [])

  /**
   * Al cambiar de alumno el input del combobox vuelve a montarse. El foco se devuelve después del
   * render para que el teclado siga en el campo que la persona acaba de pedir, no en el botón.
   */
  useEffect(() => {
    if (formulario.alumnoId === '' && volverAlBuscador.current) {
      volverAlBuscador.current = false
      inputAlumnoRef.current?.focus()
    }
  }, [formulario.alumnoId])

  /** El combobox imputa a un alumno del padrón; el titular del comprobante no. */
  const alumnosVisibles = useMemo(() => {
    const consulta = busquedaAlumno.trim()
    if (consulta === '') {
      return alumnos
    }
    return alumnos.filter((alumno) => alumnoCoincide(alumno, consulta))
  }, [alumnos, busquedaAlumno])

  const alumnoElegido = useMemo(
    () => alumnos.find((alumno) => String(alumno.id) === formulario.alumnoId) ?? null,
    [alumnos, formulario.alumnoId],
  )

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
    setBusquedaAlumno('')
    setComboboxAbierto(false)
    setIndiceActivo(-1)
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
    volverAlBuscador.current = true
    setFormulario((anterior) => ({ ...anterior, alumnoId: '', inscripcionId: '' }))
    setBusquedaAlumno('')
    setComboboxAbierto(false)
    setIndiceActivo(-1)
    setInscripciones([])
    setErrorInscripciones(null)
    setCargandoInscripciones(false)
  }

  function cambiarBusquedaAlumno(evento) {
    setBusquedaAlumno(evento.target.value)
    setComboboxAbierto(true)
    setIndiceActivo(-1)
  }

  /** Teclado del combobox: flechas para recorrer, Enter para elegir, Escape para cerrar. */
  function teclaAlumno(evento) {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setComboboxAbierto(true)
      setIndiceActivo((indice) => Math.min(indice + 1, alumnosVisibles.length - 1))
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setIndiceActivo((indice) => Math.max(indice - 1, 0))
    } else if (evento.key === 'Enter') {
      const alumno = alumnosVisibles[indiceActivo]
      if (comboboxAbierto && alumno !== undefined) {
        evento.preventDefault()
        elegirAlumno(alumno)
      }
    } else if (evento.key === 'Escape') {
      setComboboxAbierto(false)
      setIndiceActivo(-1)
    } else if (evento.key === 'Tab') {
      setComboboxAbierto(false)
    }
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
    if (formulario.alumnoId !== '' && formulario.inscripcionId === '') {
      errores.push('Inscripción a imputar')
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

    setEnviando(true)
    try {
      const nueva = await registrarCobranza({
        fecha: formulario.fecha,
        titular: formulario.titular.trim() === '' ? 'Sin identificar' : formulario.titular.trim(),
        medio: formulario.medio,
        importe: Number(formulario.importe),
        estado: formulario.estado,
        causa: formulario.estado === ESTADO_COBRANZA.ACREDITADO ? null : formulario.causa,
        alumno_id: formulario.alumnoId === '' ? null : Number(formulario.alumnoId),
        inscripcion_id: formulario.inscripcionId === '' ? null : Number(formulario.inscripcionId),
        factura_a_solicitada: formulario.facturaA,
        cuit_titular: formulario.facturaA ? formulario.cuitFactura.trim() : null,
      })

      setFormulario(FORMULARIO_VACIO)
      setBusquedaAlumno('')
      setInscripciones([])
      setErrorInscripciones(null)
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

  const fechaFutura = esFechaFutura(formulario.fecha)
  const cuitInvalido =
    formulario.facturaA &&
    formulario.cuitFactura.trim() !== '' &&
    !cuitValido(formulario.cuitFactura)

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

          <Campo id="alumno" etiqueta="Alumno a Imputar Pago">
            {alumnoElegido !== null ? (
              <div
                role="group"
                aria-label="Alumno a Imputar Pago"
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {alumnoElegido.nombre}
                  </p>
                  <p className="text-xs text-slate-600">
                    {alumnoElegido.documento ? `DNI ${alumnoElegido.documento}` : 'Sin documento'}
                  </p>
                </div>
                <Button variante="secundario" tamano="chico" onClick={volverAElegirAlumno}>
                  Cambiar
                </Button>
              </div>
            ) : (
              <div className="relative">
                <input
                  ref={inputAlumnoRef}
                  id="alumno"
                  type="text"
                  role="combobox"
                  aria-expanded={comboboxAbierto}
                  aria-controls="alumno-coincidencias"
                  aria-autocomplete="list"
                  aria-activedescendant={
                    comboboxAbierto && alumnosVisibles[indiceActivo] !== undefined
                      ? `alumno-opcion-${alumnosVisibles[indiceActivo].id}`
                      : undefined
                  }
                  autoComplete="off"
                  placeholder="Buscar por nombre, apellido, DNI o email…"
                  value={busquedaAlumno}
                  onChange={cambiarBusquedaAlumno}
                  onKeyDown={teclaAlumno}
                  onFocus={() => setComboboxAbierto(true)}
                  onBlur={() => setComboboxAbierto(false)}
                  className="foco-acento w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                />
                {comboboxAbierto && (
                  <ul
                    id="alumno-coincidencias"
                    role="listbox"
                    aria-label="Alumnos coincidentes"
                    className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                  >
                    {alumnosVisibles.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-slate-500">
                        No hay alumnos que coincidan.
                      </li>
                    ) : (
                      alumnosVisibles.map((alumno, indice) => (
                        <li
                          key={alumno.id}
                          id={`alumno-opcion-${alumno.id}`}
                          role="option"
                          aria-selected={indice === indiceActivo}
                          onMouseDown={(evento) => evento.preventDefault()}
                          onClick={() => elegirAlumno(alumno)}
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
          <Button onClick={registrar} disabled={enviando}>
            Registrar Cobro
          </Button>
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
        <Table columnas={COLUMNAS} filas={cobranzasVisibles} />
      </Card>

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
