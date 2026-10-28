import { cleanup, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { forzarBloqueoManual } from '../services/dataService'
import {
  renderAppAs,
  resetDataSource,
  stubBackend,
  stubDataSource,
} from '../test/support'

/**
 * `Mis Cursos` (`/alumno/cursos`), la lista de cursadas del alumno (11.2).
 *
 * **La tarjeta es una por inscripción y ni una más.** El tablero de `/alumno` ya no lista nada:
 * acá viven las tarjetas, el banner de acceso con su causa y los estados de carga, vacío y fallo de
 * la lectura. El estado bloqueado se alcanza forzando el bloqueo de la inscripción del ejemplo, que
 * es exactamente lo que hace la secretaría desde `Habilitación de Accesos`: si el shell dibujara una
 * segunda tarjeta de ejemplo, el caso del bloqueo estaría ilustrado con una inscripción que el
 * cliente no tiene.
 *
 * **La pantalla distingue "no lo sé" de "no hay".** Mientras la consulta no resuelve no aparece el
 * mensaje de vacío, y si falla se dice que falló: nunca se afirma que el alumno no tiene cursos
 * antes de que la fuente lo confirme.
 */

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  renderAppAs('ALUMNO', '/alumno/cursos')
  await screen.findByRole('heading', { name: 'Mis Cursos' })
  await screen.findByText('CUR-102')
})

describe('tarjeta del curso inscripto', () => {
  it('muestra el código, el estado, el título, el docente, el horario y la categoría', () => {
    const tarjeta = screen
      .getByRole('heading', { name: 'Desarrollo Web Full Stack' })
      .closest('section')

    expect(within(tarjeta).getByText('CUR-102')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Docente · Lic. Laura Benítez')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Lun y Miér · 18:30 a 21:30')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Becado parcial 50%')).toBeInTheDocument()
  })

  it('muestra el banner de acceso habilitado en verde y el botón de detalle', () => {
    const banner = screen.getByText('Habilitado', { selector: 'p' })

    expect(banner.className).toContain('text-green-800')
    expect(screen.getByRole('link', { name: 'Ver detalle' })).toHaveAttribute(
      'href',
      '/alumno/cursos/CUR-102',
    )
  })

  it('muestra una sola tarjeta, sin inventar una segunda inscripción', () => {
    expect(screen.getAllByRole('link', { name: 'Ver detalle' })).toHaveLength(1)
    expect(screen.queryByText('CUR-101')).not.toBeInTheDocument()
  })

  it('cuenta las cursadas en el rótulo de la sección', () => {
    expect(screen.getByText('1 cursada')).toBeInTheDocument()
  })
})

describe('la tarjeta bloqueada', () => {
  beforeEach(async () => {
    await forzarBloqueoManual({
      alumnoId: 2,
      motivo: 'comprobante ilegible',
      usuario: 'Secretaria BA',
      fechaOperacion: '2026-05-21',
    })

    cleanup()
    renderAppAs('ALUMNO', '/alumno/cursos')
    await screen.findByRole('heading', { name: 'Desarrollo Web Full Stack' })
  })

  it('muestra el banner bloqueado en rojo con la causa', () => {
    const banner = screen.getByText('Bloqueado', { selector: 'p' })

    expect(banner.className).toContain('text-red-800')
    expect(screen.getByText('Causa: comprobante ilegible')).toBeInTheDocument()
  })

  it('ofrece una forma de ir a Mis Pagos', () => {
    expect(screen.getByRole('link', { name: 'Ir a Mis Pagos' })).toHaveAttribute(
      'href',
      '/alumno/pagos',
    )
  })

  it('sigue siendo la misma tarjeta y no una segunda', () => {
    expect(screen.getAllByRole('link', { name: 'Ver detalle' })).toHaveLength(1)
  })
})

describe('alumno sin inscripciones', () => {
  it('muestra el mensaje de vacío', async () => {
    cleanup()
    stubDataSource({ listarInscripcionesAlumno: async () => [] })
    renderAppAs('ALUMNO', '/alumno/cursos')

    expect(
      await screen.findByText('No tenés cursos activos en este período lectivo.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ver detalle' })).not.toBeInTheDocument()
  })
})

describe('alumno esperando la respuesta de la API', () => {
  it('no afirma que el alumno no tiene cursos hasta que la lectura resuelve', async () => {
    cleanup()
    stubDataSource({ listarInscripcionesAlumno: () => new Promise(() => {}) })
    renderAppAs('ALUMNO', '/alumno/cursos')
    await screen.findByRole('heading', { name: 'Mis Cursos' })

    expect(screen.getByText('Cargando tus cursos…')).toBeInTheDocument()
    expect(
      screen.queryByText('No tenés cursos activos en este período lectivo.'),
    ).not.toBeInTheDocument()
  })
})

describe('alumno sin respuesta de la API', () => {
  it('informa que no pudo leer los cursos en vez de afirmar que no tiene', async () => {
    cleanup()
    stubDataSource({
      listarInscripcionesAlumno: async () => {
        throw new Error('No pudimos conectar con el servidor.')
      },
    })
    renderAppAs('ALUMNO', '/alumno/cursos')

    expect(
      await screen.findByText('No pudimos cargar tus cursos. Volvé a intentar en un momento.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('No tenés cursos activos en este período lectivo.'),
    ).not.toBeInTheDocument()
  })
})

describe('una comisión que todavía no tiene docente', () => {
  it('dice a confirmar en lugar de nombrar a una persona inventada', async () => {
    cleanup()
    stubDataSource({
      listarInscripcionesAlumno: async () => [
        {
          codigo: 'CUR-102',
          nombre_curso: 'Desarrollo Web Full Stack',
          docente_nombre: null,
          horario: 'Lun y Miér · 18:30 a 21:30',
          horarios: [{ dia: 'LUN', inicio: '18:30', fin: '21:30' }],
          categoria: 'PARTICULAR',
          porcentaje_beca: null,
          acceso: { estado: 'HABILITADO', causa: null, forzado: false },
        },
      ],
    })
    renderAppAs('ALUMNO', '/alumno/cursos')

    expect(await screen.findByText('Docente · a confirmar')).toBeInTheDocument()
  })
})
