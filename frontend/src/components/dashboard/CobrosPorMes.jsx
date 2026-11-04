import { useState } from 'react'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { formatMoneda } from '../../utils/formato'

/**
 * Serie de cobros acreditados del tablero de Administración (H/U 55).
 *
 * **Sale de `cobranza.fecha`.** El modelo no guarda la fecha de inscripción, así que el gráfico no
 * puede ser de altas: es el importe acreditado de los últimos seis meses, con los meses sin cobros
 * en cero. Lo observado y lo rechazado no se suman.
 *
 * **El canvas no existe en jsdom.** Para que la prueba del tablero no dependa de un canvas real, el
 * componente detecta si el navegador puede dibujar y, si no, deja un resumen textual con el mismo
 * dato. En un navegador se dibuja la línea; la prueba verifica el resumen accesible.
 */

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function etiquetaDeMes(mes) {
  const [anio, numero] = String(mes).split('-')
  return `${MESES[Number(numero) - 1] ?? numero} ${String(anio).slice(2)}`
}

function puedeDibujar() {
  try {
    return Boolean(document.createElement('canvas').getContext('2d'))
  } catch {
    return false
  }
}

export function CobrosPorMes({ serie = [], color = '#3975d5' }) {
  // El canvas se comprueba una vez, al montar: en jsdom no hay contexto 2D y queda el resumen.
  const [dibuja] = useState(puedeDibujar)

  if (serie.length === 0) {
    return (
      <p className="text-sm text-[var(--texto-etiqueta)]">
        Todavía no hay cobros acreditados para graficar.
      </p>
    )
  }

  const total = serie.reduce((suma, punto) => suma + Number(punto.importe ?? 0), 0)
  const resumen = `Cobros acreditados de los últimos ${serie.length} meses. Total ${formatMoneda(total)}.`

  if (!dibuja) {
    return (
      <p
        role="img"
        aria-label={resumen}
        className="rounded-xl bg-[var(--superficie-interna)] px-3 py-6 text-sm text-[var(--texto-etiqueta)]"
      >
        {resumen}
      </p>
    )
  }

  return (
    <div className="h-56">
      <Line
        data={{
          labels: serie.map((punto) => etiquetaDeMes(punto.mes)),
          datasets: [
            {
              data: serie.map((punto) => Number(punto.importe ?? 0)),
              borderColor: color,
              backgroundColor: `${color}1f`,
              borderWidth: 2,
              pointRadius: 3,
              pointBackgroundColor: color,
              fill: true,
              tension: 0.35,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (contexto) => formatMoneda(contexto.parsed.y),
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: { color: '#6e7c8c' },
            },
            y: {
              beginAtZero: true,
              border: { display: false },
              grid: { color: 'rgba(110, 124, 140, 0.12)' },
              ticks: {
                color: '#6e7c8c',
                callback: (valor) => formatMoneda(valor),
              },
            },
          },
        }}
        aria-label={resumen}
      />
    </div>
  )
}
