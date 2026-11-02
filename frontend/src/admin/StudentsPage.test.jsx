import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend, stubDataSource } from '../test/support'

/**
 * Alumnos e inscripciones (9.5 y 13).
 *
 * Lo que se prueba es lo que el prototipo no tenía: las cuatro categorías con su color, los dos
 * bloqueos con su causa, el alta real con sus validaciones y los huecos de comisión, categoría y
 * acceso para el alumno que todavía no tiene inscripción. Si la causa no aparece al lado del
 * estado, la pantalla vuelve a ser la del prototipo y el cliente pierde la diferencia entre "no
 * pagó" y "no se pudo leer el comprobante".
 */

const COLUMNAS_ALUMNOS = ['DNI', 'NOMBRE', 'EMAIL', 'TELÉFONO', 'ACCIONES']

const COLUMNAS_EMPRESAS = [
  'RAZÓN SOCIAL',
  'CUIT',
  'PREFERENCIA FACTURA',
  'NÓMINA DE EMPLEADOS',
  'ACCIONES',
]

const ALTA = {
  documento: '30.111.222',
  nombre: 'Rocío Álvarez',
  email: 'rocio.alvarez@techacademy.invalid',
  telefono: '+5491140000005',
}

/** La contraseña inicial que genera el alta: `<primer nombre><DNI>` (D45). */
const PASSWORD_INICIAL = 'rocio30111222'

/** La fila que devuelve una fuente real después de un alta: sin inscripción, con huecos. */
function filaCreada(datos = ALTA) {
  return {
    id: 99,
    ...datos,
    tipo_documento: 'DNI',
    activo: true,
    comision: null,
    categoria: null,
    porcentaje_beca: null,
    acceso: null,
    password_inicial: PASSWORD_INICIAL,
  }
}

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  renderAppAs('ADMIN', '/admin/alumnos')
  await screen.findByRole('heading', { name: 'Padrón de Alumnos Regulares' })
  await screen.findByText('Juan Ignacio Pérez')
})

function tablaAlumnos() {
  // La pantalla tiene dos tablas: el padrón de alumnos y las cuentas corporativas. Se toma la
  // primera, que es la del padrón.
  return screen.getAllByRole('table')[0]
}

function filaDe(nombre) {
  return within(tablaAlumnos())
    .getAllByRole('row')
    .find((fila) => fila.cells[1].textContent === nombre)
}

/** Abre la ficha del alumno desde su fila (HU 61) y devuelve el usuario y el diálogo. */
async function abrirFichaDe(nombre) {
  const user = userEvent.setup()
  await user.click(within(filaDe(nombre)).getByText(nombre))
  const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })
  return { user, ficha }
}

/** Elige una acción del menú ⋮ de la ficha abierta. */
async function elegirEnMenu(user, ficha, nombre) {
  await user.click(within(ficha).getByRole('button', { name: 'Acciones del alumno' }))
  await user.click(within(ficha).getByRole('menuitem', { name: nombre }))
}

async function abrirModal() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: '+ Nuevo Alumno' }))
  return user
}

async function completarAlta(user, datos = ALTA) {
  await user.type(screen.getByLabelText(/^DNI/), datos.documento)
  await user.type(screen.getByLabelText(/^Nombre/), datos.nombre)
  await user.type(screen.getByLabelText(/^Email/), datos.email)
  // El control de teléfono reacomoda el cursor mientras se escribe: se pega el número entero, que
  // es además lo que entrega el selector de país (D57).
  await user.click(screen.getByLabelText(/^Teléfono/))
  await user.paste(datos.telefono)
}

