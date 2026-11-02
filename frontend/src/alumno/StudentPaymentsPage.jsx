import { useEffect, useState } from 'react'
import { Badge, Button, Campo, Card, Input, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import {
  ESTADO_COBRANZA,
  ESTADO_COMPROBANTE_LABELS,
  MEDIO_PAGO,
  MEDIO_PAGO_LABELS,
} from '../domain/enums'
import { cuitValido } from '../domain/validacion'
import {
  enviarComprobante,
  listarComprobantesAlumno,
  listarInscripcionesAlumno,
  listarPagosAlumno,
} from '../services/dataService'
import { formatFechaCorta, formatMoneda } from '../utils/formato'

/**
 * Historial y envío de comprobantes (11.4 y HU 52).
 *
 * **El historial es solo del alumno, y no por filtro de pantalla.** El servicio devuelve únicamente
 * los comprobantes imputados al propio alumno, así que el pago de una empresa o un cheque sin
 * imputar no tienen forma de aparecer acá.
 *
 * **El envío no acredita el pago.** El alumno sube su comprobante y queda `Pendiente de revisión`;
 * la habilitación la sigue decidiendo Secretaría. La pantalla lo dice de forma explícita y no
 * muestra ningún estado de pago nuevo.
 *
 * **La validación del formulario no reemplaza la del backend.** Acá se avisa antes de mandar
 * (fecha, importe, CUIT, formato y tamaño del archivo) y la API vuelve a validar lo mismo, incluido
 * el contenido real del archivo.
 */

/** Los tres estados de un comprobante acreditado, con su color y el texto que ve el alumno. */
const ESTADOS = {
  [ESTADO_COBRANZA.ACREDITADO]: { etiqueta: 'Acreditado', tono: TONO.VERDE },
  [ESTADO_COBRANZA.OBSERVADO]: { etiqueta: 'Observado', tono: TONO.AMBAR },
  [ESTADO_COBRANZA.RECHAZADO]: { etiqueta: 'Rechazado', tono: TONO.ROJO },
}

const COLUMNAS = [
  { clave: 'fecha', titulo: 'FECHA', render: (fila) => formatFechaCorta(fila.fecha) },
  {
    clave: 'importe',
    titulo: 'IMPORTE',
    render: (fila) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="font-medium">{formatMoneda(fila.importe)}</span>
        {fila.pagado_por_tercero && (
          <span className="text-xs text-slate-500">Pagado por un tercero</span>
        )}
      </span>
    ),
  },
  { clave: 'medio', titulo: 'MEDIO', render: (fila) => MEDIO_PAGO_LABELS[fila.medio] },
  {
    clave: 'estado',
    titulo: 'ESTADO',
    render: (fila) => (
      <span className="inline-flex flex-col items-start gap-1">
        <Badge tono={ESTADOS[fila.estado]?.tono ?? TONO.GRIS}>
          {ESTADOS[fila.estado]?.etiqueta ?? fila.estado}
        </Badge>
        {fila.causa !== null && fila.causa !== '' && (
          <span className="text-xs text-amber-800">{fila.causa}</span>
        )}
      </span>
    ),
  },
]

const COLUMNAS_ENVIADOS = [
  {
    clave: 'fecha_pago',
    titulo: 'FECHA DEL PAGO',
    render: (fila) => formatFechaCorta(fila.fecha_pago),
  },
  { clave: 'importe', titulo: 'IMPORTE', render: (fila) => formatMoneda(fila.importe) },
  {
    clave: 'medio',
    titulo: 'MEDIO',
    render: (fila) => MEDIO_PAGO_LABELS[fila.medio] ?? fila.medio,
  },
  {
    clave: 'estado',
    titulo: 'ESTADO',
    render: (fila) => (
      <Badge tono={TONO.AMBAR}>{ESTADO_COMPROBANTE_LABELS[fila.estado] ?? fila.estado}</Badge>
    ),
  },
]

const MEDIOS = Object.values(MEDIO_PAGO)

const FORMULARIO_VACIO = {
  inscripcion: '',
  fecha: '',
  importe: '',
  medio: '',
  titular: '',
  facturaA: false,
  cuit: '',
  archivo: null,
}

const SIN_PAGOS = 'No tenés pagos registrados.'
const SIN_COMPROBANTES = 'Todavía no enviaste comprobantes.'
const SIN_INSCRIPCION = 'No tenés una inscripción activa para imputar el comprobante.'

