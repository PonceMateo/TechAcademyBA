import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAppAs, resetDataSource, stubBackend, stubDataSource } from '../test/support'

/**
 * Padrón de docentes (9.4).
 *
 * Las columnas se comparan contra la lista completa y en orden, y se verifica el caso que el
 * cliente pidió: el CUIL visible junto al DNI. El ítem deshabilitado de las clases dictadas se
 * comprueba con `disabled`, porque un ítem que "no navega" por no tener onclick y un ítem
 * deshabilitado son cosas distintas y el spec pide la segunda.
 *
 * El CUIL se muestra en la columna con guiones y **se pide en el alta de forma opcional** (D57):
 * el formulario lo arma con prefijo, el DNI de solo lectura y un verificador de un dígito, y envía
 * 11 dígitos o `null`. El teléfono viaja en E.164 y reemplaza al input de texto libre.
 */

const COLUMNAS = [
  'DOCENTE',
  'DNI',
  'CUIL',
  'EMAIL',
  'TELÉFONO',
  'CÁTEDRA O ESPECIALIDAD',
  'COMISIONES ASIGNADAS',
  'ESTADO',
  'ACCIONES',
]

const DOCENTES = [
  ['Profe Martín', '28.114.402', 'CUR-101 · Python Inicial'],
  ['Lic. Laura Benítez', '31.902.118', 'Sin comisión'],
  ['Santi Ads', '33.450.771', 'CUR-103 · Marketing Digital & Ads'],
  ['Dr. Marcelo Ríos', '26.771.905', 'Sin comisión'],
  ['Ing. González', '30.665.330', 'CUR-108 · Java Backend Spring'],
]

/** La fila que devuelve la fuente después de un alta, con la forma que espera la tabla. */
function docenteCreado(datos, extra = {}) {
  return {
    id: 99,
    nombre: `${datos.nombre} ${datos.apellido}`,
    apellido: datos.apellido,
    dni: datos.dni,
    cuil: datos.cuil ?? null,
    email: datos.email,
    telefono: datos.telefono ?? null,
    catedra: null,
    activo: true,
    comisiones: [],
    comisiones_asignadas: 0,
    ...extra,
  }
}

/** Una fila mínima con la forma que devuelve la fuente, para los casos que el ejemplo no tiene. */
function docenteDePrueba(id, nombre) {
  return {
    id,
    nombre,
    dni: `30.000.00${id}`,
    cuil: null,
    email: `docente${id}@techacademy.invalid`,
    telefono: null,
    catedra: null,
    activo: true,
    comisiones: [],
    comisiones_asignadas: 0,
  }
}

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  renderAppAs('ADMIN', '/admin/docentes')
  await screen.findByRole('heading', { name: 'Padrón de Docentes' })
  await screen.findByText('Profe Martín')
})

describe('listado de docentes', () => {
  it('muestra las columnas en el orden que fija el spec', () => {
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(COLUMNAS)
  })

  it('muestra los cinco docentes con su CUIL junto al DNI', () => {
    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1)

    expect(filas.map((fila) => fila.cells[0].textContent)).toEqual(
      DOCENTES.map(([nombre]) => nombre),
    )

    for (const [, dni] of DOCENTES) {
      const fila = filas.find((f) => f.cells[1].textContent === dni)
      expect(fila.cells[2].textContent).toMatch(/^\d{2}-\d{8}-\d$/)
    }
  })

  it('muestra las comisiones reales de cada docente y Sin comisión cuando no tiene', () => {
    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    const asignadas = (nombre) =>
      filas.find((fila) => fila.cells[0].textContent === nombre).cells[6].textContent

    expect(asignadas('Profe Martín')).toBe('CUR-101 · Python Inicial')
    expect(asignadas('Lic. Laura Benítez')).toBe('Sin comisión')
    expect(asignadas('Santi Ads')).toBe('CUR-103 · Marketing Digital & Ads')
    expect(asignadas('Dr. Marcelo Ríos')).toBe('Sin comisión')
    expect(asignadas('Ing. González')).toBe('CUR-108 · Java Backend Spring')
  })

  it('muestra el estado Activa en verde en las cinco filas', () => {
    const estados = screen.getAllByText('Activa')

    expect(estados).toHaveLength(5)
    for (const estado of estados) {
      expect(estado.className).toContain('text-green-800')
    }
  })

  it('muestra los datos de contacto de cada docente', () => {
    const correo = 'profe.martin@techacademy.invalid'

    expect(screen.getByText(correo)).toBeInTheDocument()
    expect(screen.getByText('+54 11 4455-1020')).toBeInTheDocument()
  })

  it('ofrece Editar y Restablecer contraseña en cada fila (historia #11)', () => {
    expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(5)
    expect(screen.getAllByRole('button', { name: 'Restablecer contraseña' })).toHaveLength(5)
  })
})