describe('padrón de alumnos', () => {
  it('muestra el buscador con el placeholder del spec', () => {
    expect(screen.getByPlaceholderText('Buscar por DNI o Nombre…')).toBeInTheDocument()
  })

  it('muestra las columnas en el orden que fija el spec', () => {
    const [primeraTabla] = screen.getAllByRole('table')

    expect(
      within(primeraTabla)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(COLUMNAS_ALUMNOS)
  })

  it('muestra las seis filas del maquetado', () => {
    expect(
      within(tablaAlumnos())
        .getAllByRole('row')
        .slice(1)
        .map((fila) => fila.cells[1].textContent),
    ).toEqual([
      'Juan Ignacio Pérez',
      'Camila Rodríguez',
      'Matías Fernández',
      'Nicolás Castro',
      'Agustina Benítez',
      'Valeria Rossi',
    ])
  })

  it('deja el documento del alumno del exterior tal como lo registra el cliente', () => {
    expect(filaDe('Nicolás Castro').cells[0]).toHaveTextContent('Sin DNI (alumno exterior)')
  })

  it('muestra con puntos el documento que la fuente devuelve normalizado', async () => {
    cleanup()
    stubDataSource({
      buscarAlumnos: async () => [
        {
          id: 11,
          nombre: 'Alumno Normalizado',
          documento: '30111222',
          tipo_documento: 'DNI',
          email: 'normalizado@techacademy.invalid',
          telefono: null,
          activo: true,
          comision: null,
          categoria: null,
          porcentaje_beca: null,
          acceso: null,
        },
      ],
    })
    renderAppAs('ADMIN', '/admin/alumnos')

    await screen.findByText('Alumno Normalizado')

    expect(filaDe('Alumno Normalizado').cells[0]).toHaveTextContent('30.111.222')
  })

  it('tiene una sola acción por fila: Ver ficha ↗', async () => {
    const user = userEvent.setup()
    const fila = filaDe('Juan Ignacio Pérez')

    expect(
      within(tablaAlumnos())
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(COLUMNAS_ALUMNOS)
    expect(within(fila).getAllByRole('button').map((boton) => boton.textContent)).toEqual([
      'Ver ficha ↗',
    ])

    await user.click(within(fila).getByRole('button', { name: 'Ver ficha ↗' }))

    // El click en el botón abre una sola ficha: no dispara además el de la fila.
    expect(await screen.findAllByRole('dialog', { name: 'Ficha del alumno' })).toHaveLength(1)
  })

  it('informa que la búsqueda no arrojó resultados', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Buscar alumno'), 'DNI que no existe')

    expect(await screen.findByText('No se encontraron resultados.')).toBeInTheDocument()
  })

  it('filtra por nombre', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Buscar alumno'), 'Valeria')

    await waitFor(() => expect(screen.queryByText('Juan Ignacio Pérez')).not.toBeInTheDocument())
    expect(screen.getByText('Valeria Rossi')).toBeInTheDocument()
  })

  it('deja el guion del teléfono vacío y no agrega columnas de inscripción', async () => {
    cleanup()
    stubDataSource({
      buscarAlumnos: async () => [
        {
          id: 9,
          nombre: 'Nuevo Alumno',
          documento: '30.111.222',
          tipo_documento: 'DNI',
          email: 'nuevo@techacademy.invalid',
          telefono: null,
          activo: true,
        },
      ],
    })
    renderAppAs('ADMIN', '/admin/alumnos')

    await screen.findByText('Nuevo Alumno')

    const fila = filaDe('Nuevo Alumno')
    expect(fila.cells[3]).toHaveTextContent('—')
    expect(fila.cells).toHaveLength(5)
  })

  it('muestra el teléfono del alumno en formato nacional', async () => {
    cleanup()
    stubDataSource({
      buscarAlumnos: async () => [
        {
          id: 10,
          nombre: 'Alumna Con Teléfono',
          documento: '30.111.223',
          tipo_documento: 'DNI',
          email: 'con.telefono@techacademy.invalid',
          telefono: '+5491140000005',
          activo: true,
          comision: null,
          categoria: null,
          porcentaje_beca: null,
          acceso: null,
        },
      ],
    })
    renderAppAs('ADMIN', '/admin/alumnos')

    await screen.findByText('Alumna Con Teléfono')

    // El padrón guarda E.164; la tabla muestra el número como lo lee la secretaría.
    expect(filaDe('Alumna Con Teléfono').cells[3]).toHaveTextContent('011 15-4000-0005')
  })
})

