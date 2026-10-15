import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  accountForRole,
  renderAppAs,
  resetDataSource,
  stubBackend,
  stubDataSource,
} from '../test/support'
import { formatFechaLarga } from '../utils/formato'

/**
 * Tablero operativo (9.2).
 *
 * **La fila de cuatro tarjetas y el bloque de alertas se pintan siempre.** El tablero lee
 * `obtenerResumenCatalogo()` y muestra `COMISIONES` con el conteo que la fuente devuelve; las otras
 * tres tarjetas y el bloque de alertas no tienen endpoint detrás, así que su valor es `—`. Mientras
 * la lectura no resuelve —o rechaza— `COMISIONES` también es `—`, nunca un `0` (D43).
 *
 * **Los accesos rápidos se pueden pulsar y no pasa nada.** Un botón deshabilitado cumpliría el "no
 * pasa nada" y rompería el "se puede pulsar", así que la prueba las aprieta y verifica que la ruta no
 * cambie.
 *
 * **La fecha se afirma a través del helper**, nunca con un literal: el formato queda clavado en
 * `formato.test.js` y acá solo se verifica el cableado.
 */

/** El tablero abre con el saludo de la cuenta de la sesión y no con el nombre de la sección. */
const SALUDO = `Buen día, ${accountForRole('ADMIN').nombre}`
const RESUMEN = `${formatFechaLarga()} · Todo lo que necesitás para gestionar tu academia.`

const ACCESOS_RAPIDOS = [
  'Registrar Cobranza',
  'Verificar Habilitaciones',
  'Descargar Reporte del Día',
]

const ROTULOS = [
  'COMISIONES',
  'ALUMNOS INSCRIPTOS',
  'COBROS PENDIENTES DE COBRO',
  'CUPO PROMEDIO OCUPADO',
]

/** Monta el tablero con la fuente de datos de ejemplo o con la función sustituida que pida el caso. */
async function entrar(overrides = null) {
  resetDataSource()
  if (overrides !== null) {
    stubDataSource(overrides)
  }
  stubBackend()
  renderAppAs('ADMIN', '/admin')
  await screen.findByRole('heading', { name: SALUDO })
}

/** La tarjeta de un indicador: el rótulo es un `<p>` y su contenedor es el `<section>` de `Card`. */
function tarjeta(rotulo) {
  return screen.getByText(rotulo, { selector: 'p' }).parentElement
}

describe('encabezado', () => {
  it('muestra la fecha real del día', async () => {
    await entrar()

    expect(screen.getByText(RESUMEN)).toBeInTheDocument()
  })
})

describe('los cuatro indicadores', () => {
  it('muestra las cuatro tarjetas con sus rótulos', async () => {
    await entrar({ obtenerResumenCatalogo: async () => ({ total_comisiones: 7 }) })

    for (const rotulo of ROTULOS) {
      expect(screen.getByText(rotulo, { selector: 'p' })).toBeInTheDocument()
    }
  })

  it('muestra COMISIONES con el conteo que devuelve el catálogo', async () => {
    await entrar({ obtenerResumenCatalogo: async () => ({ total_comisiones: 7 }) })

    await waitFor(() => expect(tarjeta('COMISIONES')).toHaveTextContent('7'))
    expect(screen.getByText('en el catálogo')).toBeInTheDocument()
  })

  it('muestra un 0 real cuando el catálogo informa cero', async () => {
    await entrar({ obtenerResumenCatalogo: async () => ({ total_comisiones: 0 }) })

    await waitFor(() => expect(tarjeta('COMISIONES')).toHaveTextContent('0'))
    expect(tarjeta('COMISIONES')).not.toHaveTextContent('—')
  })

  it('muestra las otras tres tarjetas con —, sin ningún número que las respalde', async () => {
    await entrar({ obtenerResumenCatalogo: async () => ({ total_comisiones: 7 }) })

    for (const rotulo of ['ALUMNOS INSCRIPTOS', 'COBROS PENDIENTES DE COBRO', 'CUPO PROMEDIO OCUPADO']) {
      expect(tarjeta(rotulo)).toHaveTextContent('—')
    }
  })
})

describe('el bloque de alertas', () => {
  it('muestra su encabezado con — en el cuerpo y sin las alertas inventadas', async () => {
    await entrar({ obtenerResumenCatalogo: async () => ({ total_comisiones: 7 }) })

    const alertas = screen.getByText('Alertas de Gestión Pendiente').closest('section')
    expect(within(alertas).getByText('—')).toBeInTheDocument()

    for (const inventada of [
      'Comprobante ilegible de Agustina Benítez',
      'Cheque de Banco Federal pendiente de acreditación',
      'Valeria Rossi debe la mitad del arancel',
      /lista de espera.*CUR-104/,
    ]) {
      expect(screen.queryByText(inventada)).not.toBeInTheDocument()
    }
    expect(screen.queryByText('27%')).not.toBeInTheDocument()
  })
})

describe('mientras la lectura del catálogo no resuelve', () => {
  it('pinta las cuatro tarjetas y el bloque de alertas con —, nunca un 0', async () => {
    await entrar({ obtenerResumenCatalogo: () => new Promise(() => {}) })

    for (const rotulo of ROTULOS) {
      expect(tarjeta(rotulo)).toHaveTextContent('—')
      expect(tarjeta(rotulo)).not.toHaveTextContent('0')
    }
    expect(screen.getByText('Alertas de Gestión Pendiente')).toBeInTheDocument()
    // Lo que no depende de la lectura sí se pinta.
    expect(screen.getByText(RESUMEN)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar Cobranza' })).toBeInTheDocument()
  })

  it('conserva la forma con — si el catálogo rechaza', async () => {
    await entrar({
      obtenerResumenCatalogo: async () => {
        throw new Error('No pudimos conectar con el servidor.')
      },
    })

    await waitFor(() => expect(tarjeta('COMISIONES')).toHaveTextContent('—'))
    for (const rotulo of ROTULOS) {
      expect(tarjeta(rotulo)).not.toHaveTextContent('0')
    }
    expect(screen.getByText('Alertas de Gestión Pendiente')).toBeInTheDocument()
    expect(screen.getByText(RESUMEN)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar Cobranza' })).toBeInTheDocument()
  })
})

describe('accesos rápidos del personal', () => {
  it('muestra las tres acciones', async () => {
    await entrar()

    expect(screen.getByText('Accesos Rápidos del Personal')).toBeInTheDocument()
    for (const accion of ACCESOS_RAPIDOS) {
      expect(screen.getByRole('button', { name: accion })).toBeInTheDocument()
    }
  })

  it('no navega ni ejecuta lógica al pulsarlas', async () => {
    await entrar()

    const user = userEvent.setup()
    const navegar = vi.fn()
    window.addEventListener('popstate', navegar)

    for (const accion of ACCESOS_RAPIDOS) {
      await user.click(screen.getByRole('button', { name: accion }))
    }

    expect(navegar).not.toHaveBeenCalled()
    // La sección sigue siendo el tablero: ninguna acción sacó a la secretaría de la pantalla.
    await waitFor(() => expect(screen.getByRole('heading', { name: SALUDO })).toBeInTheDocument())

    window.removeEventListener('popstate', navegar)
  })
})
