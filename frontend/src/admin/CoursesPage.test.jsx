import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend, stubDataSource } from '../test/support'

/**
 * Cursos y comisiones (9.3).
 *
 * Las columnas se comparan contra la lista completa y en orden, porque el spec las fija literales
 * y en ese orden. Y la regla de la `Sede` se prueba en las dos direcciones: presencial sin sede no
 * guarda, virtual sin sede sí, que es lo que evita que la validación se convierta en un veto
 * generalizado que nadie entiende.
 *
 * **El rechazo lo produce la fuente, no la pantalla.** Los tests del rechazo reemplazan
 * `crearCurso` o `crearComision` por una función que falla con el mensaje del backend, y
 * verifican dos cosas: que el motivo se muestre tal cual y que el modal **no** se cierre. Cerrar
 * el modal como si se hubiera guardado es la forma más fácil de que la secretaría se vaya
 * creyendo que el sistema guarda (D36).
 */

const COLUMNAS = [
  'CÓDIGO',
  'CURSO / PROGRAMA',
  'DOCENTE',
  'HORARIO',
  'CUPO MÁX.',
  'VACANTES',
  'ARANCEL',
]

async function abrir() {
  resetDataSource()
  stubBackend()
  renderAppAs('ADMIN', '/admin/cursos')
  await screen.findByRole('heading', { name: 'Comisiones Activas' })
  await screen.findByText('CUR-101')
}

async function abrirModal(user) {
  await user.click(screen.getByRole('button', { name: '+ Nueva Comisión' }))
  await screen.findByRole('dialog', { name: 'Crear Nueva Comisión' })
}

/**
 * Completa lo que el alta de comisión exige.
 *
 * El curso se elige por **nombre** y no por valor: el `value` de la opción es el identificador,
 * que el ejemplo asigna por orden de aparición. Un test que escribiera `1` acá pasaría hoy y
 * mañana significaría otra cosa.
 */
async function completarComision(user, { modalidad = 'VIRTUAL', sede = null } = {}) {
  await user.selectOptions(screen.getByLabelText(/^Modalidad/), modalidad)
  const cursos = screen.getByLabelText(/^Curso \/ Programa/)
  await user.selectOptions(cursos, within(cursos).getByRole('option', { name: 'Python Inicial' }))
  await user.selectOptions(screen.getByLabelText(/^Docente Asignado/), '1')
  await user.type(screen.getByLabelText(/Días y Horarios/), 'Mar y Jue 19 a 21 hs')
  await user.type(screen.getByLabelText(/Cupo Máximo/), '20')
  await user.type(screen.getByLabelText(/Valor de Arancel de Comisión/), '52000')
  if (sede) {
    await user.selectOptions(screen.getByLabelText(/^Sede/), sede)
  }
}

beforeEach(async () => {
  await abrir()
})

