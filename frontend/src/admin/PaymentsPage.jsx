import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Campo, Card, Input, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { ESTADO_COBRANZA, MEDIO_PAGO_LABELS, TIPO_FACTURA } from '../domain/enums'
import { listarAlumnos, listarCobranzas, registrarCobranza } from '../services/dataService'
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
 * imputación de destino único (D7), y la nota bajo el formulario lo dice con palabras porque el
 * caso del comprobante ilegible lo necesita.
 *
 * **Un solo vocabulario de medios de pago** en la selección del formulario y en la columna `MEDIO`
 * del historial, tomado del enum. El prototipo rotulaba distinto en los dos lugares y se resolvió
 * a favor del dominio: `MEDIO_PAGO_LABELS` es el mismo objeto para los dos.
 *
 * **El importe puede quedar vacío.** El comprobante del 19/05/2026 llegó ilegible y el número nunca
 * pudo leerse; mostrar `$0` en esa celda sería inventar un cobro de cero. La columna queda vacía y
 * la causa dice por qué (ver M16 en `docs/decisions.md`).
 */

/**
 * Los tres estados de gestión con su color. El rechazo no aparece en las seis filas del
 * historial del maquetado, pero existe en el enum (D12) y tiene su color desde ya: la columna
 * tiene que distinguirlo el día que aparezca uno.
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
    render: (fila) => (
      <Badge tono={fila.factura === TIPO_FACTURA.A ? TONO.CELESTE : TONO.GRIS}>
        {fila.factura}
      </Badge>
    ),
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
  estado: ESTADO_COBRANZA.ACREDITADO,
  causa: '',
  facturaA: false,
}

export function PaymentsPage() {
  const [cobranzas, setCobranzas] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO)
  const [busquedaAlumno, setBusquedaAlumno] = useState('')
  const [errores, setErrores] = useState([])
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    listarCobranzas().then(setCobranzas)
    listarAlumnos().then(setAlumnos)
  }, [])

  /** El selector imputa a un alumno del padrón; el titular del comprobante no. */
  const alumnosVisibles = useMemo(() => {
    const aguja = busquedaAlumno.trim().toLowerCase()
    if (aguja === '') {
      return alumnos
    }
    return alumnos.filter((alumno) => alumno.nombre.toLowerCase().includes(aguja))
  }, [alumnos, busquedaAlumno])

  function cambiar(campo) {
    return (evento) => setFormulario((anterior) => ({ ...anterior, [campo]: evento.target.value }))
  }

  function faltantes() {
    const errores = []

    if (formulario.fecha === '') {
      errores.push('Fecha Pago')
    }
    if (formulario.importe.trim() === '' || Number(formulario.importe) <= 0) {
      errores.push('Importe Cobrado (AR$)')
    }
    if (formulario.medio === '') {
      errores.push('Medio de Pago')
    }
    // D28: una cobranza que no está acreditada tiene que decir por qué. El campo de causa
    // aparece solo cuando el estado inicial no es acreditado, así que el formulario por defecto
    // tiene exactamente los campos que el spec fija, en el orden que fija.
    if (formulario.estado !== ESTADO_COBRANZA.ACREDITADO && formulario.causa.trim() === '') {
      errores.push('Causa del comprobante no acreditado')
    }

    return errores
  }

  async function registrar() {
    const faltando = faltantes()
    setErrores(faltando)

    if (faltando.length > 0) {
      setAviso(null)
      return
    }

    const nueva = await registrarCobranza({
      fecha: formulario.fecha,
      titular: formulario.titular.trim() === '' ? 'Sin identificar' : formulario.titular.trim(),
      medio: formulario.medio,
      facturaTipo: formulario.facturaA ? TIPO_FACTURA.A : TIPO_FACTURA.B,
      importe: Number(formulario.importe),
      estado: formulario.estado,
      causa: formulario.estado === ESTADO_COBRANZA.ACREDITADO ? null : formulario.causa,
      alumnoId: formulario.alumnoId === '' ? null : Number(formulario.alumnoId),
    })

    setCobranzas((anteriores) => [nueva, ...anteriores])
    setFormulario(FORMULARIO_VACIO)
    setBusquedaAlumno('')
    setAviso(`Se registró el cobro del ${formatFechaCorta(nueva.fecha)}.`)
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
            error={errores.includes('Fecha Pago') ? 'La fecha del pago es obligatoria.' : null}
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
                ? 'El importe cobrado es obligatorio.'
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
            <input
              type="search"
              aria-label="Buscar alumno para imputar"
              placeholder="Buscar alumno…"
              value={busquedaAlumno}
              onChange={(evento) => setBusquedaAlumno(evento.target.value)}
              className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <select id="alumno" value={formulario.alumnoId} onChange={cambiar('alumnoId')}>
              <option value="">Seleccionar…</option>
              {alumnosVisibles.map((alumno) => (
                <option key={alumno.id} value={String(alumno.id)}>
                  {alumno.nombre}
                </option>
              ))}
            </select>
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
        </div>

        <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          El <strong>Titular del Comprobante</strong> puede ser un tercero o una empresa que no está
          en el padrón. El pago se imputa al <strong>Alumno a Imputar Pago</strong>, que es quien
          queda reflejado en su legajo: el tercero no se agrega al padrón de alumnos.
        </p>

        {errores.length > 0 && (
          <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {`Faltan datos obligatorios: ${errores.join(', ')}.`}
          </p>
        )}

        {aviso !== null && (
          <p role="status" className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            {aviso}
          </p>
        )}

        <div className="mt-4">
          <Button onClick={registrar}>Registrar Cobro</Button>
        </div>
      </Card>

      <Card titulo="Historial de Ingresos Registrados">
        <Table columnas={COLUMNAS} filas={cobranzas} />
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
