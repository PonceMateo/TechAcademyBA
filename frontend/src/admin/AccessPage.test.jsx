import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend, stubDataSource } from '../test/support'

/**
 * Habilitación de accesos (9.7).
 *
 * El caso que manda es el de Agustina Benítez: es el ejemplo que el cliente usó para pedir que
 * apareciera la causa del bloqueo, así que su ficha, su categoría y su estado se verifican enteros.
 * Y el motivo del forzado se prueba en las dos direcciones: vacío no deja confirmar, con motivo
 * deja el estado forzado a la vista con el usuario y la fecha.
 */

const CAMPOS_FICHA = [
  'DNI / Documento',
  'Nombre Completo',
  'Email Registrado',
]

async function consultar(user, texto) {
  await user.type(screen.getByLabelText('Buscar alumno o cuenta corporativa'), texto)
  await user.click(screen.getByRole('button', { name: 'Consultar Habilitación' }))
}

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  renderAppAs('ADMIN', '/admin/habilitacion')
  await screen.findByRole('heading', { name: 'Buscador de Alumnos y Cuentas Corporativas' })
})

describe('buscador', () => {
  it('muestra la ayuda que promete el spec', () => {
    expect(
      screen.getByText(
        'Buscá por DNI de alumno, Email institucional, CUIT de empresa o Razón Social.',
      ),
    ).toBeInTheDocument()
  })

  it('pide una consulta antes de mostrar ficha o estado', () => {
    expect(screen.getByRole('heading', { name: 'Ficha Resumen del Alumno' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Estado del Acceso' })).toBeInTheDocument()
    expect(screen.getByText(/Todavía no consultaste a nadie/)).toBeInTheDocument()
  })
})

describe('consulta de un alumno', () => {
  it('muestra la ficha resumen con sus tres campos', async () => {
    const user = userEvent.setup()

    await consultar(user, '41.332.114')
    await screen.findByText('Agustina Benítez')

    const ficha = screen
      .getByRole('heading', { name: 'Ficha Resumen del Alumno' })
      .closest('section')

    for (const campo of CAMPOS_FICHA) {
      expect(ficha).toHaveTextContent(campo)
    }
  })

  it('muestra el curso, la categoría y el bloqueo con su causa', async () => {
    const user = userEvent.setup()

    await consultar(user, '41.332.114')
    await screen.findByText('Agustina Benítez')

    expect(screen.getByText('CUR-101 Python Inicial')).toBeInTheDocument()
    expect(screen.getByText(/Becado parcial 50%/)).toBeInTheDocument()
    expect(screen.getByText('BLOQUEADO')).toBeInTheDocument()
    expect(screen.getByText('comprobante ilegible')).toBeInTheDocument()
  })

  it('muestra una sección por inscripción activa', async () => {
    const user = userEvent.setup()

    await consultar(user, '38.456.789')
    await screen.findByText('Juan Ignacio Pérez')

    // Juan tiene una inscripción particular y otra corporativa, las dos habilitadas (HU 64).
    expect(screen.getByRole('heading', { name: 'CUR-101 Python Inicial' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'CUR-106 Machine Learning Aplicado' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Particular/)).toBeInTheDocument()
    expect(screen.getByText(/Corporativo/)).toBeInTheDocument()
    expect(screen.getAllByText('HABILITADO').length).toBe(2)
    expect(
      screen.getAllByText('El alumno cumple con la condición arancelaria.').length,
    ).toBe(2)
  })

  it('busca por nombre en el padrón', async () => {
    const user = userEvent.setup()

    await consultar(user, 'Valeria Rossi')

    expect(await screen.findByText('Valeria Rossi')).toBeInTheDocument()
    expect(screen.getByText('debe saldo')).toBeInTheDocument()
  })

  it('busca por email en el padrón', async () => {
    const user = userEvent.setup()

    await consultar(user, 'valerossi@gmail.com')

    expect(await screen.findByText('Valeria Rossi')).toBeInTheDocument()
  })

  it('avisa cuando el alumno no tiene inscripciones activas', async () => {
    const user = userEvent.setup()

    // Nicolás Castro tiene una cursada terminada: no hay sección de acceso que mostrar.
    await consultar(user, 'nicocastro_uy@gmail.com')

    expect(await screen.findByText('Nicolás Castro')).toBeInTheDocument()
    expect(
      screen.getByText(/no tiene inscripciones activas/),
    ).toBeInTheDocument()
    expect(screen.queryByText('CUR-106 Machine Learning Aplicado')).not.toBeInTheDocument()
  })

  it('busca una cuenta corporativa por CUIT', async () => {
    const user = userEvent.setup()

    await consultar(user, '30-71665544-9')

    expect(await screen.findByText('Tech Solutions S.A.')).toBeInTheDocument()
    expect(screen.getByText('30-71665544-9')).toBeInTheDocument()
  })
})

describe('acciones excepcionales', () => {
  it('no deja forzar el bloqueo con el motivo vacío', async () => {
    const user = userEvent.setup()

    await consultar(user, '38.456.789')
    await screen.findByText('Juan Ignacio Pérez')
    await user.click(screen.getByRole('button', { name: 'Forzar Bloqueo Manual' }))

    expect(await screen.findByText('El motivo es obligatorio.')).toBeInTheDocument()
    // No cambió el estado: sigue habilitado y sin registro de forzado.
    expect(screen.getAllByText('HABILITADO').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Bloqueo forzado por/)).not.toBeInTheDocument()
  })

  it('deja el estado forzado a la vista con el usuario y la fecha', async () => {
    const user = userEvent.setup()

    await consultar(user, '38.456.789')
    await screen.findByText('Juan Ignacio Pérez')
    await user.type(screen.getByLabelText(/Motivo/), 'Revisión de comprobante pendiente')
    await user.click(screen.getByRole('button', { name: 'Forzar Bloqueo Manual' }))

    await waitFor(() => expect(screen.getAllByText('BLOQUEADO').length).toBeGreaterThan(0))
    expect(
      screen.getAllByText('Revisión de comprobante pendiente').length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/Bloqueo forzado por Secretaria BA el \d{2}\/\d{2}\/\d{4}/)
        .length,
    ).toBeGreaterThan(0)
  })

  it('copia solo los correos de los alumnos habilitados de la comisión', async () => {
    const user = userEvent.setup()

    await user.selectOptions(await screen.findByLabelText('Comisión'), 'CUR-101')
    await user.click(screen.getByRole('button', { name: 'Copiar emails habilitados de CUR-101' }))

    const copiados = await screen.findByLabelText('Correos copiados')
    expect(copiados).toHaveTextContent('juan.perez@gmail.com')
    // Agustina Benítez está en CUR-101 pero bloqueada: su correo no va en la lista.
    expect(copiados).not.toHaveTextContent('agus.benitez@gmail.com')
  })

  it('informa que no hay correos para copiar cuando la comisión no tiene habilitados', async () => {
    const user = userEvent.setup()

    // CUR-101 tiene a Juan Ignacio Pérez (habilitado) y a Agustina Benítez (bloqueada). Bloqueando
    // al primero por la vía del forzado manual, la comisión se queda sin nadie habilitado: ese es
    // el caso en el que la acción tiene que informar en lugar de copiar una lista vacía.
    await consultar(user, '38.456.789')
    await screen.findByText('Juan Ignacio Pérez')
    await user.type(screen.getByLabelText(/Motivo/), 'Revisión de comprobante pendiente')
    await user.click(screen.getByRole('button', { name: 'Forzar Bloqueo Manual' }))
    await waitFor(() => expect(screen.getAllByText('BLOQUEADO').length).toBeGreaterThan(0))

    await user.selectOptions(await screen.findByLabelText('Comisión'), 'CUR-101')
    await user.click(screen.getByRole('button', { name: 'Copiar emails habilitados de CUR-101' }))

    expect(
      await screen.findByText('No hay correos para copiar: CUR-101 no tiene alumnos habilitados.'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Correos copiados')).not.toBeInTheDocument()
  })

  it('no pinta el selector ni la acción de copia mientras el catálogo no resuelve', async () => {
    cleanup()
    stubDataSource({ listarComisiones: () => new Promise(() => {}) })
    renderAppAs('ADMIN', '/admin/habilitacion')
    await screen.findByRole('heading', { name: 'Buscador de Alumnos y Cuentas Corporativas' })

    expect(screen.queryByLabelText('Comisión')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Copiar emails habilitados/ }),
    ).not.toBeInTheDocument()
    // Lo que no depende del catálogo sí se pinta.
    expect(screen.getByRole('button', { name: 'Forzar Bloqueo Manual' })).toBeInTheDocument()
  })

  it('no inventa una comisión cuando el catálogo rechaza', async () => {
    cleanup()
    stubDataSource({
      listarComisiones: async () => {
        throw new Error('No pudimos conectar con el servidor.')
      },
    })
    renderAppAs('ADMIN', '/admin/habilitacion')
    await screen.findByRole('heading', { name: 'Buscador de Alumnos y Cuentas Corporativas' })

    // El selector queda sin comisiones y la acción de copia nunca aparece.
    await screen.findByLabelText('Comisión')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.queryByRole('option', { name: 'CUR-101' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Copiar emails habilitados/ }),
    ).not.toBeInTheDocument()
  })
})

describe('emisión de certificados', () => {
  it('se muestra deshabilitada y con la etiqueta Próximamente', () => {
    expect(screen.getByRole('button', { name: 'Emitir certificados' })).toBeDisabled()
    expect(screen.getByText('Próximamente')).toBeInTheDocument()
  })
})

describe('consulta que no resuelve', () => {
  it('avisa cuando la búsqueda falla y no deja una ficha a medias', async () => {
    cleanup()
    stubDataSource({
      buscarAlumnos: async () => {
        throw new Error('No pudimos conectar con el servidor.')
      },
    })
    renderAppAs('ADMIN', '/admin/habilitacion')
    await screen.findByRole('heading', { name: 'Buscador de Alumnos y Cuentas Corporativas' })

    const user = userEvent.setup()
    await consultar(user, '38.456.789')

    expect(await screen.findByText('No pudimos conectar con el servidor.')).toBeInTheDocument()
    expect(screen.getByText(/Todavía no consultaste a nadie/)).toBeInTheDocument()
  })
})
