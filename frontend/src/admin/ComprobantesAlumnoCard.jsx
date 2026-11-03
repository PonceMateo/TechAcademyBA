import { useEffect, useState } from 'react'
import { Badge, Button, Card, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { MEDIO_PAGO_LABELS, TIPO_FACTURA } from '../domain/enums'
import { descargarArchivoComprobante, listarComprobantesPendientes } from '../services/dataService'
import { formatFechaCorta, formatMoneda } from '../utils/formato'

/**
 * Comprobantes de alumnos pendientes de revisión (HU 52).
 *
 * **No es el alta de una cobranza.** Esta bandeja solo lista lo que el alumno envió y permite abrir
 * el adjunto. Acreditar o rechazar el pago sigue siendo el flujo de revisión de cobranzas de las HU
 * 21 y 22, así que acá no hay botón que cree una cobranza ni que cambie la habilitación.
 *
 * **La descarga va con la sesión de Secretaría.** El servicio pide el adjunto al endpoint
 * autenticado; en producción el backend redirige a una URL firmada temporal. El archivo se abre en
 * otra pestaña desde un `Blob`, sin pegar una URL privada en la pantalla.
 */

function fechaHoraDeEnvio(valor) {
  if (!valor) {
    return ''
  }
  const fecha = formatFechaCorta(String(valor).slice(0, 10))
  const hora = String(valor).slice(11, 16)
  return hora === '' ? fecha : `${fecha} ${hora}`
}

const COLUMNAS = [
  {
    clave: 'enviado_at',
    titulo: 'ENVIADO',
    render: (fila) => fechaHoraDeEnvio(fila.enviado_at),
  },
  {
    clave: 'alumno',
    titulo: 'ALUMNO',
    render: (fila) => <span className="font-medium">{fila.alumno}</span>,
  },
  {
    clave: 'curso',
    titulo: 'CURSO',
    render: (fila) => `${fila.inscripcion.nombre_curso} · ${fila.inscripcion.codigo}`,
  },
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
    clave: 'factura',
    titulo: 'FACTURA A',
    render: (fila) =>
      fila.factura_a_solicitada ? (
        <Badge tono={TONO.CELESTE}>{TIPO_FACTURA.A}</Badge>
      ) : (
        <span className="text-slate-400">—</span>
      ),
  },
]

export function ComprobantesAlumnoCard() {
  const [filas, setFilas] = useState([])
  const [cargadas, setCargadas] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    listarComprobantesPendientes()
      .then((resultado) => {
        setFilas(resultado)
        setCargadas(true)
      })
      .catch((fallo) => {
        setError(fallo?.message ?? 'No pudimos consultar los comprobantes pendientes.')
        setCargadas(true)
      })
  }, [])

  /** El adjunto se abre en otra pestaña desde los bytes descargados con la sesión. */
  async function abrir(fila) {
    setError(null)
    try {
      const blob = await descargarArchivoComprobante(fila.id)
      if (typeof URL.createObjectURL !== 'function') {
        return
      }
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (fallo) {
      setError(fallo?.message ?? 'No pudimos abrir el comprobante.')
    }
  }

  const columnas = [
    ...COLUMNAS,
    {
      clave: 'archivo',
      titulo: 'ADJUNTO',
      render: (fila) => (
        <Button variante="secundario" onClick={() => abrir(fila)}>
          Ver comprobante
        </Button>
      ),
    },
  ]

  return (
    <Card titulo="Comprobantes de alumnos pendientes">
      {error !== null && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {cargadas && (
        <Table
          columnas={columnas}
          filas={filas}
          claveDeFila={(fila) => fila.id}
          vacio={
            <p className="text-sm text-slate-600">No hay comprobantes pendientes de revisión.</p>
          }
        />
      )}
    </Card>
  )
}
