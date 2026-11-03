import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  currentPath,
  renderAppAs,
  resetDataSource,
  stubBackend,
  stubDataSource,
} from '../test/support'

/**
 * Gestión de inscriptos de una comisión (HU 60).
 *
 * **La pantalla no calcula nada de negocio:** el cupo, los inscriptos activos y las vacantes salen
 * de la fuente, y el estado de habilitación también. Los tests lo verifican contra los datos del
 * ejemplo —`CUR-101` con cupo 30 y 23 inscriptos— y contra una fuente que falla, para que la
 * pantalla no invente filas cuando la consulta no llega.
 */

const RUTA_COMISION = '/admin/cursos/CUR-101/comisiones/1'
const RUTA_COMISION_VACIA = '/admin/cursos/CUR-108/comisiones/3'

async function abrir(ruta) {
  resetDataSource()
  stubBackend()
  renderAppAs('ADMIN', ruta)
}

/** El texto del contador del encabezado: rótulo y valor viven en el mismo `div`. */
function contador(etiqueta) {
  return screen.getByText(etiqueta).parentElement.textContent
}

function filaDe(nombre) {
  const elemento = typeof nombre === 'string' ? screen.getByText(nombre) : nombre
  return elemento.closest('tr')
}

describe('apertura de la comisión desde el listado', () => {
  it('abre la comisión al hacer click en la fila', async () => {
    await abrir('/admin/cursos/CUR-101')
    const user = userEvent.setup()

    const fila = (await screen.findByText('CUR-101', { selector: 'span' })).closest('tr')
    await user.click(fila)

    await waitFor(() => expect(currentPath()).toBe('/admin/cursos/CUR-101/comisiones/1'))
  })

  it('abre la comisión con Enter desde el teclado', async () => {
    await abrir('/admin/cursos/CUR-101')
    const user = userEvent.setup()

    const fila = await screen.findByLabelText('Abrir comisión CUR-101')
    fila.focus()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(currentPath()).toBe('/admin/cursos/CUR-101/comisiones/1'))
  })

  it('mantiene Editar como acción independiente de la navegación', async () => {
    await abrir('/admin/cursos/CUR-101')
    const user = userEvent.setup()

    const fila = await screen.findByLabelText('Abrir comisión CUR-101')
    await user.click(within(fila).getByRole('button', { name: 'Editar' }))

    expect(await screen.findByRole('dialog', { name: 'Editar Comisión' })).toBeInTheDocument()
    expect(currentPath()).toBe('/admin/cursos/CUR-101')
  })
})