describe('listado de comisiones', () => {
  it('muestra el chip del catálogo y las dos acciones de alta', () => {
    expect(screen.getByText('10 en el catálogo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Nueva Comisión' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Nuevo Curso' })).toBeInTheDocument()
  })

  it('muestra las columnas en el orden que fija el spec', async () => {
    const encabezados = screen.getAllByRole('columnheader').map((th) => th.textContent)

    expect(encabezados).toEqual(COLUMNAS)
  })

  it('muestra las cinco comisiones del maquetado con su arancel formateado', async () => {
    const tabla = screen.getByRole('table')
    const filas = within(tabla).getAllByRole('row').slice(1)

    expect(filas.map((fila) => fila.cells[0].textContent)).toEqual([
      'CUR-101',
      'CUR-104',
      'CUR-108',
      'CUR-110',
      'CUR-103',
    ])
    expect(within(tabla).getByText('$45.000')).toBeInTheDocument()
    expect(within(tabla).getByText('$52.000')).toBeInTheDocument()
  })

  it('marca la comisión sin vacantes con el chip LLENO en rojo', async () => {
    const tabla = screen.getByRole('table')
    const filaLlena = within(tabla)
      .getAllByRole('row')
      .find((fila) => fila.cells[0].textContent === 'CUR-104')

    const chip = within(filaLlena).getByText('LLENO')
    expect(chip.className).toContain('text-red-800')
  })

  it('deja las otras comisiones con sus vacantes y sin chip', async () => {
    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    const vacantesDe = (codigo) =>
      filas.find((fila) => fila.cells[0].textContent === codigo).cells[5]

    // `VACANTES` es la sexta columna: el chip `LLENO` va dentro de la celda, al lado del 0.
    expect(vacantesDe('CUR-101').textContent).toBe('7')
    expect(vacantesDe('CUR-108').textContent).toBe('30')
    expect(vacantesDe('CUR-110').textContent).toBe('40')
    expect(vacantesDe('CUR-103').textContent).toBe('40')
    expect(within(screen.getByRole('table')).getAllByText('LLENO')).toHaveLength(1)
  })

  it('no ofrece ningún control de edición de comisión', () => {
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /modificar/i })).not.toBeInTheDocument()
  })
})

