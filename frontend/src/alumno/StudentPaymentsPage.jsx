import { useEffect, useState } from 'react'
import { Badge, Button, Campo, Card, Input, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { ESTADO_COBRANZA, MEDIO_PAGO, MEDIO_PAGO_LABELS } from '../domain/enums'
import { listarInscripcionesAlumno, listarPagosAlumno } from '../services/dataService'
import { formatFechaCorta, formatMoneda } from '../utils/formato'

/**
 * Historial y carga de comprobantes (11.4).
 *
 * **El historial es solo del alumno, y no por filtro de pantalla.** Lo que se filtra es el origen:
 * el servicio devuelve únicamente los comprobantes imputados al propio alumno, así que el pago de
 * `Tech Solutions S.A.` y el cheque de `Banco Federal` que todavía no tiene a quién imputarse no
 * tienen forma de aparecer acá. Filtrar en la pantalla sería confiar en que no se rompa.
 *
 * **El aviso de tercero va junto al importe porque el pagador puede no ser el alumno.** En este
 * dominio el comprobante lo puede mandar un familiar y la fila lo tiene que decir; el ejemplo no
 * tiene ninguna fila en esa condición, y el servicio devuelve la bandera para que el día que la
 * haya no haya que inventar la columna.
 *
 * **La carga del comprobante confirma y no persiste.** No hay endpoint (M17) y el estado de
 * habilitación lo decide la secretaría: un alumno que manda un comprobante queda esperando, y la
 * pantalla lo dice.
 *
 * **Sin pagos hay un mensaje, no una tabla vacía.**
 */
/**
 * Los tres estados de un comprobante, con su color y con la forma en que los escribe el spec. El
 * enum dice `OBSERVADO` y el alumno lee `Observado`: son el mismo dato.
 */
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

const MEDIOS = Object.values(MEDIO_PAGO)

const FORMULARIO_VACIO = { curso: '', importe: '', medio: '', pagador: '', archivo: null }

const SIN_PAGOS = 'No tenés pagos registrados.'

const AVISO_ENVIO =
  'Recibimos tu comprobante. Queda pendiente de validación de Secretaría BA y no cambia tu acceso a la plataforma.'

export function StudentPaymentsPage() {
  const [pagos, setPagos] = useState([])
  const [cargados, setCargados] = useState(false)
  const [cursos, setCursos] = useState([])
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO)
  const [errores, setErrores] = useState([])
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    listarPagosAlumno().then((resultado) => {
      setPagos(resultado)
      setCargados(true)
    })
    listarInscripcionesAlumno().then((resultado) =>
      setCursos(resultado.map((inscripcion) => inscripcion.codigo)),
    )
  }, [])

  function cambiar(campo) {
    return (evento) => setFormulario((anterior) => ({ ...anterior, [campo]: evento.target.value }))
  }

  function enviar() {
    const faltantes = []

    if (formulario.curso === '') {
      faltantes.push('Elegí el curso al que corresponde el comprobante.')
    }
    if (formulario.importe.trim() === '') {
      faltantes.push('Escribí el importe del comprobante.')
    }
    if (formulario.medio === '') {
      faltantes.push('Elegí el medio de pago.')
    }
    if (formulario.archivo === null) {
      faltantes.push('Adjuntá el comprobante.')
    }

    if (faltantes.length > 0) {
      setAviso(null)
      setErrores(faltantes)
      return
    }

    setErrores([])
    setFormulario(FORMULARIO_VACIO)
    setAviso(AVISO_ENVIO)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Mis Pagos</h2>

      <Card titulo="Historial de comprobantes">
        {cargados && pagos.length === 0 ? (
          <p className="text-sm text-slate-600">{SIN_PAGOS}</p>
        ) : (
          <Table columnas={COLUMNAS} filas={pagos} claveDeFila={(fila) => fila.id} />
        )}
      </Card>

      <Card titulo="Cargar comprobante">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Curso" id="curso" obligatorio>
            <select
              id="curso"
              value={formulario.curso}
              onChange={cambiar('curso')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Elegí un curso</option>
              {cursos.map((codigo) => (
                <option key={codigo} value={codigo}>
                  {codigo}
                </option>
              ))}
            </select>
          </Campo>

          <Input
            id="importe"
            etiqueta="Importe"
            valor={formulario.importe}
            onChange={cambiar('importe')}
            placeholder="$31.000"
          />

          <Campo etiqueta="Medio de pago" id="medio" obligatorio>
            <select
              id="medio"
              value={formulario.medio}
              onChange={cambiar('medio')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Elegí un medio de pago</option>
              {MEDIOS.map((medio) => (
                <option key={medio} value={medio}>
                  {MEDIO_PAGO_LABELS[medio]}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Adjuntar comprobante" id="archivo" obligatorio>
            <input
              id="archivo"
              type="file"
              aria-label="Adjuntar comprobante"
              onChange={(evento) =>
                setFormulario((anterior) => ({
                  ...anterior,
                  archivo: evento.target.files?.[0] ?? null,
                }))
              }
              className="w-full text-sm text-slate-700"
            />
          </Campo>

          <Input
            id="pagador"
            etiqueta="Pagado por (opcional)"
            valor={formulario.pagador}
            onChange={cambiar('pagador')}
            placeholder="Si lo pagó otra persona, escribí su nombre"
          />
        </div>

        {errores.length > 0 && (
          <ul role="alert" className="mt-4 space-y-1 text-sm text-red-700">
            {errores.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <Button onClick={enviar}>Enviar para validación</Button>
        </div>

        {aviso !== null && (
          <p role="status" className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {aviso}
          </p>
        )}
      </Card>
    </div>
  )
}