describe('listado de inscriptos de la comisión', () => {
  it('muestra el curso, la comisión, el cupo, los activos y las vacantes', async () => {
    await abrir(RUTA_COMISION)

    expect(await screen.findByText('Comisión CUR-101')).toBeInTheDocument()
    expect(screen.getByText('Python Inicial')).toBeInTheDocument()
    expect(contador('Cupo máximo')).toContain('30')
    expect(contador('Inscriptos activos')).toContain('23')
    expect(contador('Vacantes')).toContain('7')
  })

  it('muestra alumno, DNI, categoría y habilitación derivada', async () => {
    await abrir(RUTA_COMISION)

    const juan = filaDe(await screen.findByText('Juan Ignacio Pérez'))
    expect(juan).toHaveTextContent('38.456.789')
    expect(juan).toHaveTextContent('Particular')
    expect(juan).toHaveTextContent('HABILITADO')

    const agustina = filaDe(screen.getByText('Agustina Benítez'))
    expect(agustina).toHaveTextContent('Becado parcial 50%')
    expect(agustina).toHaveTextContent('BLOQUEADO')
    expect(agustina).toHaveTextContent('comprobante ilegible')
  })

  it('dice que la comisión no tiene inscriptos sin inventar filas', async () => {
    await abrir(RUTA_COMISION_VACIA)

    expect(await screen.findByText(/Esta comisión todavía no tiene inscriptos/)).toBeInTheDocument()
    expect(contador('Inscriptos activos')).toContain('0')
    expect(contador('Vacantes')).toContain('30')
  })

  it('muestra el motivo cuando la comisión no existe', async () => {
    await abrir('/admin/cursos/CUR-101/comisiones/999999')

    expect(await screen.findByText('Comisión no encontrada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver a las comisiones' })).toBeInTheDocument()
  })

  it('muestra el error de la fuente sin filas inventadas', async () => {
    resetDataSource()
    stubBackend()
    stubDataSource({
      listarInscripcionesDeComision: async () => {
        throw new Error('No pudimos conectar con el servidor.')
      },
    })
    renderAppAs('ADMIN', RUTA_COMISION)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con el servidor.',
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('inscripción desde la comisión', () => {
  it('abre el formulario con la comisión elegida y bloqueada y actualiza las vacantes', async () => {
    await abrir(RUTA_COMISION)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Inscribir alumno' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Inscribir Alumno' })

    const comision = within(dialogo).getByLabelText(/^Comisión/)
    expect(comision).toHaveValue('1')
    expect(comision).toBeDisabled()

    await user.selectOptions(
      within(dialogo).getByLabelText(/^Alumno/),
      within(dialogo).getByRole('option', { name: 'Camila Rodríguez' }),
    )
    await user.click(within(dialogo).getByRole('button', { name: 'Inscribir' }))

    expect(
      await screen.findByText('Alumno inscripto. La vacante quedó actualizada.'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Camila Rodríguez')).toBeInTheDocument()
    expect(contador('Inscriptos activos')).toContain('24')
    expect(contador('Vacantes')).toContain('6')
  })

  it('muestra el rechazo de la fuente y deja el formulario abierto', async () => {
    resetDataSource()
    stubBackend()
    stubDataSource({
      crearInscripcion: async () => {
        throw new Error('El alumno ya está inscripto en esa comisión.')
      },
    })
    renderAppAs('ADMIN', RUTA_COMISION)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Inscribir alumno' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Inscribir Alumno' })
    await user.selectOptions(
      within(dialogo).getByLabelText(/^Alumno/),
      within(dialogo).getByRole('option', { name: 'Camila Rodríguez' }),
    )
    await user.click(within(dialogo).getByRole('button', { name: 'Inscribir' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
      'El alumno ya está inscripto en esa comisión.',
    )
    expect(screen.getByRole('dialog', { name: 'Inscribir Alumno' })).toBeInTheDocument()
  })
})

describe('categoría y baja de una inscripción', () => {
  it('cambia la categoría de esa inscripción y actualiza el listado', async () => {
    await abrir(RUTA_COMISION)
    const user = userEvent.setup()

    const juan = filaDe(await screen.findByText('Juan Ignacio Pérez'))
    await user.click(within(juan).getByRole('button', { name: 'Cambiar categoría' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Asignar categoría' })
    expect(within(dialogo).getByLabelText('Categoría')).toHaveValue('PARTICULAR')
    await user.selectOptions(within(dialogo).getByLabelText('Categoría'), 'BECADO_TOTAL')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Categoría actualizada.')).toBeInTheDocument()
    expect(filaDe(screen.getByText('Juan Ignacio Pérez'))).toHaveTextContent('Becado total')
  })

  it('pide confirmación, da de baja solo esa inscripción y libera la vacante', async () => {
    await abrir(RUTA_COMISION)
    const user = userEvent.setup()

    const juan = filaDe(await screen.findByText('Juan Ignacio Pérez'))
    await user.click(within(juan).getByRole('button', { name: 'Dar de baja' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Dar de baja la inscripción' })
    expect(dialogo).toHaveTextContent('únicamente la inscripción de Juan Ignacio Pérez')
    expect(dialogo).toHaveTextContent('El alumno sigue en el padrón')

    await user.click(within(dialogo).getByRole('button', { name: 'Dar de baja' }))

    expect(
      await screen.findByText('Inscripción dada de baja. La vacante quedó liberada.'),
    ).toBeInTheDocument()
    expect(filaDe(screen.getByText('Juan Ignacio Pérez'))).toHaveTextContent('BAJA')
    expect(contador('Inscriptos activos')).toContain('22')
    expect(contador('Vacantes')).toContain('8')
    // La otra inscripción de la comisión sigue activa.
    expect(filaDe(screen.getByText('Agustina Benítez'))).toHaveTextContent('BLOQUEADO')
  })

  it('no ofrece dar de baja una inscripción ya dada de baja', async () => {
    await abrir(RUTA_COMISION)
    const user = userEvent.setup()

    const juan = filaDe(await screen.findByText('Juan Ignacio Pérez'))
    await user.click(within(juan).getByRole('button', { name: 'Dar de baja' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Dar de baja la inscripción' })
    await user.click(within(dialogo).getByRole('button', { name: 'Dar de baja' }))

    await screen.findByText('Inscripción dada de baja. La vacante quedó liberada.')
    const historica = filaDe(screen.getByText('Juan Ignacio Pérez'))
    expect(within(historica).queryByRole('button', { name: 'Dar de baja' })).not.toBeInTheDocument()
    expect(
      within(historica).queryByRole('button', { name: 'Cambiar categoría' }),
    ).not.toBeInTheDocument()
  })
})
