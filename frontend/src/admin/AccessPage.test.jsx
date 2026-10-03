import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend } from '../test/support'

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
  'Curso Inscrito',
  'Categoría Arancelaria',
  'Último Pago Imputado',
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
  it('muestra la ficha resumen con sus seis campos', async () => {
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
    expect(screen.getByText('Becado parcial 50%')).toBeInTheDocument()
    expect(screen.getByText('BLOQUEADO')).toBeInTheDocument()
    expect(screen.getByText('comprobante ilegible')).toBeInTheDocument()
  })

  it('muestra el acceso habilitado con su texto de apoyo', async () => {
    const user = userEvent.setup()

    await consultar(user, '38.456.789')
    await screen.findByText('Juan Ignacio Pérez')

    expect(screen.getByText('HABILITADO')).toBeInTheDocument()
    expect(screen.getByText('El alumno cumple con la condición arancelaria.')).toBeInTheDocument()
  })

  it('busca por email institucional', async () => {
    const user = userEvent.setup()

    await consultar(user, 'valerossi@gmail.com')

    expect(await screen.findByText('Valeria Rossi')).toBeInTheDocument()
    expect(screen.getByText('debe saldo')).toBeInTheDocument()
  })

  it('busca una cuenta corporativa por CUIT', async () => {
    const user = userEvent.setup()

    await consultar(user, '30-71665544-9')

    expect(await screen.findByText('Tech Solutions S.A.')).toBeInTheDocument()
    expect(screen.getByText('Contrato corporativo')).toBeInTheDocument()
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
    expect(screen.getByText('HABILITADO')).toBeInTheDocument()
    expect(screen.queryByText(/Bloqueo forzado por/)).not.toBeInTheDocument()
  })

  it('deja el estado forzado a la vista con el usuario y la fecha', async () => {
    const user = userEvent.setup()

    await consultar(user, '38.456.789')
    await screen.findByText('Juan Ignacio Pérez')
    await user.type(screen.getByLabelText(/Motivo/), 'Revisión de comprobante pendiente')
    await user.click(screen.getByRole('button', { name: 'Forzar Bloqueo Manual' }))

    await waitFor(() => expect(screen.getByText('BLOQUEADO')).toBeInTheDocument())
    expect(screen.getByText('Revisión de comprobante pendiente')).toBeInTheDocument()
    expect(
      screen.getByText(/Bloqueo forzado por Secretaria BA el \d{2}\/\d{2}\/\d{4}/),
    ).toBeInTheDocument()
  })

  it('copia solo los correos de los alumnos habilitados de la comisión', async () => {
    const user = userEvent.setup()

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
    await waitFor(() => expect(screen.getByText('BLOQUEADO')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Copiar emails habilitados de CUR-101' }))

    expect(
      await screen.findByText('No hay correos para copiar: CUR-101 no tiene alumnos habilitados.'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Correos copiados')).not.toBeInTheDocument()
  })
})

describe('emisión de certificados', () => {
  it('se muestra deshabilitada y con la etiqueta Próximamente', () => {
    expect(screen.getByRole('button', { name: 'Emitir certificados' })).toBeDisabled()
    expect(screen.getByText('Próximamente')).toBeInTheDocument()
  })
})
