import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { accountForRole, renderAppAs, resetDataSource, stubBackend } from '../test/support'

/**
 * Tablero operativo (9.2).
 *
 * **Los valores son texto fijo y eso es lo que se prueba.** No hay historia de usuario para esta
 * pantalla, así que el tablero no consulta datos ni calcula agregados. Un tablero que calculara
 * sobre datos de_example se vería midiendo algo real.
 *
 * El caso interesante es el de las tres acciones rápidas: el spec dice que se pueden pulsar y que
 * no pasa nada. Un botón deshabilitado cumpliría el "no pasa nada" y rompería el "se puede pulsar",
 * así que la prueba las aprieta y verifica que la ruta no cambie.
 *
 * **El encabezado del tablero es el saludo, no el título `Dashboard`.** Desde el change
 * `ui-figma-dashboards` el tablero abre con `Buen día, {cuenta}` y su línea de fecha placeholder; el
 * nombre de la sección queda en el ítem del menú y en el breadcrumb del armazón.
 */

/** Los cuatro indicadores con rótulo, valor y texto de apoyo literales. */
const INDICADORES = [
  ['ALUMNOS INSCRIPTOS', '8', 'en comisiones abiertas y en curso'],
  ['COMISIONES', '10', 'en el catálogo'],
  ['COBROS PENDIENTES DE COBRO', '3', '3 comprobantes observados'],
  ['CUPO PROMEDIO OCUPADO', '27%', 'sobre las comisiones del catálogo'],
]

const ALERTAS = [
  ['Comprobante ilegible de Agustina Benítez', 'Urgente'],
  ['Cheque de Banco Federal pendiente de acreditación', 'Observado'],
  ['Valeria Rossi debe la mitad del arancel', 'Aviso'],
  [
    'La comisión CUR-104 alcanzó su cupo de 20 inscriptos y figura cerrada por cupo. Hay lista de espera activa.',
    'Aviso',
  ],
]

const ACCESOS_RAPIDOS = [
  'Registrar Cobranza',
  'Verificar Habilitaciones',
  'Descargar Reporte del Día',
]

/** El tablero abre con el saludo de la cuenta de la sesión y no con el nombre de la sección. */
const SALUDO = `Buen día, ${accountForRole('ADMIN').nombre}`

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  renderAppAs('ADMIN', '/admin')
  await screen.findByRole('heading', { name: SALUDO })
})

describe('indicadores', () => {
  it.each(INDICADORES)('muestra %s con su valor y su texto de apoyo', (rotulo, valor, apoyo) => {
    expect(screen.getByText(rotulo)).toBeInTheDocument()
    expect(screen.getByText(valor)).toBeInTheDocument()
    expect(screen.getByText(apoyo)).toBeInTheDocument()
  })

  it('no calcula el porcentaje de cupo: es el texto fijo del maquetado', () => {
    // 43 ocupados sobre 160 lugares da 26,8%. Que se muestre 27% y no el cálculo es la prueba de
    // que la pantalla no agrega nada.
    expect(screen.getByText('27%')).toBeInTheDocument()
  })
})

describe('alertas de gestión pendiente', () => {
  it('muestra el bloque con sus tres casos reales', () => {
    expect(screen.getByText('Alertas de Gestión Pendiente')).toBeInTheDocument()

    for (const texto of ALERTAS.slice(0, 3).map(([linea]) => linea)) {
      expect(screen.getByText(texto)).toBeInTheDocument()
    }
    // `Aviso` aparece en la tercera y en la cuarta línea, así que son dos elementos y no uno.
    expect(screen.getAllByText('Aviso')).toHaveLength(2)
    expect(screen.getByText('Urgente')).toBeInTheDocument()
    expect(screen.getByText('Observado')).toBeInTheDocument()
  })

  it('muestra la cuarta línea de lista de espera, que es contenido de ejemplo', () => {
    expect(screen.getByText(ALERTAS[3][0])).toBeInTheDocument()
  })

  it('no convierte ninguna alerta en un enlace a una pantalla que no existe', () => {
    const enlaces = screen.getAllByRole('link').map((enlace) => enlace.textContent)

    for (const [texto] of ALERTAS) {
      expect(enlaces).not.toContain(texto)
    }
  })
})

describe('accesos rápidos del personal', () => {
  it('muestra las tres acciones', () => {
    expect(screen.getByText('Accesos Rápidos del Personal')).toBeInTheDocument()
    for (const accion of ACCESOS_RAPIDOS) {
      expect(screen.getByRole('button', { name: accion })).toBeInTheDocument()
    }
  })

  it('no navega ni ejecuta lógica al pulsarlas', async () => {
    const user = userEvent.setup()
    const navegar = vi.fn()
    window.addEventListener('popstate', navegar)

    for (const accion of ACCESOS_RAPIDOS) {
      await user.click(screen.getByRole('button', { name: accion }))
    }

    expect(navegar).not.toHaveBeenCalled()
    // La sección sigue siendo el tablero: ninguna acción sacó a la secretaría de la pantalla.
    await waitFor(() => expect(screen.getByRole('heading', { name: SALUDO })).toBeInTheDocument())
    expect(screen.getByText(ALERTAS[0][0])).toBeInTheDocument()

    window.removeEventListener('popstate', navegar)
  })
})