const AVISO_ENVIO =
  'Tu comprobante quedó Pendiente de revisión. Todavía no acredita el pago ni cambia tu acceso.'

/** Los 5 MB que acepta el backend, sin depender de cómo los escriba el navegador. */
const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024
const EXTENSIONES_PERMITIDAS = ['pdf', 'jpg', 'jpeg', 'png']

function fechaDeHoy() {
  const hoy = new Date()
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  const dia = String(hoy.getDate()).padStart(2, '0')
  return `${hoy.getFullYear()}-${mes}-${dia}`
}

function esFechaFutura(fecha) {
  return fecha !== '' && fecha > fechaDeHoy()
}

function extensionDe(archivo) {
  const partes = String(archivo?.name ?? '')
    .toLowerCase()
    .split('.')
  return partes.length > 1 ? partes.pop() : ''
}

function tamanioLegible(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 KB'
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function erroresDelFormulario(formulario) {
  const errores = []

  if (formulario.inscripcion === '') {
    errores.push('Elegí la inscripción a la que corresponde el comprobante.')
  }
  if (formulario.fecha === '') {
    errores.push('Elegí la fecha del pago.')
  } else if (esFechaFutura(formulario.fecha)) {
    errores.push('La fecha del pago no puede ser futura.')
  }
  if (formulario.importe.trim() === '' || Number(formulario.importe) <= 0) {
    errores.push('Escribí un importe mayor a cero.')
  }
  if (formulario.medio === '') {
    errores.push('Elegí el medio de pago.')
  }
  if (formulario.facturaA) {
    if (formulario.cuit.trim() === '' || !cuitValido(formulario.cuit)) {
      errores.push('Ingresá un CUIT válido cuando solicitás Factura A.')
    }
  }
  if (formulario.archivo === null) {
    errores.push('Adjuntá el comprobante.')
  } else {
    if (!EXTENSIONES_PERMITIDAS.includes(extensionDe(formulario.archivo))) {
      errores.push('El comprobante tiene que ser un PDF, JPG o PNG.')
    }
    if (formulario.archivo.size > TAMANO_MAXIMO_BYTES) {
      errores.push('El comprobante no puede superar los 5 MB.')
    }
    if (formulario.archivo.size === 0) {
      errores.push('El archivo está vacío.')
    }
  }

  return errores
}

export function StudentPaymentsPage() {
  const [pagos, setPagos] = useState([])
  const [cargados, setCargados] = useState(false)
  const [comprobantes, setComprobantes] = useState([])
  const [inscripciones, setInscripciones] = useState([])
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO)
  const [errores, setErrores] = useState([])
  const [aviso, setAviso] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    listarPagosAlumno()
      .then((resultado) => {
        setPagos(resultado)
        setCargados(true)
      })
      .catch(() => setCargados(true))
    listarComprobantesAlumno()
      .then(setComprobantes)
      .catch(() => setComprobantes([]))
    listarInscripcionesAlumno()
      .then(setInscripciones)
      .catch(() => setInscripciones([]))
  }, [])

  function cambiar(campo) {
    return (evento) => setFormulario((anterior) => ({ ...anterior, [campo]: evento.target.value }))
  }

  async function enviar() {
    // El guardia y el `disabled` cubren el doble clic: el segundo envío no llega al servicio.
    if (enviando) {
      return
    }

    const faltantes = erroresDelFormulario(formulario)
    if (faltantes.length > 0) {
      setAviso(null)
      setErrores(faltantes)
      return
    }

    setErrores([])
    setAviso(null)
    setEnviando(true)

    try {
      const registro = await enviarComprobante(
        {
          inscripcion_id: Number(formulario.inscripcion),
          fecha_pago: formulario.fecha,
          importe: formulario.importe,
          medio: formulario.medio,
          titular: formulario.titular.trim() === '' ? null : formulario.titular.trim(),
          factura_a_solicitada: formulario.facturaA,
          cuit: formulario.facturaA ? formulario.cuit : null,
        },
        formulario.archivo,
      )
      setComprobantes((anteriores) => [registro, ...anteriores])
      setFormulario(FORMULARIO_VACIO)
      setAviso(AVISO_ENVIO)
    } catch (error) {
      setErrores([error?.message ?? 'No pudimos enviar el comprobante.'])
    } finally {
      setEnviando(false)
    }
  }

  const sinInscripciones = inscripciones.length === 0

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Mis Pagos</h2>

      <Card titulo="Historial de comprobantes">
        {cargados &&
          (pagos.length === 0 ? (
            <p className="text-sm text-slate-600">{SIN_PAGOS}</p>
          ) : (
            <Table columnas={COLUMNAS} filas={pagos} claveDeFila={(fila) => fila.id} />
          ))}
      </Card>

      <Card
        titulo="Comprobantes enviados"
        descripcion="Pendiente de revisión: todavía no acredita el pago ni cambia tu acceso."
      >
        <Table
          columnas={COLUMNAS_ENVIADOS}
          filas={comprobantes}
          claveDeFila={(fila) => fila.id}
          vacio={<p className="text-sm text-slate-600">{SIN_COMPROBANTES}</p>}
        />
      </Card>

      <Card titulo="Enviar comprobante">
        {sinInscripciones ? (
          <p className="text-sm text-slate-600">{SIN_INSCRIPCION}</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Inscripción a imputar" id="inscripcion" obligatorio>
                <select
                  id="inscripcion"
                  value={formulario.inscripcion}
                  onChange={cambiar('inscripcion')}
                  disabled={enviando}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="">Elegí una inscripción</option>
                  {inscripciones.map((inscripcion) => (
                    <option key={inscripcion.inscripcion_id} value={inscripcion.inscripcion_id}>
                      {inscripcion.nombre_curso} · {inscripcion.codigo}
                    </option>
                  ))}
                </select>
              </Campo>

              <Input
                id="fecha-pago"
                etiqueta="Fecha del pago"
                type="date"
                valor={formulario.fecha}
                onChange={cambiar('fecha')}
                disabled={enviando}
                max={fechaDeHoy()}
                obligatorio
              />

              <Input
                id="importe"
                etiqueta="Importe"
                valor={formulario.importe}
                onChange={cambiar('importe')}
                placeholder="$31.000"
                disabled={enviando}
                obligatorio
              />

              <Campo etiqueta="Medio de pago" id="medio" obligatorio>
                <select
                  id="medio"
                  value={formulario.medio}
                  onChange={cambiar('medio')}
                  disabled={enviando}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="">Elegí un medio de pago</option>
                  {MEDIOS.map((medio) => (
                    <option key={medio} value={medio}>
                      {MEDIO_PAGO_LABELS[medio]}
                    </option>
                  ))}
                </select>
              </Campo>

              <Input
                id="titular"
                etiqueta="Titular (opcional)"
                valor={formulario.titular}
                onChange={cambiar('titular')}
                placeholder="Si lo pagó otra persona, escribí su nombre"
                disabled={enviando}
              />

              <Campo etiqueta="Factura A" id="factura-a">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    id="factura-a"
                    type="checkbox"
                    checked={formulario.facturaA}
                    onChange={(evento) =>
                      setFormulario((anterior) => ({
                        ...anterior,
                        facturaA: evento.target.checked,
                        cuit: evento.target.checked ? anterior.cuit : '',
                      }))
                    }
                    disabled={enviando}
                  />
                  Solicitar Factura A
                </label>
              </Campo>

              {formulario.facturaA && (
                <Input
                  id="cuit"
                  etiqueta="CUIT"
                  valor={formulario.cuit}
                  onChange={cambiar('cuit')}
                  placeholder="30-12345678-1"
                  disabled={enviando}
                  obligatorio
                />
              )}

              <Campo etiqueta="Comprobante (PDF, JPG o PNG, hasta 5 MB)" id="archivo" obligatorio>
                <input
                  id="archivo"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  aria-label="Adjuntar comprobante"
                  onChange={(evento) =>
                    setFormulario((anterior) => ({
                      ...anterior,
                      archivo: evento.target.files?.[0] ?? null,
                    }))
                  }
                  disabled={enviando}
                  className="w-full text-sm text-slate-700"
                />
                {formulario.archivo !== null && (
                  <p className="text-xs text-slate-500">
                    {formulario.archivo.name} · {tamanioLegible(formulario.archivo.size)}
                  </p>
                )}
              </Campo>
            </div>

            {errores.length > 0 && (
              <ul role="alert" className="mt-4 space-y-1 text-sm text-red-700">
                {errores.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}

            {enviando && (
              <p role="status" className="mt-4 text-sm text-slate-600">
                Subiendo y verificando el comprobante…
              </p>
            )}

            <div className="mt-4">
              <Button onClick={enviar} disabled={enviando}>
                {enviando ? 'Enviando…' : 'Enviar comprobante'}
              </Button>
            </div>

            {aviso !== null && (
              <p
                role="status"
                className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700"
              >
                {aviso}
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