describe('buscador', () => {
  it('filtra el listado por nombre', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Buscar docente'), 'Santi')

    await waitFor(() => expect(screen.queryByText('Profe Martín')).not.toBeInTheDocument())
    expect(screen.getByText('Santi Ads')).toBeInTheDocument()
  })

  it('busca por apellido sin distinguir mayúsculas ni tildes', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Buscar docente'), 'RÍOS')

    await waitFor(() => expect(screen.queryByText('Profe Martín')).not.toBeInTheDocument())
    expect(screen.getByText('Dr. Marcelo Ríos')).toBeInTheDocument()
  })

  it('dispara la búsqueda con una sola letra y no busca en el medio de la palabra', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Buscar docente'), 'a')

    // Si no se disparara con una letra, el listado inicial seguiría mostrando a todos.
    await waitFor(() => expect(screen.queryByText('Profe Martín')).not.toBeInTheDocument())
    expect(screen.getByText('Santi Ads')).toBeInTheDocument()
    // Laura contiene una `a` en el medio de `Laura`, pero ninguna palabra empieza con `a`.
    expect(screen.queryByText('Lic. Laura Benítez')).not.toBeInTheDocument()
  })

  it('respeta el orden de las palabras de la consulta', async () => {
    const user = userEvent.setup()
    const buscador = screen.getByLabelText('Buscar docente')

    await user.type(buscador, 'santi ads')

    await waitFor(() => expect(screen.queryByText('Profe Martín')).not.toBeInTheDocument())
    expect(screen.getByText('Santi Ads')).toBeInTheDocument()

    await user.clear(buscador)
    await user.type(buscador, 'ads santi')

    expect(await screen.findByText('No se encontraron docentes')).toBeInTheDocument()
  })

  it('filtra por DNI', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Buscar docente'), '30.665.330')

    await waitFor(() => expect(screen.queryByText('Santi Ads')).not.toBeInTheDocument())
    expect(screen.getByText('Ing. González')).toBeInTheDocument()
  })

  it('espera 300 ms desde la última tecla antes de consultar', async () => {
    const buscar = vi.fn(async () => [])
    stubDataSource({ buscarDocentes: buscar })
    vi.useFakeTimers()

    try {
      fireEvent.change(screen.getByLabelText('Buscar docente'), { target: { value: 'r' } })

      expect(buscar).not.toHaveBeenCalled()
      await act(async () => {
        vi.advanceTimersByTime(299)
      })
      expect(buscar).not.toHaveBeenCalled()

      await act(async () => {
        vi.advanceTimersByTime(1)
      })
      expect(buscar).toHaveBeenCalledTimes(1)
      expect(buscar).toHaveBeenCalledWith('r')
    } finally {
      vi.useRealTimers()
    }
  })

  it('descarta la respuesta vieja cuando llega después de una más reciente', async () => {
    const pendientes = new Map()
    const buscar = vi.fn((texto) => {
      if (texto === '') {
        return Promise.resolve([])
      }
      return new Promise((resolver) => pendientes.set(texto, resolver))
    })
    stubDataSource({ buscarDocentes: buscar })
    const user = userEvent.setup()
    const buscador = screen.getByLabelText('Buscar docente')

    await user.type(buscador, 'a')
    await waitFor(() => expect(pendientes.has('a')).toBe(true))
    await user.type(buscador, 'b')
    await waitFor(() => expect(pendientes.has('ab')).toBe(true))

    await act(async () => {
      pendientes.get('ab')([docenteDePrueba(2, 'Beto Nueva')])
    })
    await waitFor(() => expect(screen.getByText('Beto Nueva')).toBeInTheDocument())

    await act(async () => {
      pendientes.get('a')([docenteDePrueba(1, 'Ana Vieja')])
    })
    expect(screen.queryByText('Ana Vieja')).not.toBeInTheDocument()
    expect(screen.getByText('Beto Nueva')).toBeInTheDocument()
  })

  it('muestra primero la coincidencia en la primera palabra del nombre', async () => {
    const rita = docenteDePrueba(1, 'Rita Alonso')
    const alfonso = docenteDePrueba(2, 'Alfonso Pérez')
    stubDataSource({ buscarDocentes: vi.fn(async () => [alfonso, rita]) })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Buscar docente'), 'al')

    await waitFor(() => expect(screen.getByText('Alfonso Pérez')).toBeInTheDocument())
    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(filas.map((fila) => fila.cells[0].textContent)).toEqual(['Alfonso Pérez', 'Rita Alonso'])
  })

  it('vuelve al listado habitual al vaciar el buscador', async () => {
    const user = userEvent.setup()
    const buscador = screen.getByLabelText('Buscar docente')

    await user.type(buscador, 'Santi')
    await waitFor(() => expect(screen.queryByText('Profe Martín')).not.toBeInTheDocument())

    await user.clear(buscador)

    await waitFor(() => expect(screen.getByText('Profe Martín')).toBeInTheDocument())
    expect(screen.getByText('Santi Ads')).toBeInTheDocument()
  })

  it('informa que no encontró docentes', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Buscar docente'), 'Nadie con ese nombre')

    expect(await screen.findByText('No se encontraron docentes')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('alta de docente', () => {
  async function abrir(user) {
    await user.click(screen.getByRole('button', { name: '+ Nuevo Docente' }))
    await screen.findByRole('dialog', { name: 'Nuevo Docente' })
  }

  async function completar(user) {
    await user.type(screen.getByLabelText(/^Nombre/), 'Ada')
    await user.type(screen.getByLabelText(/^Apellido/), 'Lovelace')
    await user.type(screen.getByLabelText(/^DNI/), '30.111.222')
    await user.type(screen.getByLabelText(/^Mail/), 'ada.lovelace@techacademy.invalid')
  }

  it('pide nombre, apellido, DNI, mail, teléfono y un CUIL opcional', async () => {
    const user = userEvent.setup()
    await abrir(user)

    // El CUIL es opcional: el prefijo arranca vacío y el DNI de la parte del medio todavía no
    // tiene dígitos (D57).
    expect(screen.getByLabelText('CUIL')).toHaveValue('')
    expect(screen.getByLabelText('Parte del DNI en el CUIL')).toHaveValue('')
    expect(screen.getByLabelText('Dígito verificador del CUIL')).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Guardar Docente' }))

    expect(await screen.findByText('El nombre es obligatorio.')).toBeInTheDocument()
    expect(await screen.findByText('El apellido es obligatorio.')).toBeInTheDocument()
    expect(await screen.findByText('El DNI es obligatorio.')).toBeInTheDocument()
    expect(await screen.findByText('El mail es obligatorio.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Nuevo Docente' })).toBeInTheDocument()
  })

  it('envía el CUIL completo en 11 dígitos', async () => {
    const crear = vi.fn(async (datos) => docenteCreado(datos))
    stubDataSource({ crearDocente: crear })
    const user = userEvent.setup()
    await abrir(user)
    await completar(user)

    await user.selectOptions(screen.getByLabelText('CUIL'), '27')
    // Los 8 del medio salen del DNI del formulario y no se pueden editar por separado.
    expect(screen.getByLabelText('Parte del DNI en el CUIL')).toHaveValue('30111222')
    await user.type(screen.getByLabelText('Dígito verificador del CUIL'), '5')
    await user.click(screen.getByRole('button', { name: 'Guardar Docente' }))

    await waitFor(() => expect(crear).toHaveBeenCalled())
    expect(crear.mock.calls[0][0].cuil).toBe('27301112225')
  })

  it('manda el CUIL en null cuando no se carga', async () => {
    const crear = vi.fn(async (datos) => docenteCreado(datos))
    stubDataSource({ crearDocente: crear })
    const user = userEvent.setup()
    await abrir(user)
    await completar(user)

    await user.click(screen.getByRole('button', { name: 'Guardar Docente' }))

    await waitFor(() => expect(crear).toHaveBeenCalled())
    expect(crear.mock.calls[0][0].cuil).toBeNull()
  })

  it('no envía un CUIL parcial', async () => {
    const crear = vi.fn(async (datos) => docenteCreado(datos))
    stubDataSource({ crearDocente: crear })
    const user = userEvent.setup()
    await abrir(user)
    await completar(user)

    await user.selectOptions(screen.getByLabelText('CUIL'), '20')
    await user.click(screen.getByRole('button', { name: 'Guardar Docente' }))

    expect(
      await screen.findByText(
        'El CUIL está incompleto: elegí el prefijo y escribí el verificador.',
      ),
    ).toBeInTheDocument()
    expect(crear).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Nuevo Docente' })).toBeInTheDocument()
  })

  it('limpia el verificador al cambiar el DNI', async () => {
    const user = userEvent.setup()
    await abrir(user)
    await completar(user)

    await user.selectOptions(screen.getByLabelText('CUIL'), '20')
    await user.type(screen.getByLabelText('Dígito verificador del CUIL'), '5')
    expect(screen.getByLabelText('Dígito verificador del CUIL')).toHaveValue('5')

    await user.clear(screen.getByLabelText(/^DNI/))

    expect(screen.getByLabelText('Dígito verificador del CUIL')).toHaveValue('')
  })

  it('completa con un cero el DNI de 7 dígitos en el CUIL', async () => {
    const user = userEvent.setup()
    await abrir(user)
    await completar(user)

    await user.clear(screen.getByLabelText(/^DNI/))
    await user.type(screen.getByLabelText(/^DNI/), '3011122')

    expect(screen.getByLabelText('Parte del DNI en el CUIL')).toHaveValue('03011122')
  })

  it('rechaza un DNI que no tiene la forma del padrón', async () => {
    const crear = vi.fn(async (datos) => docenteCreado(datos))
    stubDataSource({ crearDocente: crear })
    const user = userEvent.setup()
    await abrir(user)
    await completar(user)

    await user.clear(screen.getByLabelText(/^DNI/))
    await user.type(screen.getByLabelText(/^DNI/), '30.ABC.222')
    await user.click(screen.getByRole('button', { name: 'Guardar Docente' }))

    expect(await screen.findByText('El DNI debe tener 7 u 8 dígitos.')).toBeInTheDocument()
    expect(crear).not.toHaveBeenCalled()
  })

  it('rechaza un mail que no tiene forma', async () => {
    const crear = vi.fn(async (datos) => docenteCreado(datos))
    stubDataSource({ crearDocente: crear })
    const user = userEvent.setup()
    await abrir(user)
    await completar(user)

    await user.clear(screen.getByLabelText(/^Mail/))
    await user.type(screen.getByLabelText(/^Mail/), 'ada@')
    await user.click(screen.getByRole('button', { name: 'Guardar Docente' }))

    expect(await screen.findByText('El mail no tiene un formato válido.')).toBeInTheDocument()
    expect(crear).not.toHaveBeenCalled()
  })

  it('envía el teléfono en E.164', async () => {
    const crear = vi.fn(async (datos) => docenteCreado(datos))
    stubDataSource({ crearDocente: crear })
    const user = userEvent.setup()
    await abrir(user)
    await completar(user)

    await user.click(screen.getByLabelText('Teléfono'))
    await user.paste('+54 9 11 1234-5678')
    await user.click(screen.getByRole('button', { name: 'Guardar Docente' }))

    await waitFor(() => expect(crear).toHaveBeenCalled())
    expect(crear.mock.calls[0][0].telefono).toBe('+5491112345678')
  })

  it('da de alta el docente y lo agrega al padrón con el nombre junto', async () => {
    const user = userEvent.setup()
    await abrir(user)
    await completar(user)

    await user.click(screen.getByRole('button', { name: 'Guardar Docente' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Nuevo Docente' })).not.toBeInTheDocument(),
    )
    expect(await screen.findByText('Docente Ada Lovelace dado de alta.')).toBeInTheDocument()
    expect(await screen.findByText('ada.lovelace@techacademy.invalid')).toBeInTheDocument()
  })

  it('deja el formulario abierto y muestra el motivo cuando la fuente rechaza el alta', async () => {
    // El rechazo lo produce la fuente, no la pantalla: el ejemplo acepta cualquier mail, así que
    // se reemplaza `crearDocente` por una que falla con el mensaje del backend (D36).
    stubDataSource({
      crearDocente: vi.fn(async () => {
        throw new Error('Ya existe un docente con ese DNI: 28.114.402 — Rita Molina.')
      }),
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '+ Nuevo Docente' }))
    await screen.findByRole('dialog', { name: 'Nuevo Docente' })
    await completar(user)

    await user.click(screen.getByRole('button', { name: 'Guardar Docente' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un docente con ese DNI')
    expect(screen.getByRole('dialog', { name: 'Nuevo Docente' })).toBeInTheDocument()
    expect(screen.queryByText(/dado de alta\./)).not.toBeInTheDocument()
    // Lo que el operador completó sigue ahí: reescribir el DNI a mano es el error más caro.
    expect(screen.getByLabelText(/^DNI/)).toHaveValue('30.111.222')
  })
})

/** La fila de la tabla de un docente, para no depender del orden del listado. */
function filaDelDocente(nombre) {
  return within(screen.getByRole('table'))
    .getAllByRole('row')
    .find((fila) => fila.cells[0].textContent === nombre)
}

async function abrirEdicion(user, nombre) {
  await user.click(within(filaDelDocente(nombre)).getByRole('button', { name: 'Editar' }))
  await screen.findByRole('dialog', { name: 'Editar Docente' })
}

async function abrirRestablecimiento(user, nombre) {
  await user.click(
    within(filaDelDocente(nombre)).getByRole('button', { name: 'Restablecer contraseña' }),
  )
  await screen.findByRole('dialog', { name: 'Restablecer contraseña' })
}

describe('edición de docente (historia #11)', () => {
  it('abre el modal precargado, normaliza el teléfono y arma el CUIL con el DNI actual', async () => {
    stubDataSource({
      buscarDocentes: vi.fn(async () => [
        {
          id: 9,
          nombre: 'Rita Molina',
          nombres: 'Rita',
          apellido: 'Molina',
          dni: '30.111.222',
          cuil: '27-30111222-6',
          email: 'rita.molina@techacademy.invalid',
          telefono: '+54 11 4000-1000',
          catedra: null,
          activo: true,
          comisiones: [{ id: 7, codigo: 'CUR107-1', nombre: 'Datos' }],
          comisiones_asignadas: 1,
        },
      ]),
    })
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Buscar docente'), 'rita')
    await waitFor(() => expect(screen.queryByText('Profe Martín')).not.toBeInTheDocument())

    await abrirEdicion(user, 'Rita Molina')

    // El nombre de pila y el apellido se precargan por separado: si el formulario metiera el
    // apellido dentro del nombre, guardar sin cambios lo duplicaría.
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue('Rita')
    expect(screen.getByLabelText(/^Apellido/)).toHaveValue('Molina')
    expect(screen.getByLabelText(/^DNI/)).toHaveValue('30.111.222')
    expect(screen.getByLabelText(/^Mail/)).toHaveValue('rita.molina@techacademy.invalid')
    // El valor guardado se puede interpretar, así que el control lo muestra normalizado (D57).
    expect(screen.getByLabelText(/^Teléfono/)).toHaveValue('+54 11 4000 1000')
    // El prefijo y el verificador salen del CUIL guardado; los 8 del medio, del DNI actual.
    expect(screen.getByLabelText('CUIL')).toHaveValue('27')
    expect(screen.getByLabelText('Parte del DNI en el CUIL')).toHaveValue('30111222')
    expect(screen.getByLabelText('Dígito verificador del CUIL')).toHaveValue('6')
  })

  it('guarda los cambios, actualiza la fila y conserva las comisiones asignadas', async () => {
    const user = userEvent.setup()
    await abrirEdicion(user, 'Profe Martín')

    await user.clear(screen.getByLabelText(/^Teléfono/))
    await user.click(screen.getByLabelText(/^Teléfono/))
    await user.paste('+54 9 11 9999-0000')
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Editar Docente' })).not.toBeInTheDocument(),
    )
    expect(await screen.findByText('Docente Profe Martín actualizado.')).toBeInTheDocument()
    expect(filaDelDocente('Profe Martín').cells[4].textContent).toBe('+5491199990000')
    // La edición no vuelve a resolver las comisiones: la fila que ya estaba en pantalla las
    // conserva (D52).
    expect(filaDelDocente('Profe Martín').cells[6].textContent).toBe('CUR-101 · Python Inicial')
  })

  it('guarda el teléfono en E.164 y el CUIL del docente sin tocarlos', async () => {
    const editar = vi.fn(async (id, datos) => docenteCreado(datos, { id }))
    stubDataSource({ editarDocente: editar })
    const user = userEvent.setup()
    await abrirEdicion(user, 'Profe Martín')

    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    await waitFor(() => expect(editar).toHaveBeenCalled())
    const [, datos] = editar.mock.calls[0]
    // El valor legacy se normalizó al abrir y el CUIL se recompuso con el DNI actual.
    expect(datos.telefono).toBe('+541144551020')
    expect(datos.cuil).toBe('20281144024')
  })

  it('abre sin CUIL los docentes que no lo tienen y manda null al guardar', async () => {
    const editar = vi.fn(async (id, datos) => docenteCreado(datos, { id }))
    stubDataSource({
      buscarDocentes: vi.fn(async () => [
        { ...docenteDePrueba(8, 'Sofi Sin Cuil'), nombres: 'Sofi', apellido: 'Suárez' },
      ]),
      editarDocente: editar,
    })
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Buscar docente'), 'sofi')
    await screen.findByText('Sofi Sin Cuil')
    await abrirEdicion(user, 'Sofi Sin Cuil')

    expect(screen.getByLabelText('CUIL')).toHaveValue('')
    expect(screen.getByLabelText('Dígito verificador del CUIL')).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    await waitFor(() => expect(editar).toHaveBeenCalled())
    expect(editar.mock.calls[0][1].cuil).toBeNull()
  })

  it('rechaza un teléfono legacy que no se puede interpretar', async () => {
    const editar = vi.fn(async (id, datos) => docenteCreado(datos, { id }))
    stubDataSource({
      buscarDocentes: vi.fn(async () => [
        { ...docenteDePrueba(7, 'Nora Legacy'), telefono: 'particular' },
      ]),
      editarDocente: editar,
    })
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Buscar docente'), 'nora')
    await screen.findByText('Nora Legacy')
    await abrirEdicion(user, 'Nora Legacy')

    // El valor crudo se conserva y no hay aviso al cargar; el rechazo aparece al intentar guardar.
    expect(screen.getByLabelText(/^Teléfono/)).toHaveValue('particular')
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    expect(
      await screen.findByText('El teléfono no es válido: elegí el país y escribí el número.'),
    ).toBeInTheDocument()
    expect(editar).not.toHaveBeenCalled()
  })

  it('rechaza un DNI que ya pertenece a otro docente y deja el modal abierto', async () => {
    const user = userEvent.setup()
    await abrirEdicion(user, 'Profe Martín')

    await user.clear(screen.getByLabelText(/^DNI/))
    await user.type(screen.getByLabelText(/^DNI/), '31.902.118')
    // Cambiar el DNI limpia el verificador, así que se vuelve a escribir para que el CUIL quede
    // completo y el formulario llegue a la fuente (D57).
    await user.type(screen.getByLabelText('Dígito verificador del CUIL'), '4')
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ya hay un docente registrado con ese DNI.',
    )
    expect(screen.getByRole('dialog', { name: 'Editar Docente' })).toBeInTheDocument()
    expect(filaDelDocente('Profe Martín').cells[1].textContent).toBe('28.114.402')
  })

  it('muestra el motivo que devuelve la fuente y conserva lo que se escribió', async () => {
    stubDataSource({
      editarDocente: vi.fn(async () => {
        throw new Error('El email ada@techacademy.invalid ya está registrado en el padrón de alumnos.')
      }),
    })
    const user = userEvent.setup()
    await abrirEdicion(user, 'Profe Martín')

    await user.clear(screen.getByLabelText(/^Mail/))
    await user.type(screen.getByLabelText(/^Mail/), 'ada@techacademy.invalid')
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('padrón de alumnos')
    expect(screen.getByRole('dialog', { name: 'Editar Docente' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Mail/)).toHaveValue('ada@techacademy.invalid')
  })
})

describe('restablecimiento de contraseña del docente (historia #11)', () => {
  it('avisa que la contraseña se cambia en el próximo ingreso y la restablece', async () => {
    const restablecer = vi.fn(async () => ({ id: 1 }))
    stubDataSource({ restablecerPasswordDocente: restablecer })
    const user = userEvent.setup()
    await abrirRestablecimiento(user, 'Profe Martín')

    expect(screen.getByRole('dialog', { name: 'Restablecer contraseña' }).textContent).toContain(
      'deberá cambiarla en su próximo ingreso',
    )

    await user.type(screen.getByLabelText(/^Nueva contraseña/), 'NuevaClave2026')
    await user.type(screen.getByLabelText(/^Confirmar contraseña/), 'NuevaClave2026')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Restablecer contraseña' }),
    )

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Restablecer contraseña' })).not.toBeInTheDocument(),
    )
    expect(restablecer).toHaveBeenCalledWith(1, 'NuevaClave2026')
    expect(
      await screen.findByText(
        'Contraseña de Profe Martín restablecida. Deberá cambiarla en su próximo ingreso.',
      ),
    ).toBeInTheDocument()
  })

  it('no envía la operación cuando las contraseñas no coinciden', async () => {
    const restablecer = vi.fn(async () => ({}))
    stubDataSource({ restablecerPasswordDocente: restablecer })
    const user = userEvent.setup()
    await abrirRestablecimiento(user, 'Profe Martín')

    await user.type(screen.getByLabelText(/^Nueva contraseña/), 'NuevaClave2026')
    await user.type(screen.getByLabelText(/^Confirmar contraseña/), 'OtraClave2026')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Restablecer contraseña' }),
    )

    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument()
    expect(restablecer).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Restablecer contraseña' })).toBeInTheDocument()
  })

  it('no envía la operación con una contraseña de menos de 8 caracteres', async () => {
    const restablecer = vi.fn(async () => ({}))
    stubDataSource({ restablecerPasswordDocente: restablecer })
    const user = userEvent.setup()
    await abrirRestablecimiento(user, 'Profe Martín')

    await user.type(screen.getByLabelText(/^Nueva contraseña/), 'corta')
    await user.type(screen.getByLabelText(/^Confirmar contraseña/), 'corta')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Restablecer contraseña' }),
    )

    expect(
      await screen.findByText('La contraseña debe tener al menos 8 caracteres.'),
    ).toBeInTheDocument()
    expect(restablecer).not.toHaveBeenCalled()
  })
})

describe('acciones sin contenido detrás', () => {
  it('muestra el control de clases dictadas deshabilitado y con Próximamente', async () => {
    const user = userEvent.setup()

    const boton = screen.getByRole('button', { name: 'Control de clases dictadas' })
    expect(boton).toBeDisabled()
    expect(screen.getByText('Próximamente')).toBeInTheDocument()

    await user.click(boton)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})