describe('modal de alta', () => {
  it('abre con los campos en el orden del spec y los dos botones', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    const etiquetas = screen
      .getAllByText(
        /^(Curso \/ Programa|Docente Asignado|Días y Horarios|Cupo Máximo|Valor de Arancel de Comisión \(AR\$\)|Modalidad|Sede)\*?$/,
      )
      // El asterisco marca los campos obligatorios y va `aria-hidden`, así que el rótulo del
      // spec es el texto sin él.
      .map((elemento) => elemento.textContent.replace('*', ''))

    expect(etiquetas).toEqual([
      'Curso / Programa',
      'Docente Asignado',
      'Días y Horarios',
      'Cupo Máximo',
      'Valor de Arancel de Comisión (AR$)',
      'Modalidad',
      'Sede',
    ])

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar Comisión' })).toBeInTheDocument()
  })

  it('no pide el código de la comisión, porque el sistema lo genera', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    expect(screen.queryByLabelText(/Código Comisión/)).not.toBeInTheDocument()
    expect(screen.getByText(/El código de la comisión/)).toBeInTheDocument()
  })

  it('muestra los placeholders del prototipo', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    expect(screen.getByPlaceholderText('Ej: Mar y Jue 19 a 21 hs')).toBeInTheDocument()
  })

  it('ofrece las tres modalidades del dominio', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    const opciones = within(screen.getByLabelText(/^Modalidad/))
      .getAllByRole('option')
      .map((opcion) => opcion.textContent)

    expect(opciones).toEqual(['Seleccionar…', 'Virtual', 'Presencial', 'Híbrido'])
  })

  it('no deja guardar una modalidad presencial sin sede', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await completarComision(user, { modalidad: 'PRESENCIAL' })
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    expect(
      await screen.findByText('El campo Sede es obligatorio para modalidad Presencial o Híbrido.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Crear Nueva Comisión' })).toBeInTheDocument()
  })

  it('tampoco deja guardar una modalidad híbrida sin sede', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await completarComision(user, { modalidad: 'HIBRIDO' })
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    expect(
      await screen.findByText('El campo Sede es obligatorio para modalidad Presencial o Híbrido.'),
    ).toBeInTheDocument()
  })

  it('guarda una modalidad virtual sin sede y muestra el código derivado', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await completarComision(user, { modalidad: 'VIRTUAL' })
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Crear Nueva Comisión' })).not.toBeInTheDocument(),
    )
    // El código lo compone el sistema con el del curso y el número de la comisión nueva (D34):
    // `CUR-101` es el curso del ejemplo y `-2` porque es la segunda comisión de ese curso, la
    // primera es la fila `CUR-101` del maqueteado.
    //
    // El prefijo `CUR-101` y no `CUR001` es un resto del ejemplo del cliente —D32 descarta sus
    // códigos cuando se migre el Excel—, pero la forma del código derivado es la misma.
    expect(await screen.findByText('Comisión CUR-101-2 creada.')).toBeInTheDocument()
  })

  it('manda el identificador del curso y no su código', async () => {
    // El ejemplo aceptaba el código donde la base exige un entero, así que el contrato roto no se
    // veía en ningún test: la pantalla mandaba `CUR-101` y el backend respondía 422. Este test
    // mira el payload, que es lo que viaja.
    const crear = vi.fn(async () => ({
      id: 99,
      codigo: 'CUR-101-2',
      curso: { codigo: 'CUR-101', nombre: 'Python Inicial' },
      docente_id: 1,
      docente_nombre: 'Profe Martín',
      dias_horarios: 'Mar y Jue 19 a 21 hs',
      cupo_maximo: 20,
      arancel: 52000,
      vacantes: 20,
      modalidad: 'VIRTUAL',
      sede_id: null,
      sede_nombre: null,
    }))
    stubDataSource({ crearComision: crear })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '+ Nueva Comisión' }))
    await screen.findByRole('dialog', { name: 'Crear Nueva Comisión' })
    await completarComision(user, { modalidad: 'VIRTUAL' })
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1))
    expect(crear.mock.calls[0][0]).toEqual({
      curso_id: 1,
      docente_id: 1,
      dias_horarios: 'Mar y Jue 19 a 21 hs',
      arancel: 52000,
      cupo_maximo: 20,
      modalidad: 'VIRTUAL',
      sede_id: null,
    })
  })

  it('exige el docente de la comisión', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await user.selectOptions(screen.getByLabelText(/^Modalidad/), 'VIRTUAL')
    const cursos = screen.getByLabelText(/^Curso \/ Programa/)
    await user.selectOptions(cursos, within(cursos).getByRole('option', { name: 'Python Inicial' }))
    await user.type(screen.getByLabelText(/Días y Horarios/), 'Mar y Jue 19 a 21 hs')
    await user.type(screen.getByLabelText(/Cupo Máximo/), '20')
    await user.type(screen.getByLabelText(/Valor de Arancel de Comisión/), '52000')
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    expect(await screen.findByText('Elegí el docente de la comisión.')).toBeInTheDocument()
  })

  it('exige un cupo y un arancel positivos', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await user.selectOptions(screen.getByLabelText(/^Modalidad/), 'VIRTUAL')
    const cursos = screen.getByLabelText(/^Curso \/ Programa/)
    await user.selectOptions(cursos, within(cursos).getByRole('option', { name: 'Python Inicial' }))
    await user.selectOptions(screen.getByLabelText(/^Docente Asignado/), '1')
    await user.type(screen.getByLabelText(/Días y Horarios/), 'Mar y Jue 19 a 21 hs')
    await user.type(screen.getByLabelText(/Cupo Máximo/), '0')
    await user.type(screen.getByLabelText(/Valor de Arancel de Comisión/), '0')
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    expect(await screen.findByText('El cupo debe ser un entero positivo.')).toBeInTheDocument()
    expect(await screen.findByText('El arancel debe ser un valor positivo.')).toBeInTheDocument()
  })

  it('deja el formulario abierto y muestra el motivo cuando la fuente rechaza el alta', async () => {
    // El rechazo lo produce la fuente, no la pantalla: se reemplaza `crearComision` por una que
    // falla con el mensaje que devuelve el backend, y se verifica que la pantalla lo muestre sin
    // cerrar el modal ni confirmar el alta (D36).
    stubDataSource({
      crearComision: vi.fn(async () => {
        throw new Error('Ya hay una comisión para ese curso.')
      }),
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '+ Nueva Comisión' }))
    await screen.findByRole('dialog', { name: 'Crear Nueva Comisión' })

    await completarComision(user, { modalidad: 'VIRTUAL' })
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya hay una comisión para ese curso.')
    expect(screen.getByRole('dialog', { name: 'Crear Nueva Comisión' })).toBeInTheDocument()
    expect(screen.queryByText(/Comisión CUR\d+-\d+ creada\./)).not.toBeInTheDocument()
  })

  it('mantiene lo que el operador completó cuando el alta se rechaza', async () => {
    stubDataSource({
      crearComision: vi.fn(async () => {
        throw new Error('Ya hay una comisión para ese curso.')
      }),
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '+ Nueva Comisión' }))
    await screen.findByRole('dialog', { name: 'Crear Nueva Comisión' })

    await completarComision(user, { modalidad: 'VIRTUAL' })
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))
    await screen.findByRole('alert')

    expect(screen.getByLabelText(/Días y Horarios/)).toHaveValue('Mar y Jue 19 a 21 hs')
    expect(screen.getByLabelText(/^Modalidad/)).toHaveValue('VIRTUAL')
  })

  it('cierra sin guardar cuando se cancela', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Crear Nueva Comisión' })).not.toBeInTheDocument(),
    )
  })
})

