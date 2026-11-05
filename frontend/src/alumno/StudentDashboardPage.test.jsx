import { cleanup, screen, waitFor } from '@testing-library/react'
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
 * Tablero del alumno (H/U 57).
 *
 * `COMPROBANTES ACREDITADOS` deja de ser un `—` y sale de `/alumno/pagos`; `Tu situación de pagos`
 * y `Comprobantes recientes` completan el circuito con las mismas etiquetas de `Mis Pagos`. La
 * agenda sigue siendo una sola línea de tiempo y el acceso conserva el peor estado entre cursadas.
 * Progreso, tareas y asistencia promedio siguen sin existir y no se dibujan.
 */

const SALUDO = `Buen día, ${accountForRole('ALUMNO').nombre}`

const CURSADA = {
  codigo: 'CUR-102-1',
  nombre_curso: 'Desarrollo Web Full Stack',
  docente_nombre: 'Lic. Laura Benítez',
  horario: 'Lun y Mié · 18:30 a 21:30',
  horarios: [{ dia: 'LUN', inicio: '18:30', fin: '21:30' }],
  categoria: 'PARTICULAR',
  porcentaje_beca: null,
  acceso: { estado: 'HABILITADO', causa: null, forzado: false },
}

const PAGO = {
  id: 1,
  fecha: '2026-05-18',
  importe: 45000,
  medio: 'TRANSFERENCIA',
  estado: 'ACREDITADO',
  causa: null,
  pagado_por_tercero: false,
}

const PENDIENTE = {
  id: 7,
  estado: 'PENDIENTE_REVISION',
  fecha_pago: '2026-05-18',
  importe: 45000,
  medio: 'TRANSFERENCIA',
  enviado_at: '2026-05-18T10:00:00Z',
  motivo: null,
}

function tarjeta(rotulo) {
  return screen.getByText(rotulo, { selector: 'p' }).closest('section')
}

function fuente(datos = {}) {
  return {
    listarInscripcionesAlumno: async () => [CURSADA],
    obtenerDetalleInscripcion: async () => ({
      proximos_encuentros: [
        { fecha: '2026-05-25', horario: '18:30-21:30', tema: 'Componentes y props' },
      ],
    }),
    listarPagosAlumno: async () => [PAGO],
    listarComprobantesAlumno: async () => [PENDIENTE],
    ...datos,
  }
}

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  stubDataSource(fuente())
  renderAppAs('ALUMNO', '/alumno')
  await screen.findByRole('heading', { name: SALUDO })
  await waitFor(() => expect(tarjeta('CURSOS EN MARCHA')).toHaveTextContent('1'))
})

describe('encabezado e indicadores', () => {
  it('muestra la fecha real del día', () => {
    expect(
      screen.getByText(
        `${formatFechaLarga()} · Cada paso cuenta. Este es tu espacio para avanzar.`,
      ),
    ).toBeInTheDocument()
  })

  it('deriva CURSOS EN MARCHA de las inscripciones', () => {
    expect(tarjeta('CURSOS EN MARCHA')).toHaveTextContent('1')
    expect(tarjeta('CURSOS EN MARCHA')).toHaveTextContent(
      'CUR-102-1 · Desarrollo Web Full Stack',
    )
  })

  it('muestra COMPROBANTES ACREDITADOS con los pagos reales', () => {
    expect(tarjeta('COMPROBANTES ACREDITADOS')).toHaveTextContent('1')
    expect(tarjeta('COMPROBANTES ACREDITADOS')).toHaveTextContent('$45.000')
  })

  it('deriva PRÓXIMA CLASE del cronograma', () => {
    expect(tarjeta('PRÓXIMA CLASE')).toHaveTextContent('25/05/2026')
    expect(tarjeta('PRÓXIMA CLASE')).toHaveTextContent('Desarrollo Web Full Stack')
  })

  it('muestra el acceso habilitado', () => {
    expect(tarjeta('ACCESO A LA CLASE')).toHaveTextContent('HABILITADO')
  })

  it('no dibuja progreso, tareas ni asistencia promedio', () => {
    expect(screen.queryByText(/Progreso general/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Tareas pendientes/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Mi asistencia/)).not.toBeInTheDocument()
  })
})

