import { useEffect, useState } from 'react'
import { useSession } from '../auth/SessionContext'
import { Button, Card } from '../components/ui'
import { obtenerResumenCatalogo } from '../services/dataService'
import { formatFechaLarga } from '../utils/formato'

/**
 * Tablero operativo (9.2), con la composición del diseño (`docs/design/figma-dashboards-overhaul/`).
 *
 * **La fila de cuatro tarjetas se pinta siempre.** `COMISIONES` sale del catálogo y no de un agregado
 * propio: muestra el conteo que devuelve `obtenerResumenCatalogo()` —el valor que informa la
 * fuente— y no `listarComisiones().length`: el spec prohíbe calcular el agregado en la pantalla.
 * `ALUMNOS INSCRIPTOS`, `COBROS PENDIENTES DE COBRO` y `CUPO PROMEDIO OCUPADO` no tienen endpoint
 * detrás, así que su valor honesto es `—`: ninguna pantalla borra un elemento porque su dato no
 * exista todavía (D43).
 *
 * **El pendiente es `—`, nunca un `0`.** La bandera es el propio dato (`resumen === null`): mientras
 * la lectura no resuelve o el catálogo rechaza, `COMISIONES` muestra `—`; con la lectura resuelta
 * muestra el conteo real, incluido un `0` real. El bloque `Alertas de Gestión Pendiente` vuelve con
 * su encabezado y `—` en el cuerpo, porque sus líneas no tienen fuente ni historia de usuario detrás.
 *
 * **Los accesos rápidos son composición inerte.** Las tres acciones se pueden pulsar y no navegan
 * ni ejecutan nada: ninguna historia de usuario cubre esta pantalla.
 *
 * **La fecha del encabezado es la fecha real del día**, no un literal del maquetado (D43).
 */

/** Las tres acciones del personal. No navegan: ninguna historia las cubre. */
const ACCESOS_RAPIDOS = Object.freeze([
  'Registrar Cobranza',
  'Verificar Habilitaciones',
  'Descargar Reporte del Día',
])

/** Los tres indicadores que ninguna fuente respalda: su valor honesto es `—` (D43). */
const INDICADORES_SIN_FUENTE = Object.freeze([
  'ALUMNOS INSCRIPTOS',
  'COBROS PENDIENTES DE COBRO',
  'CUPO PROMEDIO OCUPADO',
])

export function DashboardPage() {
  const { session } = useSession()
  const [resumen, setResumen] = useState(null)

  useEffect(() => {
    obtenerResumenCatalogo()
      .then(setResumen)
      .catch(() => setResumen(null))
  }, [])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          {`Buen día, ${session.nombre}`}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {`${formatFechaLarga()} · Todo lo que necesitás para gestionar tu academia.`}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            COMISIONES
          </p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">
            {resumen === null ? '—' : resumen.total_comisiones}
          </p>
          <p className="mt-1 text-xs text-slate-500">en el catálogo</p>
        </Card>

        {INDICADORES_SIN_FUENTE.map((rotulo) => (
          <Card key={rotulo}>
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              {rotulo}
            </p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">—</p>
          </Card>
        ))}
      </div>

      <Card titulo="Alertas de Gestión Pendiente">
        <p className="text-sm text-slate-500">—</p>
      </Card>

      <Card titulo="Accesos Rápidos del Personal">
        <div className="flex flex-wrap gap-2">
          {/* Botones sin `onClick`: se pueden pulsar y no pasa nada, porque ninguna historia
              de usuario cubre esta pantalla. Deshabilitados se verían como caídos. */}
          {ACCESOS_RAPIDOS.map((accion) => (
            <Button key={accion} variante="secundario">
              {accion}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  )
}
