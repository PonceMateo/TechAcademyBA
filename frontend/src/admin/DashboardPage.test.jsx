import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  accountForRole,
  renderAppAs,
  resetDataSource,
  stubBackend,
  stubDataSource,
} from '../test/support'
import { formatFechaLarga } from '../utils/formato'

/**
 * Tablero de Administración (H/U 55).
 *
 * **Todo lo que se afirma sale del agregado.** La fuente se sustituye con una respuesta completa
 * para ver valores que el maquetado no tiene y para que el test no dependa de cuántas comisiones
 * tenga el ejemplo. Lo que se cuida es el contrato: las cuatro tarjetas, la serie, los comprobantes
 * recientes con las etiquetas de Cobranzas, la agenda de todas las comisiones y la campana con
 * los avisos. Los números del prototipo (`1.248`, `32`, `8,4 M`, `12`) no se reproducen.
 */

const SALUDO = `Buen día, ${accountForRole('ADMIN').nombre}`

const DASHBOARD = {
  indicadores: {
    alumnos_inscriptos: 12,
    inscripciones_activas: 15,
    cupo_promedio_ocupado: '62.5',
    comisiones: 4,
    comisiones_vigentes: 3,
    cobros_pendientes: 5,
    comprobantes_pendientes: 3,
    cobranzas_observadas: 2,
    cobrado_mes_actual: '125000',
  },
  cobros_por_mes: [
    { mes: '2025-12', importe: '0' },
    { mes: '2026-01', importe: '25000' },
    { mes: '2026-02', importe: '0' },
    { mes: '2026-03', importe: '40000' },
    { mes: '2026-04', importe: '30000' },
    { mes: '2026-05', importe: '125000' },
  ],
  ocupacion_por_comision: [
    {
      codigo: 'CUR-101-1',
      nombre_curso: 'Python Inicial',
      inscriptos: 10,
      cupo: 20,
      porcentaje: '50.0',
    },
  ],
  comprobantes_recientes: [
    {
      id: 1,
      alumno: 'Agustina Benítez',
      inscripcion: { codigo: 'CUR-102-1', nombre_curso: 'Desarrollo Web Full Stack' },
      fecha_pago: '2026-05-18',
      importe: '45000',
      medio: 'TRANSFERENCIA',
      estado: 'PENDIENTE_REVISION',
      enviado_at: '2026-05-18T10:00:00Z',
      motivo: null,
    },
  ],
  agenda: [
    {
      fecha: '2026-05-25',
      horario: '18:30-21:30',
      tema: 'Componentes y props',
      codigo: 'CUR-101-1',
      nombre_curso: 'Python Inicial',
      docente_nombre: 'Profe Martín',
    },
  ],
}

function tarjeta(rotulo) {
  return screen.getByText(rotulo, { selector: 'p' }).closest('section')
}

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  stubDataSource({ obtenerDashboardAdmin: async () => DASHBOARD })
  renderAppAs('ADMIN', '/admin')
  await screen.findByRole('heading', { name: SALUDO })
  await waitFor(() => expect(tarjeta('ALUMNOS INSCRIPTOS')).toHaveTextContent('12'))
})

describe('encabezado y tarjetas', () => {
  it('muestra la fecha real del día', () => {
    expect(
      screen.getByText(`${formatFechaLarga()} · Todo lo que necesitás para gestionar tu academia.`),
    ).toBeInTheDocument()
  })

  it('muestra los cuatro indicadores con los valores del agregado', () => {
    expect(tarjeta('ALUMNOS INSCRIPTOS')).toHaveTextContent('12')
    expect(tarjeta('ALUMNOS INSCRIPTOS')).toHaveTextContent('15 inscripciones activas')
    expect(tarjeta('CUPO PROMEDIO OCUPADO')).toHaveTextContent('62,5 %')
    expect(tarjeta('COMISIONES')).toHaveTextContent('4')
    expect(tarjeta('COMISIONES')).toHaveTextContent('3 vigentes')
    expect(tarjeta('COBROS PENDIENTES DE COBRO')).toHaveTextContent('5')
    expect(tarjeta('COBROS PENDIENTES DE COBRO')).toHaveTextContent('3 comprobantes')
  })

  it('no reproduce los números fijos del prototipo', () => {
    expect(screen.queryByText('1.248')).not.toBeInTheDocument()
    expect(screen.queryByText('32')).not.toBeInTheDocument()
    expect(screen.queryByText('8,4 M')).not.toBeInTheDocument()
  })
})

