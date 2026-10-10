import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { ESTADO_ASISTENCIA } from '../domain/enums'
import { obtenerAsistenciaComision, obtenerComisionesAsignadas } from '../services/dataService'

/**
 * Asistencia de la clase del día (10.4).
 *
 * **Solo la columna del día se puede cambiar, y la regla está en el dato.** Cada clase llega con su
 * `editable`, así que las columnas anteriores se dibujan como texto y la del día como selector. Si
 * la regla fuera "la última columna", agregar una columna nueva cambiaría qué se puede editar sin
 * que nadie lo decidiera.
 *
 * **Los contadores de la barra son de la clase del día y se recalculan.** El `1 presente · 1
 * ausente` del ejemplo sale de contar las marcas de la columna editable, no de un texto: cuando el
 * docente marca un ausente, los dos números se mueven porque se cuentan.
 *
 * **`Guardar asistencia` no persiste nada y no cambia ningún acceso.** La fuente del cliente no
 * declara cuántas clases tiene el curso, así que el maqueteado no muestra un `Clase 12 de 24` ni
 * inventa el denominador; y el estado de habilitación de un alumno lo decide la secretaría con el
 * comprobante, no una lista de asistencia.
 *
 * **La pantalla abre la primera comisión asignada.** La ruta del menú no lleva código y el docente
 * del maquetado tiene una sola; cuando tenga varias, la elección por comisión es una decisión de
 * esa historia y no de este change.
 */
const TONOS_MARCA = {
  [ESTADO_ASISTENCIA.PRESENTE]: TONO.VERDE,
  [ESTADO_ASISTENCIA.AUSENTE]: TONO.ROJO,
}

const ETIQUETAS_MARCA = {
  [ESTADO_ASISTENCIA.PRESENTE]: 'Presente',
  [ESTADO_ASISTENCIA.AUSENTE]: 'Ausente',
}

export function AttendancePage() {
  const [asistencia, setAsistencia] = useState(null)
  const [marcasDelDia, setMarcasDelDia] = useState({})
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    obtenerComisionesAsignadas().then(async (comisiones) => {
      if (comisiones.length === 0) {
        return
      }

      const cargada = await obtenerAsistenciaComision(comisiones[0].codigo)
      setAsistencia(cargada)

      const claseDelDia = cargada?.clases.find((clase) => clase.editable)
      if (claseDelDia !== undefined) {
        setMarcasDelDia(
          Object.fromEntries(
            cargada.filas.map((fila) => [fila.alumno_id, fila.marcas[claseDelDia.fecha]]),
          ),
        )
      }
    })
  }, [])

  const claseDelDia = useMemo(
    () => asistencia?.clases.find((clase) => clase.editable),
    [asistencia],
  )

  if (asistencia === null || claseDelDia === undefined) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Asistencia</h2>
        <p className="text-sm text-slate-500">
          No hay ninguna comisión asignada para registrar asistencia.
        </p>
      </div>
    )
  }

  const presentes = Object.values(marcasDelDia).filter(
    (marca) => marca === ESTADO_ASISTENCIA.PRESENTE,
  ).length
  const ausentes = Object.values(marcasDelDia).length - presentes

  const columnas = [
    {
      clave: 'nombre',
      titulo: 'ALUMNO',
      render: (fila) => <span className="font-medium">{fila.nombre}</span>,
    },
    ...asistencia.clases.map((clase) => ({
      clave: clase.fecha,
      titulo: clase.titulo,
      render: (fila) =>
        clase.editable ? (
          <select
            aria-label={`Asistencia de ${fila.nombre} para ${clase.titulo}`}
            value={marcasDelDia[fila.alumno_id] ?? ''}
            onChange={(evento) =>
              setMarcasDelDia((anteriores) => ({
                ...anteriores,
                [fila.alumno_id]: evento.target.value,
              }))
            }
            className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
          >
            <option value={ESTADO_ASISTENCIA.PRESENTE}>Presente</option>
            <option value={ESTADO_ASISTENCIA.AUSENTE}>Ausente</option>
          </select>
        ) : (
          <Badge tono={TONOS_MARCA[fila.marcas[clase.fecha]] ?? TONO.GRIS}>
            {ETIQUETAS_MARCA[fila.marcas[clase.fecha]] ?? ''}
          </Badge>
        ),
    })),
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Asistencia</h2>
          <Badge tono={TONO.ESMERALDA}>
            {`${asistencia.codigo} · ${asistencia.nombre_curso}`}
          </Badge>
        </div>

        <Button onClick={() => setAviso('Asistencia del día guardada en el maquetado.')}>
          Guardar asistencia
        </Button>
      </div>

      <Card titulo="Clase del día">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium text-slate-700">{asistencia.sesion.rotulo}</span>
          <span role="status" className="text-sm text-slate-700">
            {`${presentes} presente${presentes === 1 ? '' : 's'} · ${ausentes} ausente${
              ausentes === 1 ? '' : 's'
            }`}
          </span>
        </div>
      </Card>

      <Card titulo="Asistencia por clase">
        <Table
          columnas={columnas}
          filas={asistencia.filas}
          claveDeFila={(fila) => fila.alumno_id}
        />

        <p className="mt-4 text-xs text-slate-500">
          Solo la columna del día se puede cambiar. Las clases ya dictadas quedan como las registró
          el docente.
        </p>

        {aviso !== null && (
          <p role="status" className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {aviso}
          </p>
        )}
      </Card>
    </div>
  )
}