describe('situación de pagos y comprobantes', () => {
  it('resume lo acreditado, lo pendiente y lo observado', () => {
    const bloque = screen.getByRole('heading', { name: 'Tu situación de pagos' }).closest('section')

    expect(bloque).toHaveTextContent('$45.000')
    expect(bloque).toHaveTextContent('Pendientes de revisión')
    expect(bloque).toHaveTextContent('1')
    expect(bloque).toHaveTextContent('Observados')
  })

  it('muestra el comprobante reciente con la etiqueta de Mis Pagos', () => {
    const bloque = screen.getByRole('heading', { name: 'Comprobantes recientes' }).closest('section')

    expect(bloque).toHaveTextContent('$45.000')
    expect(bloque).toHaveTextContent('Pago del 18/05/2026')
    expect(bloque).toHaveTextContent('Pendiente de revisión')
  })
})

describe('agenda y avisos', () => {
  it('muestra la clase con horario y tema', () => {
    expect(screen.getByText('25/05/2026 · 18:30-21:30')).toBeInTheDocument()
    expect(screen.getByText('Componentes y props')).toBeInTheDocument()
  })

  it('no marca la campana cuando el acceso y los comprobantes están al día', async () => {
    const user = userEvent.setup()
    const campana = await screen.findByRole('button', { name: 'Notificaciones' })

    expect(campana.querySelector('[data-ui="notificacion-punto"]')).toBeNull()

    await user.click(campana)
    expect(await screen.findByText('No tenés avisos pendientes.')).toBeInTheDocument()
  })

  it('lleva el acceso bloqueado y el comprobante observado a Mis Pagos', async () => {
    cleanup()
    stubDataSource(
      fuente({
        listarInscripcionesAlumno: async () => [
          {
            ...CURSADA,
            acceso: { estado: 'BLOQUEADO', causa: 'pago pendiente', forzado: false },
          },
        ],
        listarComprobantesAlumno: async () => [
          { ...PENDIENTE, estado: 'OBSERVADO', motivo: 'comprobante ilegible' },
        ],
      }),
    )
    renderAppAs('ALUMNO', '/alumno')

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Notificaciones, 2 pendientes' }))

    expect(
      screen.getByRole('link', { name: /Tu acceso está bloqueado/ }),
    ).toHaveAttribute('href', '/alumno/pagos')
    expect(
      screen.getByRole('link', { name: /Tenés un comprobante observado/ }),
    ).toHaveAttribute('href', '/alumno/pagos')
    expect(tarjeta('ACCESO A LA CLASE')).toHaveTextContent('BLOQUEADO')
  })
})

describe('casos vacíos y de error', () => {
  it('sin inscripciones ni pagos muestra ceros reales y los vacíos', async () => {
    cleanup()
    stubDataSource(
      fuente({
        listarInscripcionesAlumno: async () => [],
        listarPagosAlumno: async () => [],
        listarComprobantesAlumno: async () => [],
      }),
    )
    renderAppAs('ALUMNO', '/alumno')

    await screen.findByText('No tenés encuentros programados por ahora.')
    await waitFor(() => expect(tarjeta('CURSOS EN MARCHA')).toHaveTextContent('0'))
    expect(tarjeta('ACCESO A LA CLASE')).toHaveTextContent('—')
    expect(tarjeta('COMPROBANTES ACREDITADOS')).toHaveTextContent('0')
    expect(tarjeta('PRÓXIMA CLASE')).toHaveTextContent('—')
    expect(screen.getByText('Todavía no enviaste comprobantes.')).toBeInTheDocument()
    expect(screen.getByText('$0')).toBeInTheDocument()
  })

  it('si la lectura de cursos falla lo informa y no afirma que no tiene cursos', async () => {
    cleanup()
    stubDataSource({
      listarInscripcionesAlumno: async () => {
        throw new Error('No pudimos conectar con el servidor.')
      },
    })
    renderAppAs('ALUMNO', '/alumno')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos cargar tus cursos. Volvé a intentar en un momento.',
    )
    expect(tarjeta('CURSOS EN MARCHA')).toHaveTextContent('—')
    expect(
      screen.queryByText('No tenés encuentros programados por ahora.'),
    ).not.toBeInTheDocument()
  })
})