describe('panorama de cobros', () => {
  it('muestra el total del mes y el resumen accesible de la serie', () => {
    expect(screen.getByText('$125.000')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /Cobros acreditados de los últimos 6 meses/ }),
    ).toHaveTextContent('Total $220.000')
  })

  it('muestra la ocupación por comisión con inscriptos y cupo', () => {
    expect(screen.getByText('Python Inicial')).toBeInTheDocument()
    expect(screen.getByText('10/20 · 50 %')).toBeInTheDocument()
  })
})

describe('comprobantes recientes', () => {
  it('usa las mismas etiquetas que Cobranzas y muestra el importe', () => {
    const bloque = screen.getByRole('heading', { name: 'Comprobantes recientes' }).closest('section')

    expect(within(bloque).getByText('Agustina Benítez')).toBeInTheDocument()
    expect(within(bloque).getByText('$45.000')).toBeInTheDocument()
    expect(within(bloque).getByText('Pendiente de revisión')).toBeInTheDocument()
    expect(within(bloque).getByText(/18\/05\/2026/)).toBeInTheDocument()
  })

  it('lleva a Cobranzas con Ver todos', () => {
    const bloque = screen.getByRole('heading', { name: 'Comprobantes recientes' }).closest('section')

    expect(within(bloque).getByRole('link', { name: /Ver todos/ })).toHaveAttribute(
      'href',
      '/admin/cobranzas',
    )
  })
})

describe('agenda y avisos', () => {
  it('muestra la clase de cualquier comisión con su horario y tema', () => {
    expect(screen.getByText('25/05/2026 · 18:30-21:30')).toBeInTheDocument()
    expect(screen.getByText('Python Inicial · CUR-101-1')).toBeInTheDocument()
    expect(screen.getByText('Componentes y props')).toBeInTheDocument()
  })

  it('abre la campana con los avisos del tablero', async () => {
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Notificaciones, 2 pendientes' }))

    expect(
      screen.getByRole('link', { name: /Comprobantes sin revisar/ }),
    ).toHaveAttribute('href', '/admin/cobranzas')
    expect(screen.getByRole('link', { name: /Cobranzas observadas/ })).toHaveAttribute(
      'href',
      '/admin/cobranzas',
    )
  })

  it('los accesos rápidos navegan a pantallas reales', () => {
    expect(screen.getByRole('link', { name: 'Registrar Cobranza' })).toHaveAttribute(
      'href',
      '/admin/cobranzas',
    )
    expect(screen.getByRole('link', { name: 'Verificar Habilitaciones' })).toHaveAttribute(
      'href',
      '/admin/alumnos',
    )
    expect(screen.queryByText('Descargar Reporte del Día')).not.toBeInTheDocument()
  })
})

describe('tablero vacío', () => {
  it('muestra ceros reales y los mensajes de vacío sin inventar filas', async () => {
    cleanup()
    stubDataSource({
      obtenerDashboardAdmin: async () => ({
        indicadores: {
          alumnos_inscriptos: 0,
          inscripciones_activas: 0,
          cupo_promedio_ocupado: null,
          comisiones: 0,
          comisiones_vigentes: 0,
          cobros_pendientes: 0,
          comprobantes_pendientes: 0,
          cobranzas_observadas: 0,
          cobrado_mes_actual: '0',
        },
        cobros_por_mes: [],
        ocupacion_por_comision: [],
        comprobantes_recientes: [],
        agenda: [],
      }),
    })
    renderAppAs('ADMIN', '/admin')

    await screen.findByText(/Todavía no hay comprobantes enviados/)
    expect(tarjeta('ALUMNOS INSCRIPTOS')).toHaveTextContent('0')
    expect(tarjeta('CUPO PROMEDIO OCUPADO')).toHaveTextContent('—')
    expect(screen.getByText('No hay clases en los próximos siete días.')).toBeInTheDocument()
  })
})

describe('error de lectura', () => {
  it('lo informa y deja las tarjetas en — en vez de afirmar que no hay datos', async () => {
    cleanup()
    stubDataSource({
      obtenerDashboardAdmin: async () => {
        throw new Error('No pudimos conectar con el servidor.')
      },
    })
    renderAppAs('ADMIN', '/admin')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos cargar el tablero. Volvé a intentar en un momento.',
    )
    expect(tarjeta('COMISIONES')).toHaveTextContent('—')
  })
})
