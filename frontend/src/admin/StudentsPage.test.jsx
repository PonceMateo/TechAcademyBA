import { cleanup, screen, waitFor, within } from '@testing-library/react'
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

const COLUMNAS_ALUMNOS = [
  'DNI',
  'NOMBRE',
  'EMAIL',
  'TELÉFONO',
  'COMISIÓN ASIGNADA',
  'CATEGORÍA ARANCELARIA',
  'ACCESO PLATAFORMA',
  'ACCIONES',
]

const COLUMNAS_EMPRESAS = ['RAZÓN SOCIAL', 'CUIT', 'PREFERENCIA FACTURA', 'NÓMINA DE EMPLEADOS']

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

  it('muestra la categoría con su color', () => {
    expect(filaDe('Juan Ignacio Pérez').cells[5].textContent).toContain('PARTICULAR')
    expect(filaDe('Juan Ignacio Pérez').cells[5].querySelector('.text-slate-700')).not.toBeNull()
    expect(filaDe('Agustina Benítez').cells[5].textContent).toContain('BECADO PARCIAL')
    expect(filaDe('Agustina Benítez').cells[5].querySelector('.text-violet-800')).not.toBeNull()
  })

  it('muestra el porcentaje de descuento del becado parcial', () => {
    expect(filaDe('Camila Rodríguez').cells[5]).toHaveTextContent('50% de descuento')
    expect(filaDe('Agustina Benítez').cells[5]).toHaveTextContent('50% de descuento')
  })

  it('deja las categorías con colores distintos entre sí', () => {
    // BECADO TOTAL y CORPORATIVO son del enum y del spec, pero el padrón del maquetado no tiene
    // filas de esas dos. Lo verificable acá es que las dos que aparecen no comparten color.
    const colorDe = (nombre) => {
      const insignia = filaDe(nombre).cells[5].querySelector('[data-ui="badge"]')
      return insignia.className
    }

    expect(colorDe('Juan Ignacio Pérez')).toContain('text-slate-700')
    expect(colorDe('Agustina Benítez')).toContain('text-violet-800')
    expect(colorDe('Juan Ignacio Pérez')).not.toBe(colorDe('Agustina Benítez'))
  })

  it('muestra HABILITADO en verde para los cuatro accesos al día', () => {
    const habilitados = screen.getAllByText('HABILITADO')

    expect(habilitados).toHaveLength(4)
    for (const habilitado of habilitados) {
      expect(habilitado.className).toContain('text-green-800')
    }
  })

  it('mantiene los botones de acciones en una sola línea', () => {
    const botones = within(filaDe('Juan Ignacio Pérez')).getAllByRole('button')

    expect(botones.map((boton) => boton.textContent)).toEqual([
      'Editar',
      'Restablecer contraseña',
      'Eliminar alumno',
    ])
    botones.forEach((boton) => expect(boton).toHaveClass('whitespace-nowrap'))
  })

  it('muestra cada bloqueo con su causa al lado del estado', () => {
    const bloqueos = screen.getAllByText('BLOQUEADO')

    expect(bloqueos).toHaveLength(2)
    for (const bloqueo of bloqueos) {
      expect(bloqueo.className).toContain('text-red-800')
    }

    expect(filaDe('Agustina Benítez').cells[6]).toHaveTextContent('comprobante ilegible')
    expect(filaDe('Valeria Rossi').cells[6]).toHaveTextContent('debe saldo')
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

  it('deja Sin comisión y guiones en la fila del alumno sin inscripción', async () => {
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
          comision: null,
          categoria: null,
          porcentaje_beca: null,
          acceso: null,
        },
      ],
    })
    renderAppAs('ADMIN', '/admin/alumnos')

    await screen.findByText('Nuevo Alumno')

    const fila = filaDe('Nuevo Alumno')
    expect(fila.cells[3]).toHaveTextContent('—')
    expect(fila.cells[4]).toHaveTextContent('Sin comisión')
    expect(fila.cells[5]).toHaveTextContent('—')
    expect(fila.cells[6]).toHaveTextContent('—')
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
    const user = userEvent.setup()

    await user.click(within(filaDe('Juan Ignacio Pérez')).getByRole('button', { name: 'Editar' }))
    const dialogo = screen.getByRole('dialog', { name: 'Editar Alumno' })
    expect(within(dialogo).getByLabelText(/^DNI/)).toHaveValue('38.456.789')
    expect(within(dialogo).getByLabelText(/^Nombre/)).toHaveValue('Juan Ignacio Pérez')

    await user.clear(within(dialogo).getByLabelText(/^Nombre/))
    await user.type(within(dialogo).getByLabelText(/^Nombre/), 'Juan Pérez Editado')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar Cambios' }))

    expect(await screen.findByText('Juan Pérez Editado')).toBeInTheDocument()
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
    const user = userEvent.setup()

    await user.click(within(filaDe('Alumno Legacy')).getByRole('button', { name: 'Editar' }))
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
    const user = userEvent.setup()

    await user.click(within(filaDe('Juan Ignacio Pérez')).getByRole('button', { name: 'Editar' }))
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    expect(
      await screen.findByText('Ya hay un alumno registrado con ese documento.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Editar Alumno' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('restablece la contraseña sin mostrarla en claro y avisa', async () => {
    const restablecerPasswordAlumno = vi.fn(async () => ({ id: 1 }))
    cleanup()
    stubDataSource({ restablecerPasswordAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const user = userEvent.setup()

    await user.click(
      within(filaDe('Juan Ignacio Pérez')).getByRole('button', {
        name: 'Restablecer contraseña',
      }),
    )
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
  })

  it('no restablece si las contraseñas no coinciden', async () => {
    const restablecerPasswordAlumno = vi.fn()
    cleanup()
    stubDataSource({ restablecerPasswordAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const user = userEvent.setup()

    await user.click(
      within(filaDe('Juan Ignacio Pérez')).getByRole('button', {
        name: 'Restablecer contraseña',
      }),
    )
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
    const user = userEvent.setup()

    await user.click(
      within(filaDe('Juan Ignacio Pérez')).getByRole('button', { name: 'Eliminar alumno' }),
    )
    const dialogo = screen.getByRole('dialog', { name: 'Eliminar Alumno' })
    expect(dialogo).toHaveTextContent('Juan Ignacio Pérez')
    expect(dialogo).not.toHaveTextContent('Es una baja lógica')

    await user.click(within(dialogo).getByRole('button', { name: 'Confirmar baja' }))

    expect(eliminarAlumno).toHaveBeenCalledWith(1)
    await waitFor(() => expect(screen.queryByText('Juan Ignacio Pérez')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('dado de baja correctamente')
    expect(screen.queryByRole('dialog', { name: 'Eliminar Alumno' })).not.toBeInTheDocument()
  })

  it('cancela la baja sin modificar el padrón', async () => {
    const eliminarAlumno = vi.fn()
    cleanup()
    stubDataSource({ eliminarAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const user = userEvent.setup()

    await user.click(
      within(filaDe('Juan Ignacio Pérez')).getByRole('button', { name: 'Eliminar alumno' }),
    )
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(eliminarAlumno).not.toHaveBeenCalled()
    expect(screen.getByText('Juan Ignacio Pérez')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('mantiene la confirmación abierta si la baja falla', async () => {
    const eliminarAlumno = vi.fn(async () => {
      throw new Error('El alumno ya está dado de baja.')
    })
    cleanup()
    stubDataSource({ eliminarAlumno })
    renderAppAs('ADMIN', '/admin/alumnos')
    await screen.findByText('Juan Ignacio Pérez')
    const user = userEvent.setup()

    await user.click(
      within(filaDe('Juan Ignacio Pérez')).getByRole('button', { name: 'Eliminar alumno' }),
    )
    await user.click(screen.getByRole('button', { name: 'Confirmar baja' }))

    expect(await screen.findByText('El alumno ya está dado de baja.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Eliminar Alumno' })).toBeInTheDocument()
    expect(filaDe('Juan Ignacio Pérez')).toBeTruthy()
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
