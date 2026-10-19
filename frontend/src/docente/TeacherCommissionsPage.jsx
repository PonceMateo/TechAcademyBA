import { useEffect, useState } from 'react'
import { useSession } from '../auth/SessionContext'
import { Badge, Card, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { obtenerComisionesAsignadas } from '../services/dataService'
import { formatFechaLarga } from '../utils/formato'

/**
 * Tablero del docente (10.2): comisiones asignadas, con la composición del diseño
 * (`docs/design/figma-dashboards-overhaul/`).
 *
 * **Los tres indicadores salen de la misma lista que la tabla.** `COMISIONES ACTIVAS`,
 * `ALUMNOS HABILITADOS` y `BLOQUEADOS` se cuentan sobre las comisiones que la fila muestra, así que
 * el escenario del spec que pide cruzar el `1` del indicador con el padrón de `CUR-101` se cumple
 * por construcción: no hay dos números que puedan dejar de coincidir.
 *
 * **La columna se titula `ACCESO` y no `RESTRICCIONES`.** Es una corrección intencional del
 * prototipo que el spec fija: las celdas contienen conteos de acceso, no restricciones.
 *
 * **Una sola comisión y no se completa el bloque.** El docente del maquetado tiene exactamente una
 * comisión asignada en los datos del cliente; agregar filas para que el cuadro se vea lleno sería
 * inventar comisiones.
 *
 * **Los contadores hablan en singular y en plural.** `1 bloqueado` y `4 bloqueados` son el mismo
 * dato con la palabra correcta, y un `1 bloqueados` en pantalla hace dudar de la cuenta.
 *
 * **La columna derecha es la agenda de la única comisión, y los bloques del prototipo que no
 * tienen datos no están.** `Correcciones pendientes`, `Novedades` y `Mensajes` del Figma no se
 * construyen: el maquetado no registra entregas por corregir ni mensajes (D40). La agenda se arma
 * con el horario y la próxima clase de la comisión, que son los mismos datos del bloque de arriba.
 *
 * **La línea de fecha del encabezado es la fecha real del día**, no un literal del maquetado (D43), y
 * no anuncia cantidades de clases ni de entregas porque esos valores no están en el maquetado (D40).
 *
 * **El pendiente se distingue del vacío real.** `comisiones` arranca en `null` y queda en `null` en el
 * rechazo: mientras la lectura no resuelve o falla, los cuatro indicadores muestran `—`; con la
 * lectura resuelta vuelven los valores derivados, incluido un `0` real, y la tabla y la agenda caen a
 * sus mensajes de vacío (D43).
 */

/** Los contadores de acceso, con el tono que los distingue. */
const TONOS_ACCESO = { habilitado: TONO.VERDE, bloqueado: TONO.ROJO }

const COLUMNAS = [
  {
    clave: 'codigo',
    titulo: 'CÓDIGO',
    render: (fila) => <span className="font-medium">{fila.codigo}</span>,
  },
  { clave: 'curso', titulo: 'CURSO', render: (fila) => fila.nombre_curso },
  { clave: 'docente', titulo: 'DOCENTE', render: (fila) => fila.docente_nombre },
  { clave: 'horario', titulo: 'HORARIO', render: (fila) => fila.horario },
  { clave: 'proxima', titulo: 'PRÓXIMA CLASE', render: (fila) => fila.proxima_clase ?? '' },
  {
    clave: 'acceso',
    titulo: 'ACCESO',
    render: (fila) => (
      <span className="inline-flex flex-wrap items-center gap-1">
        <Badge tono={TONOS_ACCESO.habilitado}>{pluralizar(fila.habilitados, 'habilitado')}</Badge>
        <Badge tono={TONOS_ACCESO.bloqueado}>{pluralizar(fila.bloqueados, 'bloqueado')}</Badge>
      </span>
    ),
  },
]

/** `1 bloqueado` y `4 bloqueados`: la cantidad manda sobre la palabra. */
function pluralizar(cantidad, palabra) {
  return `${cantidad} ${cantidad === 1 ? palabra : `${palabra}s`}`
}

export function TeacherCommissionsPage() {
  const { session } = useSession()
  const [comisiones, setComisiones] = useState(null)

  useEffect(() => {
    obtenerComisionesAsignadas()
      .then(setComisiones)
      .catch(() => setComisiones(null))
  }, [])

  const pendiente = comisiones === null
  const lista = comisiones ?? []
  const habilitados = lista.reduce((total, fila) => total + fila.habilitados, 0)
  const bloqueados = lista.reduce((total, fila) => total + fila.bloqueados, 0)
  const proxima = lista.find((fila) => fila.proxima_clase !== null)?.proxima_clase ?? '—'

  const indicadores = [
    { rotulo: 'COMISIONES ACTIVAS', valor: pendiente ? '—' : String(lista.length) },
    { rotulo: 'ALUMNOS HABILITADOS', valor: pendiente ? '—' : String(habilitados) },
    { rotulo: 'BLOQUEADOS', valor: pendiente ? '—' : String(bloqueados) },
    { rotulo: 'PRÓXIMA CLASE', valor: pendiente ? '—' : proxima },
  ]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          {`Buen día, ${session.nombre}`}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {`${formatFechaLarga()} · Tu agenda y tus comisiones en un solo lugar.`}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {indicadores.map((indicador) => (
          <Card key={indicador.rotulo}>
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              {indicador.rotulo}
            </p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{indicador.valor}</p>
          </Card>
        ))}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card titulo="Comisiones asignadas">
          <Table
            columnas={COLUMNAS}
            filas={lista}
            claveDeFila={(fila) => fila.codigo}
            vacio={
              <p className="text-sm text-slate-500">
                No tenés comisiones asignadas en este período lectivo.
              </p>
            }
          />
        </Card>

        <Card titulo="Tu agenda">
          {lista.length === 0 ? (
            <p className="text-sm text-slate-500">No tenés clases programadas en este período.</p>
          ) : (
            <ul className="space-y-3">
              {lista.map((comision) => (
                <li
                  key={comision.codigo}
                  className="rounded-xl bg-slate-50 px-4 py-3 last:mb-0"
                >
                  <p className="text-sm font-semibold text-slate-800">
                    {comision.proxima_clase ?? 'Sin próxima clase'}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {`${comision.nombre_curso} · ${comision.codigo}`}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{comision.horario}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
