import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { forzarBloqueoManual } from '../services/dataService'
import {
  accountForRole,
  renderAppAs,
  resetDataSource,
  stubBackend,
  stubDataSource,
} from '../test/support'
import { formatFechaLarga } from '../utils/formato'

/**
 * Dashboard del alumno (11.2).
 *
 * **La raíz del shell es el tablero y no lista cursadas.** Los cuatro indicadores y `Tu agenda`
 * viven en `/alumno`; las tarjetas de las inscripciones son `Mis Cursos` (`/alumno/cursos`) y se
 * prueban en su propio archivo. Por eso acá se afirma, además de los indicadores, que el tablero
 * **no** ofrece `Ver detalle`.
 *
 * **El tablero conserva su forma.** Las cuatro tarjetas y `Tu agenda` se pintan siempre; donde la
 * fuente no puede responder el valor es `—`, y `CURSOS EN MARCHA` muestra un `0` real cuando la
 * lectura resuelve sin inscripciones (D43).
 *
 * **Los indicadores salen de los datos reales**: `CURSOS EN MARCHA` de las inscripciones y
 * `PRÓXIMA CLASE` del cronograma. La fecha del encabezado se afirma a través de `formatFechaLarga()`
 * —el formato queda clavado en `formato.test.js`— y nunca con un literal.
 *
 * **La agenda trae la hora de cada encuentro** y el tema solo cuando está cargado: un encuentro sin
 * clase no lleva texto de tema y la pantalla no completa ninguno en su lugar.
 */

/** El tablero abre con el saludo de la cuenta de la sesión. */
const SALUDO = `Buen día, ${accountForRole('ALUMNO').nombre}`
const RESUMEN = `${formatFechaLarga()} · Cada paso cuenta. Este es tu espacio para avanzar.`

/** La tarjeta de un indicador: el rótulo es un `<p>` y su contenedor es el `<section>` de `Card`. */
function tarjeta(rotulo) {
  return screen.getByText(rotulo, { selector: 'p' }).parentElement
}

function agenda() {
  return within(screen.getByRole('heading', { name: 'Tu agenda' }).closest('section'))
}

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  renderAppAs('ALUMNO', '/alumno')
  await screen.findByRole('heading', { name: SALUDO })
  // El tablero no lista cursadas: el código aparece en el texto de apoyo del indicador.
  await waitFor(() => expect(tarjeta('CURSOS EN MARCHA')).toHaveTextContent('CUR-102'))
})

describe('encabezado', () => {
  it('muestra la fecha real del día', () => {
    expect(screen.getByText(RESUMEN)).toBeInTheDocument()
  })
})

describe('indicadores derivados de los datos reales', () => {
  it('deriva CURSOS EN MARCHA de las inscripciones', () => {
    expect(tarjeta('CURSOS EN MARCHA')).toHaveTextContent('1')
    expect(tarjeta('CURSOS EN MARCHA')).toHaveTextContent('CUR-102 · Desarrollo Web Full Stack')
  })

  it('deriva PRÓXIMA CLASE del cronograma real', () => {
    expect(tarjeta('PRÓXIMA CLASE')).toHaveTextContent('25/05/2026')
    expect(tarjeta('PRÓXIMA CLASE')).toHaveTextContent('Desarrollo Web Full Stack')
  })

  it('refleja el estado real de la inscripción en ACCESO A LA CLASE', () => {
    expect(tarjeta('ACCESO A LA CLASE')).toHaveTextContent('HABILITADO')
  })

  it('muestra COMPROBANTES ACREDITADOS con —, porque ninguna fuente respalda su valor', () => {
    expect(tarjeta('COMPROBANTES ACREDITADOS')).toHaveTextContent('—')
  })
})

