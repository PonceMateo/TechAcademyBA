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
  'COMISIÓN ASIGNADA',
  'CATEGORÍA ARANCELARIA',
  'ACCESO PLATAFORMA',
]

const COLUMNAS_EMPRESAS = ['RAZÓN SOCIAL', 'CUIT', 'PREFERENCIA FACTURA', 'NÓMINA DE EMPLEADOS']

const ALTA = {
  documento: '30.111.222',
  nombre: 'Rocío Álvarez',
  email: 'rocio.alvarez@techacademy.invalid',
  telefono: '011 4000-0005',
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
  await user.type(screen.getByLabelText(/^Teléfono/), datos.telefono)
}

describe('padrón de alumnos', () => {
  it('muestra el buscador deshabilitado con la leyenda Próximamente', () => {
    const buscador = screen.getByLabelText(/^Buscar alumno/)

    expect(buscador).toHaveAttribute('placeholder', 'Buscar por DNI o Nombre…')
    expect(buscador).toBeDisabled()
    expect(screen.getByText('(Próximamente)')).toBeInTheDocument()
  })

  it('no filtra ni navega desde el buscador', async () => {
    const user = userEvent.setup()
    const buscador = screen.getByLabelText(/^Buscar alumno/)

    await user.type(buscador, 'Valeria')

    expect(buscador).toHaveValue('')
    expect(screen.getByText('Juan Ignacio Pérez')).toBeInTheDocument()
    expect(screen.getByText('Valeria Rossi')).toBeInTheDocument()
  })

  it('no llama a buscarAlumnos, porque la búsqueda es la historia #16', async () => {
    const buscarAlumnos = vi.fn(async () => {
      throw new Error('la pantalla no debería buscar')
    })
    cleanup()
    stubDataSource({ buscarAlumnos })
    renderAppAs('ADMIN', '/admin/alumnos')

    await screen.findByText('Juan Ignacio Pérez')

    expect(buscarAlumnos).not.toHaveBeenCalled()
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

  it('muestra la categoría con su color', () => {
    expect(filaDe('Juan Ignacio Pérez').cells[4].textContent).toContain('PARTICULAR')
    expect(filaDe('Juan Ignacio Pérez').cells[4].querySelector('.text-slate-700')).not.toBeNull()
    expect(filaDe('Agustina Benítez').cells[4].textContent).toContain('BECADO PARCIAL')
    expect(filaDe('Agustina Benítez').cells[4].querySelector('.text-violet-800')).not.toBeNull()
  })

  it('muestra el porcentaje de descuento del becado parcial', () => {
    expect(filaDe('Camila Rodríguez').cells[4]).toHaveTextContent('50% de descuento')
    expect(filaDe('Agustina Benítez').cells[4]).toHaveTextContent('50% de descuento')
  })

  it('deja las categorías con colores distintos entre sí', () => {
    // BECADO TOTAL y CORPORATIVO son del enum y del spec, pero el padrón del maquetado no tiene
    // filas de esas dos. Lo verificable acá es que las dos que aparecen no comparten color.
    const colorDe = (nombre) => {
      const insignia = filaDe(nombre).cells[4].querySelector('[data-ui="badge"]')
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

  it('muestra cada bloqueo con su causa al lado del estado', () => {
    const bloqueos = screen.getAllByText('BLOQUEADO')

    expect(bloqueos).toHaveLength(2)
    for (const bloqueo of bloqueos) {
      expect(bloqueo.className).toContain('text-red-800')
    }

    expect(filaDe('Agustina Benítez').cells[5]).toHaveTextContent('comprobante ilegible')
    expect(filaDe('Valeria Rossi').cells[5]).toHaveTextContent('debe saldo')
  })

  it('deja Sin comisión y guiones en la fila del alumno sin inscripción', async () => {
    cleanup()
    stubDataSource({
      listarAlumnos: async () => [
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
    expect(fila.cells[3]).toHaveTextContent('Sin comisión')
    expect(fila.cells[4]).toHaveTextContent('—')
    expect(fila.cells[5]).toHaveTextContent('—')
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
      listarAlumnos: async () => {
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
