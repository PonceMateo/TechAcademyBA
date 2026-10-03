import { useEffect, useState } from 'react'
import { Badge, Card, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { obtenerComisionesAsignadas } from '../services/dataService'

/**
 * Comisiones asignadas del docente (10.2).
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
  const [comisiones, setComisiones] = useState([])

  useEffect(() => {
    obtenerComisionesAsignadas().then(setComisiones)
  }, [])

  const habilitados = comisiones.reduce((total, fila) => total + fila.habilitados, 0)
  const bloqueados = comisiones.reduce((total, fila) => total + fila.bloqueados, 0)
  const proxima = comisiones.find((fila) => fila.proxima_clase !== null)?.proxima_clase ?? '—'

  const indicadores = [
    { rotulo: 'COMISIONES ACTIVAS', valor: String(comisiones.length) },
    { rotulo: 'ALUMNOS HABILITADOS', valor: String(habilitados) },
    { rotulo: 'BLOQUEADOS', valor: String(bloqueados) },
    { rotulo: 'PRÓXIMA CLASE', valor: proxima },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Mis Comisiones</h2>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {indicadores.map((indicador) => (
          <Card key={indicador.rotulo}>
            <p className="text-xs font-semibold tracking-wider text-slate-500">
              {indicador.rotulo}
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{indicador.valor}</p>
          </Card>
        ))}
      </div>

      <Card titulo="Comisiones asignadas">
        <Table
          columnas={COLUMNAS}
          filas={comisiones}
          claveDeFila={(fila) => fila.codigo}
          vacio={
            <p className="text-sm text-slate-500">
              No tenés comisiones asignadas en este período lectivo.
            </p>
          }
        />
      </Card>
    </div>
  )
}