describe('el tablero no es la lista de cursadas', () => {
  it('no ofrece Ver detalle: esa tarjeta vive en Mis Cursos', () => {
    expect(screen.queryByRole('link', { name: 'Ver detalle' })).not.toBeInTheDocument()
  })

  it('muestra el acceso bloqueado con su causa en el indicador', async () => {
    await forzarBloqueoManual({
      alumnoId: 2,
      motivo: 'comprobante ilegible',
      usuario: 'Secretaria BA',
      fechaOperacion: '2026-05-21',
    })

    cleanup()
    renderAppAs('ALUMNO', '/alumno')
    await screen.findByRole('heading', { name: SALUDO })
    await waitFor(() => expect(tarjeta('ACCESO A LA CLASE')).toHaveTextContent('BLOQUEADO'))
    // Sin la tarjeta de la cursada, la causa aparece una sola vez: la del indicador.
    expect(screen.getAllByText(/Causa: comprobante ilegible/)).toHaveLength(1)
  })
})

describe('la agenda', () => {
  it('muestra la fecha con el horario del día y el tema cargado', async () => {
    const encuentro = agenda().getByText(/25\/05\/2026/)

    expect(encuentro).toHaveTextContent('25/05/2026 · 18:30-21:30')
    expect(agenda().getByText('Componentes y props')).toBeInTheDocument()
  })

  it('muestra el horario de un encuentro sin tema y nunca un tema inventado', async () => {
    cleanup()
    stubDataSource({
      obtenerDetalleInscripcion: async () => ({
        proximos_encuentros: [{ fecha: '2026-05-25', horario: '18:30-21:30', tema: null }],
      }),
    })
    renderAppAs('ALUMNO', '/alumno')
    await screen.findByRole('heading', { name: SALUDO })

    expect(await agenda().findByText('25/05/2026 · 18:30-21:30')).toBeInTheDocument()
    expect(agenda().queryByText(/tema/i)).not.toBeInTheDocument()
  })
})

/** Una cursada para los tests de más de una inscripción: la API devuelve una lista, no una fila. */
function cursada(codigo, nombreCurso) {
  return {
    codigo,
    nombre_curso: nombreCurso,
    docente_nombre: 'Lic. Laura Benítez',
    horario: 'Lun y Miér · 18:30 a 21:30',
    horarios: [{ dia: 'LUN', inicio: '18:30', fin: '21:30' }],
    categoria: 'PARTICULAR',
    porcentaje_beca: null,
    acceso: { estado: 'HABILITADO', causa: null, forzado: false },
  }
}