describe('ficha del alumno en modal (HU 61)', () => {
  async function abrirFichaConMouse(nombre) {
    const user = userEvent.setup()
    await user.click(within(filaDe(nombre)).getByText(nombre))
    return user
  }

  /** El valor de una fila etiqueta/valor de la ficha. */
  function valorDe(ficha, etiqueta) {
    return within(ficha).getByText(etiqueta).parentElement
  }

  it('abre la ficha con el mouse y muestra los datos en modo lectura', async () => {
    await abrirFichaConMouse('Juan Ignacio Pérez')

    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })
    expect(within(ficha).getByText('38.456.789')).toBeInTheDocument()
    expect(within(ficha).getByText('Juan Ignacio Pérez')).toBeInTheDocument()
    expect(within(ficha).getByText('juan.perez@gmail.com')).toBeInTheDocument()
    expect(within(ficha).getByText('—')).toBeInTheDocument()
    // No hay campos editables: la ficha es de lectura.
    expect(within(ficha).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('abre la misma ficha con Enter sobre la fila enfocada', async () => {
    const user = userEvent.setup()
    const fila = filaDe('Camila Rodríguez')
    fila.focus()

    await user.keyboard('{Enter}')

    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })
    expect(within(ficha).getByText('Camila Rodríguez')).toBeInTheDocument()
    expect(within(ficha).getByText('011 4788-1122')).toBeInTheDocument()
  })

  it('cierra con Escape y devuelve el foco a la fila que la abrió', async () => {
    const user = await abrirFichaConMouse('Juan Ignacio Pérez')
    const fila = filaDe('Juan Ignacio Pérez')
    await screen.findByRole('dialog', { name: 'Ficha del alumno' })

    await user.keyboard('{Escape}')

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Ficha del alumno' })).not.toBeInTheDocument(),
    )
    expect(fila).toHaveFocus()
  })

  it('ofrece Editar, Restablecer contraseña y Eliminar en el menú ⋮', async () => {
    const user = await abrirFichaConMouse('Juan Ignacio Pérez')
    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })

    await user.click(within(ficha).getByRole('button', { name: 'Acciones del alumno' }))

    expect(within(ficha).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Editar',
      'Restablecer contraseña',
      'Eliminar',
    ])
  })

  it('muestra el motivo y no inventa inscripciones cuando el detalle falla', async () => {
    cleanup()
    stubDataSource({
      obtenerAlumno: async () => {
        throw new Error('No pudimos conectar con el servidor.')
      },
    })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')

    await abrirFichaConMouse('Juan Ignacio Pérez')

    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })
    expect(
      await within(ficha).findByText('No pudimos conectar con el servidor.'),
    ).toBeInTheDocument()
    expect(within(ficha).queryByText(/CUR-\d{3}/)).not.toBeInTheDocument()
  })

  it('elige la comisión con un selector y no con chips', async () => {
    const user = await abrirFichaConMouse('Juan Ignacio Pérez')
    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })

    const selector = await within(ficha).findByRole('combobox', {
      name: /Seleccionar comisión/,
    })
    // La primera inscripción viene elegida y no hay pestañas.
    expect(selector).toHaveTextContent('CUR-101 Python Inicial')
    expect(within(ficha).queryByRole('tab')).not.toBeInTheDocument()

    await user.click(selector)

    expect(within(ficha).getAllByRole('option').map((opcion) => opcion.textContent)).toEqual([
      'CUR-101 Python Inicial',
      'CUR-106 Machine Learning Aplicado',
    ])

    await user.click(within(ficha).getByRole('option', { name: 'CUR-106 Machine Learning Aplicado' }))

    expect(within(ficha).getByText('Corporativo')).toBeInTheDocument()
    expect(within(ficha).getByText('Tech Solutions S.A.')).toBeInTheDocument()
    expect(within(ficha).getByText('A cargo de la empresa')).toBeInTheDocument()
  })

  it('muestra la categoría con su lápiz y el mismo flujo de edición', async () => {
    const user = await abrirFichaConMouse('Juan Ignacio Pérez')
    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })

    expect(await within(ficha).findByText('Particular')).toBeInTheDocument()
    const lapiz = within(ficha).getByRole('button', { name: 'Editar categoría' })
    expect(lapiz).toHaveAttribute('title', 'Editar categoría')

    await user.click(lapiz)

    const formulario = await screen.findByRole('dialog', { name: 'Asignar categoría' })
    expect(within(formulario).getByLabelText('Categoría')).toHaveValue('PARTICULAR')
    await user.selectOptions(within(formulario).getByLabelText('Categoría'), 'BECADO_PARCIAL')
    await user.type(within(formulario).getByLabelText(/Porcentaje de descuento/), '40')
    await user.click(within(formulario).getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('Categoría actualizada en CUR-101 Python Inicial.'),
    ).toBeInTheDocument()
    expect(await within(ficha).findByText('Becado parcial 40%')).toBeInTheDocument()
  })

  it('muestra el bloqueo con su causa y el (i) de bloqueo solo cuando está bloqueado', async () => {
    cleanup()
    stubDataSource({
      obtenerAlumno: async () => ({
        id: 1,
        nombre: 'Juan Ignacio Pérez',
        documento: '38.456.789',
        email: 'juan.perez@gmail.com',
        telefono: null,
        inscripciones: [
          {
            id: 11,
            estado: 'ACTIVA',
            comision: { codigo: 'CUR-101', nombre: 'Python Inicial' },
            categoria: 'PARTICULAR',
            porcentaje_beca: null,
            empresa: null,
            acceso: { estado: 'BLOQUEADO', causa: 'debe saldo', forzado: false },
            arancel: 45000,
            monto_requerido: 45000,
            total_pagado: 20000,
            total_observado: 0,
            saldo_pendiente: 25000,
          },
          {
            id: 12,
            estado: 'COMPLETADA',
            comision: { codigo: 'CUR-106', nombre: 'Machine Learning Aplicado' },
            categoria: 'PARTICULAR',
            porcentaje_beca: null,
            empresa: null,
            acceso: null,
            arancel: 52000,
            monto_requerido: 52000,
            total_pagado: 0,
            total_observado: 0,
            saldo_pendiente: 52000,
          },
        ],
      }),
    })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')

    await abrirFichaConMouse('Juan Ignacio Pérez')
    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })

    expect(await within(ficha).findByText('BLOQUEADO')).toBeInTheDocument()
    expect(within(ficha).getByRole('button', { name: 'Motivo del bloqueo' })).toBeInTheDocument()
  })

  it('muestra el arancel, lo pagado y el saldo con centavos', async () => {
    await abrirFichaConMouse('Valeria Rossi')
    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })
    await within(ficha).findByText('Arancel a abonar')

    expect(valorDe(ficha, 'Arancel a abonar')).toHaveTextContent('$52.000,00')
    expect(valorDe(ficha, 'Total pagado')).toHaveTextContent('$0,00')
    expect(valorDe(ficha, 'Saldo pendiente')).toHaveTextContent('$52.000,00')
  })

  it('avisa lo observado en el saldo solo cuando hay comprobantes observados', async () => {
    const user = await abrirFichaConMouse('Valeria Rossi')
    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })

    const indicador = await within(ficha).findByRole('button', {
      name: 'Comprobantes observados',
    })
    expect(within(ficha).queryByRole('tooltip')).not.toBeInTheDocument()

    await user.hover(indicador)

    const ayuda = within(ficha).getByRole('tooltip')
    expect(ayuda).toHaveTextContent('Incluye $26.000,00 en comprobantes observados')
    expect(indicador).toHaveAttribute('aria-describedby', ayuda.id)
  })

  it('no muestra el aviso de observados cuando no hay nada observado', async () => {
    await abrirFichaConMouse('Juan Ignacio Pérez')
    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })
    await within(ficha).findByText('Arancel a abonar')

    expect(
      within(ficha).queryByRole('button', { name: 'Comprobantes observados' }),
    ).not.toBeInTheDocument()
  })

  it('exime la beca total: arancel y pagado en cero, saldo exento', async () => {
    await abrirFichaConMouse('Matías Fernández')
    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })
    await within(ficha).findByText('Becado total')

    expect(valorDe(ficha, 'Arancel a abonar')).toHaveTextContent('$0,00')
    expect(valorDe(ficha, 'Total pagado')).toHaveTextContent('$0,00')
    expect(valorDe(ficha, 'Saldo pendiente')).toHaveTextContent('Exento')
    expect(
      within(ficha).queryByRole('button', { name: 'Comprobantes observados' }),
    ).not.toBeInTheDocument()
  })

  it('descuenta la beca parcial del arancel', async () => {
    await abrirFichaConMouse('Camila Rodríguez')
    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })
    await within(ficha).findByText('Becado parcial 50%')

    expect(valorDe(ficha, 'Arancel a abonar')).toHaveTextContent('$26.000,00')
    expect(valorDe(ficha, 'Saldo pendiente')).toHaveTextContent('$0,00')
  })

  it('deja el arancel corporativo en guion y el saldo a cargo de la empresa', async () => {
    const user = await abrirFichaConMouse('Juan Ignacio Pérez')
    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })

    await user.click(await within(ficha).findByRole('combobox', { name: /Seleccionar comisión/ }))
    await user.click(within(ficha).getByRole('option', { name: /CUR-106/ }))

    expect(valorDe(ficha, 'Arancel a abonar')).toHaveTextContent('—')
    expect(valorDe(ficha, 'Saldo pendiente')).toHaveTextContent('A cargo de la empresa')
    expect(
      within(ficha).queryByRole('button', { name: 'Comprobantes observados' }),
    ).not.toBeInTheDocument()
  })

  it('informa cuando el alumno no tiene inscripciones y no dibuja el selector', async () => {
    cleanup()
    stubDataSource({
      buscarAlumnos: async () => [
        {
          id: 9,
          nombre: 'Nuevo Alumno',
          documento: '30.111.222',
          tipo_documento: 'DNI',
          email: 'nuevo@techacademy.invalid',
          telefono: null,
          activo: true,
        },
      ],
      obtenerAlumno: async () => ({ id: 9, nombre: 'Nuevo Alumno', inscripciones: [] }),
    })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Nuevo Alumno')

    await abrirFichaConMouse('Nuevo Alumno')

    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })
    expect(await within(ficha).findByText(/todavía no tiene inscripciones/)).toBeInTheDocument()
    expect(within(ficha).queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('cierra con un click en el fondo y no con uno adentro', async () => {
    await abrirFichaConMouse('Juan Ignacio Pérez')
    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })
    const fondo = ficha.parentElement

    fireEvent.mouseDown(ficha)
    fireEvent.mouseUp(ficha)
    expect(screen.getByRole('dialog', { name: 'Ficha del alumno' })).toBeInTheDocument()

    fireEvent.mouseDown(fondo)
    fireEvent.mouseUp(fondo)

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Ficha del alumno' })).not.toBeInTheDocument(),
    )
  })

  it('no cierra si el arrastre empezó adentro y terminó en el fondo', async () => {
    await abrirFichaConMouse('Juan Ignacio Pérez')
    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })

    fireEvent.mouseDown(ficha)
    fireEvent.mouseUp(ficha.parentElement)

    expect(screen.getByRole('dialog', { name: 'Ficha del alumno' })).toBeInTheDocument()
  })

  it('con el desplegable abierto, Escape cierra solo el desplegable', async () => {
    const user = await abrirFichaConMouse('Juan Ignacio Pérez')
    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })

    await user.click(await within(ficha).findByRole('combobox', { name: /Seleccionar comisión/ }))
    expect(within(ficha).getByRole('listbox')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(within(ficha).queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Ficha del alumno' })).toBeInTheDocument()
  })

  it('con el desplegable abierto, el click afuera no cierra el modal', async () => {
    const user = await abrirFichaConMouse('Juan Ignacio Pérez')
    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })

    await user.click(await within(ficha).findByRole('combobox', { name: /Seleccionar comisión/ }))
    // La capa del desplegable se queda con el primer click: cierra la lista, no el modal.
    await user.click(within(ficha).getByRole('listbox').previousElementSibling)

    expect(within(ficha).queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Ficha del alumno' })).toBeInTheDocument()
  })

  it('con el formulario de categoría encima, el click afuera no cierra la ficha', async () => {
    const user = await abrirFichaConMouse('Juan Ignacio Pérez')
    const ficha = await screen.findByRole('dialog', { name: 'Ficha del alumno' })

    await user.click(await within(ficha).findByRole('button', { name: 'Editar categoría' }))
    await screen.findByRole('dialog', { name: 'Asignar categoría' })

    fireEvent.mouseDown(ficha.parentElement)
    fireEvent.mouseUp(ficha.parentElement)

    expect(screen.getByRole('dialog', { name: 'Ficha del alumno' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Asignar categoría' })).toBeInTheDocument()
  })
})

describe('alta de alumno', () => {
  it('abre el modal con los campos del spec y sin tipo de documento', async () => {
    await abrirModal()

    expect(screen.getByRole('dialog', { name: 'Nuevo Alumno' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^DNI/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Nombre/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Email/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Teléfono/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar Alumno' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/tipo de documento/i)).not.toBeInTheDocument()
  })

  it('valida los campos obligatorios antes de enviar', async () => {
    const crearAlumno = vi.fn()
    cleanup()
    stubDataSource({ crearAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const user = await abrirModal()

    await user.click(screen.getByRole('button', { name: 'Guardar Alumno' }))

    expect(await screen.findByText('El DNI es obligatorio.')).toBeInTheDocument()
    expect(screen.getByText('El nombre es obligatorio.')).toBeInTheDocument()
    expect(screen.getByText('El email es obligatorio.')).toBeInTheDocument()
    expect(crearAlumno).not.toHaveBeenCalled()
  })

  it('rechaza un DNI que no tiene 7 u 8 dígitos y un email sin forma', async () => {
    const crearAlumno = vi.fn()
    cleanup()
    stubDataSource({ crearAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const user = await abrirModal()

    await completarAlta(user, { ...ALTA, documento: '123', email: 'rocio@' })
    await user.click(screen.getByRole('button', { name: 'Guardar Alumno' }))

    expect(await screen.findByText('El DNI debe tener 7 u 8 dígitos.')).toBeInTheDocument()
    expect(screen.getByText('El email no tiene un formato válido.')).toBeInTheDocument()
    expect(crearAlumno).not.toHaveBeenCalled()
  })

  it('manda el DNI como se escribió y el teléfono en E.164', async () => {
    const crearAlumno = vi.fn(async (datos) => filaCreada(datos))
    cleanup()
    stubDataSource({ crearAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const user = await abrirModal()

    await completarAlta(user)
    await user.click(screen.getByRole('button', { name: 'Guardar Alumno' }))

    await waitFor(() => expect(crearAlumno).toHaveBeenCalledTimes(1))
    expect(crearAlumno.mock.calls[0][0]).toEqual({
      documento: '30.111.222',
      nombre: 'Rocío Álvarez',
      email: 'rocio.alvarez@techacademy.invalid',
      telefono: '+5491140000005',
    })
  })

  it('da de alta, cierra el formulario, incorpora la fila y muestra las credenciales en un modal', async () => {
    const crearAlumno = vi.fn(async (datos) => filaCreada(datos))
    cleanup()
    stubDataSource({ crearAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const user = await abrirModal()

    await completarAlta(user)
    await user.click(screen.getByRole('button', { name: 'Guardar Alumno' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Credenciales del alumno' })
    expect(dialogo).toHaveTextContent(ALTA.nombre)
    expect(dialogo).toHaveTextContent(ALTA.email)
    expect(dialogo).toHaveTextContent(PASSWORD_INICIAL)
    expect(dialogo).not.toHaveTextContent('No se envió ningún correo')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(crearAlumno).toHaveBeenCalledWith(ALTA)
    expect(filaDe(ALTA.nombre).cells[0]).toHaveTextContent(ALTA.documento)

    await user.click(within(dialogo).getByRole('button', { name: 'Entendido' }))
    expect(
      screen.queryByRole('dialog', { name: 'Credenciales del alumno' }),
    ).not.toBeInTheDocument()
  })

  it('mantiene el modal abierto con lo cargado cuando la fuente rechaza el alta', async () => {
    const crearAlumno = vi.fn(async () => {
      throw new Error('Ya hay un alumno registrado con ese documento.')
    })
    cleanup()
    stubDataSource({ crearAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const user = await abrirModal()

    await completarAlta(user)
    await user.click(screen.getByRole('button', { name: 'Guardar Alumno' }))

    expect(
      await screen.findByText('Ya hay un alumno registrado con ese documento.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Nuevo Alumno' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^DNI/)).toHaveValue(ALTA.documento)
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue(ALTA.nombre)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('no confirma nada cuando el alta no llega a la base', async () => {
    const crearAlumno = vi.fn(async () => {
      throw new Error('No pudimos conectar con el servidor.')
    })
    cleanup()
    stubDataSource({ crearAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const user = await abrirModal()

    await completarAlta(user)
    await user.click(screen.getByRole('button', { name: 'Guardar Alumno' }))

    expect(await screen.findByText('No pudimos conectar con el servidor.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Nuevo Alumno' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(/dado de alta/)).not.toBeInTheDocument())
  })
})

describe('edición y baja de alumnos', () => {
  it('abre la edición con los datos de la fila y actualiza el padrón', async () => {
    const editarAlumno = vi.fn(async (id, datos) => ({ id, ...datos, activo: true }))
    cleanup()
    stubDataSource({ editarAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const { user, ficha } = await abrirFichaDe('Juan Ignacio Pérez')
    await elegirEnMenu(user, ficha, 'Editar')

    const dialogo = screen.getByRole('dialog', { name: 'Editar Alumno' })
    expect(within(dialogo).getByLabelText(/^DNI/)).toHaveValue('38.456.789')
    expect(within(dialogo).getByLabelText(/^Nombre/)).toHaveValue('Juan Ignacio Pérez')

    await user.clear(within(dialogo).getByLabelText(/^Nombre/))
    await user.type(within(dialogo).getByLabelText(/^Nombre/), 'Juan Pérez Editado')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar Cambios' }))

    expect(await within(ficha).findByText('Juan Pérez Editado')).toBeInTheDocument()
    expect(within(tablaAlumnos()).getByText('Juan Pérez Editado')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('se actualizaron correctamente')
    expect(editarAlumno).toHaveBeenCalledWith(1, {
      documento: '38.456.789',
      nombre: 'Juan Pérez Editado',
      email: 'juan.perez@gmail.com',
      telefono: null,
    })
    expect(screen.queryByRole('dialog', { name: 'Editar Alumno' })).not.toBeInTheDocument()
  })

  it('rechaza un teléfono legacy que no se puede interpretar', async () => {
    const editarAlumno = vi.fn()
    cleanup()
    stubDataSource({
      buscarAlumnos: vi.fn(async () => [
        {
          id: 5,
          nombre: 'Alumno Legacy',
          documento: '30.111.222',
          tipo_documento: 'DNI',
          email: 'legacy@techacademy.invalid',
          telefono: 'particular',
          activo: true,
          comision: null,
          categoria: null,
          porcentaje_beca: null,
          acceso: null,
        },
      ]),
      editarAlumno,
    })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Alumno Legacy')
    const { user, ficha } = await abrirFichaDe('Alumno Legacy')
    await elegirEnMenu(user, ficha, 'Editar')

    const dialogo = screen.getByRole('dialog', { name: 'Editar Alumno' })

    // El valor crudo se conserva y no hay aviso al cargar; el rechazo aparece al guardar (D57).
    expect(within(dialogo).getByLabelText(/^Teléfono/)).toHaveValue('particular')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar Cambios' }))

    expect(
      await screen.findByText('El teléfono no es válido: elegí el país y escribí el número.'),
    ).toBeInTheDocument()
    expect(editarAlumno).not.toHaveBeenCalled()
  })

  it('deja el modal abierto cuando la edición choca con un dato duplicado', async () => {
    const editarAlumno = vi.fn(async () => {
      throw new Error('Ya hay un alumno registrado con ese documento.')
    })
    cleanup()
    stubDataSource({ editarAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const { user, ficha } = await abrirFichaDe('Juan Ignacio Pérez')
    await elegirEnMenu(user, ficha, 'Editar')
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    expect(
      await screen.findByText('Ya hay un alumno registrado con ese documento.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Editar Alumno' })).toBeInTheDocument()
    // La ficha queda debajo del modal apilado.
    expect(screen.getByRole('dialog', { name: 'Ficha del alumno' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('restablece la contraseña sin mostrarla en claro y avisa', async () => {
    const restablecerPasswordAlumno = vi.fn(async () => ({ id: 1 }))
    cleanup()
    stubDataSource({ restablecerPasswordAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const { user, ficha } = await abrirFichaDe('Juan Ignacio Pérez')
    await elegirEnMenu(user, ficha, 'Restablecer contraseña')

    const dialogo = screen.getByRole('dialog', { name: 'Restablecer contraseña' })
    await user.type(within(dialogo).getByLabelText(/^Nueva contraseña/), 'NuevaClave2026')
    await user.type(within(dialogo).getByLabelText(/^Confirmar contraseña/), 'NuevaClave2026')
    await user.click(within(dialogo).getByRole('button', { name: 'Restablecer contraseña' }))

    expect(restablecerPasswordAlumno).toHaveBeenCalledWith(1, 'NuevaClave2026')
    expect(await screen.findByRole('status')).toHaveTextContent('restablecida')
    expect(screen.queryByText('NuevaClave2026')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('dialog', { name: 'Restablecer contraseña' }),
    ).not.toBeInTheDocument()
    expect(ficha).toBeInTheDocument()
  })

  it('no restablece si las contraseñas no coinciden', async () => {
    const restablecerPasswordAlumno = vi.fn()
    cleanup()
    stubDataSource({ restablecerPasswordAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const { user, ficha } = await abrirFichaDe('Juan Ignacio Pérez')
    await elegirEnMenu(user, ficha, 'Restablecer contraseña')

    const dialogo = screen.getByRole('dialog', { name: 'Restablecer contraseña' })
    await user.type(within(dialogo).getByLabelText(/^Nueva contraseña/), 'NuevaClave2026')
    await user.type(within(dialogo).getByLabelText(/^Confirmar contraseña/), 'OtraClave2026')
    await user.click(within(dialogo).getByRole('button', { name: 'Restablecer contraseña' }))

    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument()
    expect(restablecerPasswordAlumno).not.toHaveBeenCalled()
  })

  it('pide confirmación antes de la baja y saca la fila al confirmar', async () => {
    const eliminarAlumno = vi.fn(async () => ({ id: 1, activo: false }))
    cleanup()
    stubDataSource({ eliminarAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const { user, ficha } = await abrirFichaDe('Juan Ignacio Pérez')
    await elegirEnMenu(user, ficha, 'Eliminar')

    const dialogo = screen.getByRole('dialog', { name: 'Eliminar Alumno' })
    expect(dialogo).toHaveTextContent('Juan Ignacio Pérez')
    expect(dialogo).not.toHaveTextContent('Es una baja lógica')

    await user.click(within(dialogo).getByRole('button', { name: 'Confirmar baja' }))

    expect(eliminarAlumno).toHaveBeenCalledWith(1)
    await waitFor(() => expect(screen.queryByText('Juan Ignacio Pérez')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('dado de baja correctamente')
    expect(screen.queryByRole('dialog', { name: 'Eliminar Alumno' })).not.toBeInTheDocument()
    // La baja cierra la ficha: ya no hay fila a la que volver.
    expect(screen.queryByRole('dialog', { name: 'Ficha del alumno' })).not.toBeInTheDocument()
  })

  it('cancela la baja sin modificar el padrón', async () => {
    const eliminarAlumno = vi.fn()
    cleanup()
    stubDataSource({ eliminarAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const { user, ficha } = await abrirFichaDe('Juan Ignacio Pérez')
    await elegirEnMenu(user, ficha, 'Eliminar')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(eliminarAlumno).not.toHaveBeenCalled()
    expect(within(tablaAlumnos()).getByText('Juan Ignacio Pérez')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(ficha).toBeInTheDocument()
  })

  it('mantiene la confirmación abierta si la baja falla', async () => {
    const eliminarAlumno = vi.fn(async () => {
      throw new Error('El alumno ya está dado de baja.')
    })
    cleanup()
    stubDataSource({ eliminarAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const { user, ficha } = await abrirFichaDe('Juan Ignacio Pérez')
    await elegirEnMenu(user, ficha, 'Eliminar')
    await user.click(screen.getByRole('button', { name: 'Confirmar baja' }))

    expect(await screen.findByText('El alumno ya está dado de baja.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Eliminar Alumno' })).toBeInTheDocument()
    expect(filaDe('Juan Ignacio Pérez')).toBeTruthy()
    expect(ficha).toBeInTheDocument()
  })

  it('apila la confirmación sobre la ficha y Escape cierra solo la de arriba', async () => {
    const { user, ficha } = await abrirFichaDe('Juan Ignacio Pérez')
    await elegirEnMenu(user, ficha, 'Eliminar')

    expect(screen.getByRole('dialog', { name: 'Eliminar Alumno' })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Eliminar Alumno' })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('dialog', { name: 'Ficha del alumno' })).toBeInTheDocument()
  })
})

describe('reactivación de alumnos dados de baja', () => {
  const INACTIVO = {
    id: 55,
    nombre: ALTA.nombre,
    documento: ALTA.documento,
    email: ALTA.email,
    activo: false,
  }

  it('ofrece reactivar el mismo registro y muestra las nuevas credenciales', async () => {
    const crearAlumno = vi.fn(async () => {
      throw Object.assign(new Error('Ya hay un alumno registrado con ese documento.'), {
        status: 409,
      })
    })
    const buscarAlumnoReactivable = vi.fn(async () => INACTIVO)
    const reactivarAlumno = vi.fn(async (id, datos) => ({
      id,
      ...datos,
      activo: true,
      password_inicial: PASSWORD_INICIAL,
    }))
    cleanup()
    stubDataSource({ crearAlumno, buscarAlumnoReactivable, reactivarAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const user = await abrirModal()

    await completarAlta(user)
    await user.click(screen.getByRole('button', { name: 'Guardar Alumno' }))

    const aviso = await screen.findByRole('dialog', { name: 'Reactivar alumno' })
    expect(aviso).toHaveTextContent('fue dado de baja anteriormente')
    expect(aviso).toHaveTextContent(ALTA.nombre)
    expect(screen.queryByRole('dialog', { name: 'Nuevo Alumno' })).not.toBeInTheDocument()
    expect(buscarAlumnoReactivable).toHaveBeenCalledWith({
      documento: ALTA.documento,
      email: ALTA.email,
    })

    await user.click(within(aviso).getByRole('button', { name: 'Reactivar alumno' }))

    expect(reactivarAlumno).toHaveBeenCalledWith(55, ALTA)
    const credenciales = await screen.findByRole('dialog', { name: 'Credenciales del alumno' })
    expect(credenciales).toHaveTextContent(PASSWORD_INICIAL)
    expect(screen.queryByRole('dialog', { name: 'Nuevo Alumno' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Reactivar alumno' })).not.toBeInTheDocument()
  })

  it('cancela la reactivación sin modificar datos ni crear un duplicado', async () => {
    const crearAlumno = vi.fn(async () => {
      throw Object.assign(new Error('Ya hay un alumno registrado con ese documento.'), {
        status: 409,
      })
    })
    const buscarAlumnoReactivable = vi.fn(async () => INACTIVO)
    const reactivarAlumno = vi.fn()
    cleanup()
    stubDataSource({ crearAlumno, buscarAlumnoReactivable, reactivarAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const user = await abrirModal()

    await completarAlta(user)
    await user.click(screen.getByRole('button', { name: 'Guardar Alumno' }))

    const aviso = await screen.findByRole('dialog', { name: 'Reactivar alumno' })
    expect(screen.queryByRole('dialog', { name: 'Nuevo Alumno' })).not.toBeInTheDocument()
    await user.click(within(aviso).getByRole('button', { name: 'Cancelar' }))

    expect(reactivarAlumno).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Reactivar alumno' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Nuevo Alumno' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^DNI/)).toHaveValue(ALTA.documento)
  })
})

describe('cuentas corporativas', () => {
  it('muestra las columnas del bloque, en el orden del spec', () => {
    const [, segundaTabla] = screen.getAllByRole('table')

    expect(
      within(segundaTabla)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(COLUMNAS_EMPRESAS)
  })

  it('muestra las dos cuentas con su CUIT y el badge de factura A', () => {
    expect(screen.getByText('Tech Solutions S.A.')).toBeInTheDocument()
    expect(screen.getByText('Banco Federal (Capacitaciones)')).toBeInTheDocument()
    expect(screen.getByText('30-71665544-9')).toBeInTheDocument()
    expect(screen.getByText('30-50001234-4')).toBeInTheDocument()
    expect(screen.getAllByText('A')).toHaveLength(2)
  })

  it('aclara en la nómina de cada empresa lo que falta', () => {
    expect(
      screen.getByText(
        'Grupo 5 (Data Analytics) y Grupo 2 (Python Inicial), segunda tanda de empleados',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('10 personas, falta enviar la nómina')).toBeInTheDocument()
  })

  it('abre la carga de nómina para una empresa', async () => {
    const user = userEvent.setup()

    await user.click(screen.getAllByRole('button', { name: 'Cargar nómina' })[0])

    expect(
      screen.getByRole('dialog', { name: /Cargar nómina · Tech Solutions/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('Empleados a inscribir')).toBeInTheDocument()
    expect(screen.getByText(/La empresa cubre la inscripción/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Categoría *')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Descuento (%) *')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar nómina' })).toBeInTheDocument()
  })
})

describe('alta de cuenta corporativa', () => {
  function abrirModalDeEmpresa(user) {
    return user.click(screen.getByRole('button', { name: '+ Nueva Empresa' }))
  }

  it('abre el modal con razón social, CUIT y la casilla de Factura A', async () => {
    const user = userEvent.setup()

    await abrirModalDeEmpresa(user)

    expect(screen.getByRole('dialog', { name: 'Nueva Empresa' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Razón Social/)).toBeInTheDocument()
    expect(screen.getByLabelText(/CUIT/)).toBeInTheDocument()
    expect(screen.getByLabelText('Requiere Factura A')).toBeInTheDocument()
  })

  it('no envía el alta sin razón social', async () => {
    const user = userEvent.setup()

    await abrirModalDeEmpresa(user)
    await user.click(screen.getByRole('button', { name: 'Guardar Empresa' }))

    expect(await screen.findByText('La razón social es obligatoria.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Nueva Empresa' })).toBeInTheDocument()
  })

  it('da de alta la empresa y la agrega a la tabla', async () => {
    const user = userEvent.setup()

    await abrirModalDeEmpresa(user)
    await user.type(screen.getByLabelText(/Razón Social/), 'Delta Logística SRL')
    await user.type(screen.getByLabelText(/CUIT/), '30-71234567-8')
    await user.click(screen.getByLabelText('Requiere Factura A'))
    await user.click(screen.getByRole('button', { name: 'Guardar Empresa' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Delta Logística SRL')).toBeInTheDocument()
    expect(screen.getByText('30-71234567-8')).toBeInTheDocument()
  })

  it('muestra el motivo del backend y deja el modal abierto cuando el CUIT está duplicado', async () => {
    const user = userEvent.setup()

    await abrirModalDeEmpresa(user)
    await user.type(screen.getByLabelText(/Razón Social/), 'Otra Empresa')
    await user.type(screen.getByLabelText(/CUIT/), '30-71665544-9')
    await user.click(screen.getByRole('button', { name: 'Guardar Empresa' }))

    expect(
      await screen.findByText(/Ya hay una empresa registrada con ese CUIT/),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Nueva Empresa' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Otra Empresa')).toBeInTheDocument()
  })
})

describe('padrón sin endpoint', () => {
  it('deja el padrón y las cuentas corporativas vacíos cuando la lectura falla', async () => {
    cleanup()
    stubDataSource({
      buscarAlumnos: async () => {
        throw new Error('No pudimos conectar con el servidor.')
      },
      listarEmpresas: async () => {
        throw new Error('No pudimos conectar con el servidor.')
      },
    })
    renderAppAs('ADMIN', '/admin/alumnos')

    await screen.findByRole('heading', { name: 'Padrón de Alumnos Regulares' })
    expect(await screen.findByText('No se encontraron resultados.')).toBeInTheDocument()
    // Las dos tablas quedan sin filas: la de alumnos muestra su `vacio` y la de empresas no dibuja
    // ninguna tabla.
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
