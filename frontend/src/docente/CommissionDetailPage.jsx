import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { Badge, Button, Card, Input, StatusIndicator, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import {
  guardarLinkClase,
  listarEmailsHabilitados,
  obtenerPadronComision,
} from '../services/dataService'

/**
 * Detalle de comisión con su padrón (10.3).
 *
 * **El padrón es estrictamente de solo lectura.** La tabla no tiene un control de edición del
 * acceso y el servicio que la alimenta no expone forma de cambiarlo: el estado de habilitación lo
 * decide la secretaría con el comprobante del alumno, y que la pantalla no ofrezca el botón es la
 * forma de que nadie lo intente desde el lugar equivocado.
 *
 * **La única excepción editable de la pantalla es `Link de la clase`, y por eso lleva su nota.**
 * El prototipo declara toda la pantalla como `Solo lectura` y no tiene ningún campo para cargar el
 * link, pero la historia que lo exige está en el alcance mínimo. El chip `Solo lectura` entonces
 * limita su alcance al padrón, y la nota del bloque del link lo dice con palabras para que nadie
 * lo lea como una contradicción.
 *
 * **La fila de un alumno bloqueado no ofrece ninguna forma de obtener el link.** No hay botón ni
 * enlace en ninguna fila: el link se reparte por correo a los habilitados. Agregarlo solo en las
 * filas habilitadas dejaría un botón que aparece y desaparece según el estado de otra persona.
 *
 * **`Copiar emails habilitados` filtra por acceso y avisa antes de copiar.** El aviso dice cuántos
 * correos van a copiarse, y cuando no hay ninguno habilitado informa que no hay nada para copiar en
 * lugar de copiar una lista vacía.
 */
const COLUMNAS = [
  {
    clave: 'nombre',
    titulo: 'ALUMNO',
    render: (fila) => <span className="font-medium">{fila.nombre}</span>,
  },
  { clave: 'email', titulo: 'EMAIL', render: (fila) => fila.email },
  {
    clave: 'estado',
    titulo: 'ESTADO DE HABILITACIÓN',
    render: (fila) => <StatusIndicator estado={fila.acceso.estado} causa={fila.acceso.causa} />,
  },
]

const AVISO_SIN_CORREOS = (codigo) =>
  `No hay correos para copiar: ${codigo} no tiene alumnos habilitados.`

/** `Se copiará 1 email` y `Se copiarán 4 emails`: el verbo y el sustantivo siguen a la cantidad. */
function avisoCopia(cantidad) {
  return `Se copiará ${cantidad} ${cantidad === 1 ? 'email' : 'emails'} para que puedas enviar el link de Zoom.`
}

export function CommissionDetailPage() {
  const { codigo } = useParams()
  const [padron, setPadron] = useState(null)
  const [url, setUrl] = useState('')
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [copiados, setCopiados] = useState(null)

  useEffect(() => {
    obtenerPadronComision(codigo).then(setPadron)
  }, [codigo])

  if (padron === null) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">{codigo}</h2>
        <p className="text-sm text-slate-500">No hay ninguna comisión con ese código.</p>
      </div>
    )
  }

  const habilitados = padron.alumnos.filter((alumno) => alumno.acceso.estado === 'HABILITADO')

  async function guardar() {
    const resultado = await guardarLinkClase({ comisionCodigo: codigo, url })

    if (!resultado.ok) {
      setAviso(null)
      setError(resultado.error)
      return
    }

    setError(null)
    setUrl(resultado.link)
    setAviso('Link de la clase cargado. Queda disponible para los alumnos habilitados.')
  }

  async function copiar() {
    const correos = await listarEmailsHabilitados(codigo)

    if (correos.length === 0) {
      setCopiados(null)
      setAviso(AVISO_SIN_CORREOS(codigo))
      return
    }

    setCopiados(correos)
    setAviso(
      `Se copiaron los correos de los alumnos habilitados de ${codigo}. Los bloqueados no van en la lista.`,
    )

    // El portapapeles del navegador es un permiso que puede estar denegado. La lista queda
    // escrita en pantalla igual, así que la acción sirve aunque la copia no ocurra.
    try {
      await globalThis.navigator?.clipboard?.writeText(correos.join(', '))
    } catch {
      // Sin portapapeles no hay nada que avisar: el resultado ya está a la vista.
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-slate-900">
          {`${padron.nombre_curso} · ${padron.codigo}`}
        </h2>
        <Badge tono={TONO.GRIS}>Solo lectura</Badge>
      </div>

      <p className="text-sm text-slate-600">{padron.horario}</p>

      <Card titulo="Padrón de alumnos">
        <Table
          columnas={COLUMNAS}
          filas={padron.alumnos}
          vacio={
            <p className="text-sm text-slate-500">
              Esta comisión todavía no tiene alumnos inscriptos con nombre en el padrón.
            </p>
          }
        />

        <p className="mt-4 text-sm text-slate-600">{avisoCopia(habilitados.length)}</p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variante="secundario" onClick={copiar}>
            Copiar emails habilitados
          </Button>
        </div>

        {copiados !== null && (
          <ul
            aria-label="Correos copiados"
            className="mt-3 space-y-1 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            {copiados.map((correo) => (
              <li key={correo}>{correo}</li>
            ))}
          </ul>
        )}

        {aviso !== null && (
          <p role="status" className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {aviso}
          </p>
        )}
      </Card>

      <Card titulo="Link de la clase">
        <p className="mb-3 text-xs text-slate-500">
          El chip `Solo lectura` limita su alcance al padrón de alumnos: el link de la clase se
          carga acá y es único por clase del día. No cambia el estado de habilitación de ningún
          alumno.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-md">
            <Input
              id="link-de-la-clase"
              etiqueta="Link de la clase"
              type="url"
              valor={url}
              onChange={(evento) => {
                setUrl(evento.target.value)
                setError(null)
              }}
              placeholder="https://zoom.us/j/…"
              error={error}
            />
          </div>
          <Button onClick={guardar}>Guardar link de la clase</Button>
        </div>
      </Card>
    </div>
  )
}