describe('varias cursadas al mismo tiempo', () => {
  it('ordena la agenda por fecha y toma la clase más cercana de todas', async () => {
    cleanup()
    stubDataSource({
      listarInscripcionesAlumno: async () => [
        cursada('CUR-200', 'Curso A'),
        cursada('CUR-100', 'Curso B'),
      ],
      obtenerDetalleInscripcion: async (codigo) => ({
        proximos_encuentros:
          codigo === 'CUR-200'
            ? [{ fecha: '2026-05-30', horario: '10:00-12:00', tema: null }]
            : [{ fecha: '2026-05-25', horario: '18:30-21:30', tema: null }],
      }),
    })
    renderAppAs('ALUMNO', '/alumno')
    await waitFor(() => expect(tarjeta('PRÓXIMA CLASE')).toHaveTextContent('25/05/2026'))

    // La agenda es una sola línea de tiempo: no sale la fecha del primer curso si es más lejana.
    const filas = agenda().getAllByText(/\d{2}\/\d{2}\/\d{4}/).map((nodo) => nodo.textContent)
    expect(filas).toEqual(['25/05/2026 · 18:30-21:30', '30/05/2026 · 10:00-12:00'])
    expect(tarjeta('PRÓXIMA CLASE')).toHaveTextContent('Curso B')
  })

  it('conserva la agenda de las demás cursadas cuando el detalle de una falla', async () => {
    cleanup()
    stubDataSource({
      listarInscripcionesAlumno: async () => [
        cursada('CUR-ROTO', 'Curso roto'),
        cursada('CUR-100', 'Curso B'),
      ],
      obtenerDetalleInscripcion: async (codigo) => {
        if (codigo === 'CUR-ROTO') {
          throw new Error('No pudimos conectar con el servidor.')
        }
        return {
          proximos_encuentros: [{ fecha: '2026-05-25', horario: '18:30-21:30', tema: null }],
        }
      },
    })
    renderAppAs('ALUMNO', '/alumno')
    await waitFor(() => expect(tarjeta('PRÓXIMA CLASE')).toHaveTextContent('25/05/2026'))

    expect(agenda().getAllByText(/\d{2}\/\d{2}\/\d{4}/)).toHaveLength(1)
    // El fallo fue de un detalle, no de la lectura de inscripciones: los indicadores siguen bien.
    expect(tarjeta('CURSOS EN MARCHA')).toHaveTextContent('2')
    expect(
      screen.queryByText('No pudimos cargar tus cursos. Volvé a intentar en un momento.'),
    ).not.toBeInTheDocument()
  })

  it('muestra el estado bloqueado aunque la primera inscripción esté habilitada', async () => {
    const habilitada = cursada('CUR-100', 'Curso habilitado')
    const bloqueada = {
      ...cursada('CUR-200', 'Curso bloqueado'),
      acceso: { estado: 'BLOQUEADO', causa: 'pago pendiente', forzado: false },
    }

    cleanup()
    stubDataSource({
      listarInscripcionesAlumno: async () => [habilitada, bloqueada],
    })
    renderAppAs('ALUMNO', '/alumno')
    await waitFor(() => expect(tarjeta('ACCESO A LA CLASE')).toHaveTextContent('BLOQUEADO'))

    // El orden de la respuesta lo decide la base: el indicador refleja el peor estado, no el primero.
    expect(tarjeta('ACCESO A LA CLASE')).toHaveTextContent('Causa: pago pendiente')
  })
})

describe('alumno sin inscripciones', () => {
  it('muestra CURSOS EN MARCHA con un 0 real y el resto con —', async () => {
    cleanup()
    stubDataSource({ listarInscripcionesAlumno: async () => [] })
    renderAppAs('ALUMNO', '/alumno')

    // La lectura resuelve sin inscripciones: `CURSOS EN MARCHA` pasa de `—` a un `0` real.
    await waitFor(() => expect(tarjeta('CURSOS EN MARCHA')).toHaveTextContent('0'))
    expect(tarjeta('CURSOS EN MARCHA')).not.toHaveTextContent('—')
    expect(tarjeta('ACCESO A LA CLASE')).toHaveTextContent('—')
    expect(tarjeta('PRÓXIMA CLASE')).toHaveTextContent('—')
    expect(tarjeta('COMPROBANTES ACREDITADOS')).toHaveTextContent('—')
    expect(screen.getByText('No tenés encuentros programados por ahora.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ver detalle' })).not.toBeInTheDocument()
  })
})

describe('alumno esperando la respuesta de la API', () => {
  it('pinta el tablero con — y nunca un 0 mientras la lectura no resuelve', async () => {
    cleanup()
    stubDataSource({ listarInscripcionesAlumno: () => new Promise(() => {}) })
    renderAppAs('ALUMNO', '/alumno')
    await screen.findByRole('heading', { name: SALUDO })

    for (const rotulo of ['CURSOS EN MARCHA', 'ACCESO A LA CLASE', 'PRÓXIMA CLASE']) {
      expect(tarjeta(rotulo)).toHaveTextContent('—')
      expect(tarjeta(rotulo)).not.toHaveTextContent('0')
    }
    expect(tarjeta('COMPROBANTES ACREDITADOS')).toHaveTextContent('—')
    expect(screen.getByText('No tenés encuentros programados por ahora.')).toBeInTheDocument()
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
    renderAppAs('ALUMNO', '/alumno')

    expect(
      await screen.findByText('No pudimos cargar tus cursos. Volvé a intentar en un momento.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('No tenés encuentros programados por ahora.'),
    ).not.toBeInTheDocument()
    expect(tarjeta('CURSOS EN MARCHA')).toHaveTextContent('—')
  })
})
