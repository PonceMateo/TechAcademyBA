import { Badge, Button, Card } from '../components/ui'
import { TONO } from '../components/ui/paleta'

/**
 * Tablero operativo (9.2).
 *
 * **Todo lo de esta pantalla es texto fijo.** No consulta datos, no calcula agregados y no navega:
 * no hay historia de usuario que la cubra (la tabla de cobertura de `design.md` lo dice en la
 * fila 6). Los valores son los del prototipo y los del cliente, y están escritos acá a propósito,
 * no derivados: un tablero que calcula sobre datos de ejemplo daría la impresión de estar
 * midiendo algo real.
 *
 * **El `27%` del cupo promedio es el caso que más tentador es "arreglar".** El cálculo real sobre
 * las cinco comisiones del maquetado da 43 ocupados sobre 160 lugares, que redondea a 27%. Coincide
 * con el texto del prototipo, así que el número no es inventado. Igual: el spec prohíbe calcularlo
 * en tiempo de ejecución, y `src/mocks/mocks.test.js` verifica la coherencia de los números desde
 * el otro lado.
 *
 * **Ninguna alerta es un enlace.** La cuarta línea es la lista de espera, que es una función real
 * que el cliente confirmó y que queda fuera de este change: se muestra el caso y no se ofrece un
 * camino a una pantalla que no existe (D20).
 */

/** Los cuatro indicadores, con rótulo, valor y texto de apoyo literales. */
const INDICADORES = Object.freeze([
  { rotulo: 'ALUMNOS INSCRIPTOS', valor: '8', apoyo: 'en comisiones abiertas y en curso' },
  { rotulo: 'COMISIONES', valor: '10', apoyo: 'en el catálogo' },
  {
    rotulo: 'COBROS PENDIENTES DE COBRO',
    valor: '3',
    apoyo: '3 comprobantes observados',
  },
  {
    rotulo: 'CUPO PROMEDIO OCUPADO',
    valor: '27%',
    apoyo: 'sobre las comisiones del catálogo',
  },
])

/** Los tres casos que el cliente reconoce como sus problemas, más la línea de lista de espera. */
const ALERTAS = Object.freeze([
  { texto: 'Comprobante ilegible de Agustina Benítez', chip: 'Urgente', tono: TONO.ROJO },
  {
    texto: 'Cheque de Banco Federal pendiente de acreditación',
    chip: 'Observado',
    tono: TONO.AMBAR,
  },
  { texto: 'Valeria Rossi debe la mitad del arancel', chip: 'Aviso', tono: TONO.GRIS },
  {
    texto:
      'La comisión CUR-104 alcanzó su cupo de 20 inscriptos y figura cerrada por cupo. Hay lista de espera activa.',
    chip: 'Aviso',
    tono: TONO.GRIS,
  },
])

/** Las tres acciones del personal. No navegan: ninguna historia las cubre. */
const ACCESOS_RAPIDOS = Object.freeze([
  'Registrar Cobranza',
  'Verificar Habilitaciones',
  'Descargar Reporte del Día',
])

export function DashboardPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Dashboard</h2>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {INDICADORES.map((indicador) => (
          <Card key={indicador.rotulo}>
            <p className="text-xs font-semibold tracking-wider text-slate-500">
              {indicador.rotulo}
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{indicador.valor}</p>
            <p className="mt-1 text-xs text-slate-500">{indicador.apoyo}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card titulo="Alertas de Gestión Pendiente">
          <ul className="space-y-3">
            {ALERTAS.map((alerta) => (
              <li
                key={alerta.texto}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-b-0"
              >
                <span className="text-sm text-slate-700">{alerta.texto}</span>
                <Badge tono={alerta.tono}>{alerta.chip}</Badge>
              </li>
            ))}
          </ul>
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
    </div>
  )
}