describe('alta de curso', () => {
  it('guarda el curso y muestra el código que generó el sistema', async () => {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '+ Nuevo Curso' }))
    await screen.findByRole('dialog', { name: 'Crear Nuevo Curso' })

    expect(screen.queryByLabelText(/Código/)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/Nombre del Curso/), 'Excel Intermedio')
    await user.click(screen.getByRole('button', { name: 'Guardar Curso' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Crear Nuevo Curso' })).not.toBeInTheDocument(),
    )
    expect(await screen.findByText(/Curso CUR\d+ creado\./)).toBeInTheDocument()
  })

  it('deja el curso recién creado disponible para abrirle su primera comisión', async () => {
    // El selector de comisión se armaba con `comisiones.map((c) => c.curso)`, así que solo
    // ofrecía cursos que **ya tenían** una comisión: un curso nuevo no podía abrir la primera,
    // que es justamente el flujo que este change habilita. Por eso el selector consume
    // `listarCursos()`.
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '+ Nuevo Curso' }))
    await screen.findByRole('dialog', { name: 'Crear Nuevo Curso' })
    await user.type(screen.getByLabelText(/Nombre del Curso/), 'Excel Intermedio')
    await user.click(screen.getByRole('button', { name: 'Guardar Curso' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Crear Nuevo Curso' })).not.toBeInTheDocument(),
    )

    await abrirModal(user)

    const cursos = screen.getByLabelText(/^Curso \/ Programa/)
    expect(within(cursos).getByRole('option', { name: 'Excel Intermedio' })).toBeInTheDocument()
  })

  it('exige el nombre antes de guardar', async () => {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '+ Nuevo Curso' }))
    await screen.findByRole('dialog', { name: 'Crear Nuevo Curso' })

    await user.click(screen.getByRole('button', { name: 'Guardar Curso' }))

    expect(await screen.findByText('El nombre del curso es obligatorio.')).toBeInTheDocument()
  })

  it('deja el formulario abierto y muestra el motivo si el nombre ya existe', async () => {
    stubDataSource({
      crearCurso: vi.fn(async () => {
        throw new Error('Ya existe un curso con ese nombre: CUR001 — Python Inicial.')
      }),
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '+ Nuevo Curso' }))
    await screen.findByRole('dialog', { name: 'Crear Nuevo Curso' })

    await user.type(screen.getByLabelText(/Nombre del Curso/), 'Python Inicial')
    await user.click(screen.getByRole('button', { name: 'Guardar Curso' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un curso con ese nombre')
    expect(screen.getByRole('dialog', { name: 'Crear Nuevo Curso' })).toBeInTheDocument()
    expect(screen.queryByText(/Curso CUR\d+ creado\./)).not.toBeInTheDocument()
  })
})
