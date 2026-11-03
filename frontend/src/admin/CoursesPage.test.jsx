import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  currentPath,
  renderAppAs,
  resetDataSource,
  stubBackend,
  stubDataSource,
} from '../test/support'

/**
 * Cursos y comisiones (9.3), en las dos vistas de la sección.
 *
 * Las columnas se comparan contra la lista completa y en orden, porque el spec las fija literales
 * y en ese orden. Y la `Sede`, que es **opcional en toda modalidad**, se prueba en las dos
 * direcciones: presencial e híbrida sin sede guardan, y el campo no se renderiza para `Virtual`.
 * Falta el caso inverso al 422 —`Virtual` con sede— porque el formulario no tiene forma de
 * mandarlo: el `select` no está renderizado y el `sede_id` se deriva de `mostrarSede`.
 *
 * **Cada vista se abre en la ruta que le corresponde.** El catálogo es `/admin/cursos` y las
 * comisiones de un curso son `/admin/cursos/:codigo`: por eso los bloques que miran la tabla abren
 * la ruta del curso y los que abren el modal de comisión desde el catálogo, que es el único lugar
 * donde el selector de curso se puede elegir.
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
  'PERÍODO',
  'CUPO MÁX.',
  'VACANTES',
  'ARANCEL',
  'ACCIONES',
]

/** La ruta del catálogo de cursos y la de un curso del ejemplo. */
const RUTA_CATALOGO = '/admin/cursos'
const RUTA_CURSO = '/admin/cursos/CUR-101'
const RUTA_CURSO_LLENO = '/admin/cursos/CUR-104'

async function abrir(ruta) {
  resetDataSource()
  stubBackend()
  renderAppAs('ADMIN', ruta)
}

async function abrirCatalogo() {
  await abrir(RUTA_CATALOGO)
  await screen.findByRole('heading', { name: 'Cursos' })
}

async function abrirCurso(ruta = RUTA_CURSO) {
  await abrir(ruta)
  await screen.findByRole('heading', { name: 'Comisiones Activas' })
}

/**
 * Los horarios con los que se completa el selector: los siete días con el rango por defecto.
 *
 * El selector abre sin días activos, así que `cargarHorarios` los prende uno por uno antes de
 * confirmar; el resto de los tests comparte ese resultado y no tiene que repetir siete objetos.
 */
const DIAS_DE_LA_SEMANA = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM']
const HORARIOS_POR_DEFECTO = DIAS_DE_LA_SEMANA.map((dia) => ({
  dia,
  inicio: '19:00',
  fin: '21:00',
}))
const TEXTO_POR_DEFECTO = 'Lun, Mar, Mié, Jue, Vie, Sáb y Dom 19-21hs'

/** Carga el horario por el selector, que es la única forma de cargarlo (historia #48). */
async function cargarHorarios(user) {
  await user.click(screen.getByRole('button', { name: /Agregar horarios|Modificar horarios/ }))
  await screen.findByRole('dialog', { name: 'Horario de cursada' })
  for (const nombre of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) {
    await user.click(screen.getByRole('button', { name: nombre }))
  }
  await user.click(screen.getByRole('button', { name: 'Listo' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Horario de cursada' })).not.toBeInTheDocument(),
  )
}

async function abrirModal(user) {
  await user.click(screen.getByRole('button', { name: '+ Nueva Comisión' }))
  await screen.findByRole('dialog', { name: 'Crear Nueva Comisión' })
}

/** El botón que abre un curso del grid: la tarjeta es el botón y su nombre es el curso. */
function tarjetaDe(nombre) {
  return screen.getByRole('button', { name: new RegExp(nombre) })
}

/** Las filas de la tabla de comisiones, sin la del encabezado. */
function filasDeComisiones() {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1)
}

/**
 * Completa lo que el alta de comisión exige.
 *
 * El curso se elige por **nombre** y no por valor: el `value` de la opción es el identificador,
 * que el ejemplo asigna por orden de aparición. Un test que escribiera `1` acá pasaría hoy y
 * mañana significaría otra cosa.
 *
 * `conCurso: false` es el caso de abrir el modal desde dentro de un curso: ahí el selector ya
 * viene elegido y bloqueado, y no hay nada que elegir.
 */
async function completarComision(
  user,
  { modalidad = 'VIRTUAL', sede = null, conCurso = true, cupo = '20' } = {},
) {
  await user.selectOptions(screen.getByLabelText(/^Modalidad/), modalidad)
  if (conCurso) {
    const cursos = screen.getByLabelText(/^Curso \/ Programa/)
    await user.selectOptions(cursos, within(cursos).getByRole('option', { name: 'Python Inicial' }))
  }
  await user.selectOptions(screen.getByLabelText(/^Docente Asignado/), '1')
  await cargarHorarios(user)
  // El período de cursada es obligatorio en el alta (historia #49): dos semanas del cuatrimestre.
  await user.type(screen.getByLabelText(/Fecha de Inicio de la Cursada/), '2026-08-03')
  await user.type(screen.getByLabelText(/Fecha de Fin de la Cursada/), '2026-08-14')
  if (cupo !== '') {
    await user.type(screen.getByLabelText(/Cupo Máximo/), cupo)
  }
  await user.type(screen.getByLabelText(/Valor de Arancel de Comisión/), '52000')
  if (sede) {
    await user.selectOptions(screen.getByLabelText(/^Sede/), sede)
  }
}

/** Crea un curso desde el catálogo y espera el aviso que confirma el alta. */
async function crearCurso(user, nombre, descripcion = '') {
  await user.click(screen.getByRole('button', { name: '+ Nuevo Curso' }))
  await screen.findByRole('dialog', { name: 'Crear Nuevo Curso' })
  await user.type(screen.getByLabelText(/Nombre del Curso/), nombre)
  if (descripcion !== '') {
    await user.type(screen.getByLabelText(/Descripción/), descripcion)
  }
  await user.click(screen.getByRole('button', { name: 'Guardar Curso' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Crear Nuevo Curso' })).not.toBeInTheDocument(),
  )
}

describe('vista de cursos', () => {
  beforeEach(abrirCatalogo)

  it('muestra una tarjeta por curso del catálogo con su código y su número de comisiones', () => {
    expect(screen.getByText('10 en el catálogo')).toBeInTheDocument()

    const tarjeta = tarjetaDe('Python Inicial')

    expect(tarjeta).toHaveTextContent('CUR-101')
    expect(tarjeta).toHaveTextContent('1 comisión')
    expect(tarjeta).toHaveTextContent('Abrir comisiones')
  })

  it('abre el curso de la tarjeta y muestra la tabla de sus comisiones', async () => {
    const user = userEvent.setup()
    await user.click(tarjetaDe('Diseño UX/UI Avanzado'))

    expect(currentPath()).toBe('/admin/cursos/CUR-104')
    expect(await screen.findByRole('heading', { name: 'Comisiones Activas' })).toBeInTheDocument()
    expect(screen.getByText('Diseño UX/UI Avanzado · CUR-104')).toBeInTheDocument()
    expect(filasDeComisiones().map((fila) => fila.cells[0].textContent)).toEqual(['CUR-104'])
  })

  it('abre el mismo curso con el código escrito en minúsculas', async () => {
    // El modelo deduplica por código normalizado (D6), y la ruta usa el mismo criterio: `cur-101`
    // y `CUR-101` son el mismo curso y no dos.
    await abrir('/admin/cursos/cur-101')

    expect(await screen.findByText('Python Inicial · CUR-101')).toBeInTheDocument()
    expect(filasDeComisiones().map((fila) => fila.cells[0].textContent)).toEqual(['CUR-101'])
  })

  it('muestra las dos acciones de alta del catálogo', () => {
    expect(screen.getByRole('button', { name: '+ Nueva Comisión' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Nuevo Curso' })).toBeInTheDocument()
  })

  it('muestra el buscador habilitado', () => {
    const input = screen.getByLabelText(/Buscar curso/)
    expect(input).not.toBeDisabled()
  })

  it('filtra el grid por nombre, sin distinguir mayúsculas', async () => {
    const user = userEvent.setup()
    const input = screen.getByLabelText(/Buscar curso/)
    await user.type(input, 'python')
    expect(screen.getByText('Python Inicial')).toBeInTheDocument()
    expect(screen.queryByText('Java Backend Spring')).not.toBeInTheDocument()
  })

  it('muestra mensaje cuando no hay cursos coincidentes', async () => {
    const user = userEvent.setup()
    const input = screen.getByLabelText(/Buscar curso/)
    await user.type(input, 'zzzz')
    expect(screen.getByText('No se encontraron cursos.')).toBeInTheDocument()
  })

  it('restaura el catálogo al vaciar la búsqueda', async () => {
    const user = userEvent.setup()
    const input = screen.getByLabelText(/Buscar curso/)
    await user.type(input, 'python')
    await user.clear(input)
    expect(screen.getByText('Java Backend Spring')).toBeInTheDocument()
  })

  it('pone el curso recién creado en el catálogo con cero comisiones', async () => {
    // Un curso sin comisiones es el caso que la tabla plana no tenía dónde mostrar: por eso el
    // grid muestra el catálogo y no las comisiones.
    const user = userEvent.setup()
    await crearCurso(user, 'Excel Intermedio', 'Planillas para el trabajo diario.')

    const tarjeta = tarjetaDe('Excel Intermedio')

    expect(tarjeta).toHaveTextContent('Planillas para el trabajo diario.')
    expect(tarjeta).toHaveTextContent('0 comisiones')
  })

  it('muestra un guion en el curso que no tiene descripción', () => {
    // Ningún curso del ejemplo trae descripción: el guion dice que falta, sin inventar texto.
    expect(tarjetaDe('Power BI')).toHaveTextContent('—')
  })

  it('no ofrece ningún control de edición de curso', () => {
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /modificar/i })).not.toBeInTheDocument()
  })
})

describe('vista de comisiones del curso', () => {
  beforeEach(() => abrirCurso())

  it('muestra el chip del catálogo y las acciones de la vista', () => {
    expect(screen.getByText('10 en el catálogo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Nueva Comisión' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver a cursos' })).toBeInTheDocument()
  })

  it('no ofrece el alta de curso dentro de un curso', () => {
    // Dentro de un curso no hay nada que dar de alta del curso: es el mismo que está abierto.
    expect(screen.queryByRole('button', { name: '+ Nuevo Curso' })).not.toBeInTheDocument()
  })

  it('mantiene marcado el ítem de Cursos y Comisiones', () => {
    // La ruta del curso cuelga de la sección: si el menú dejara de marcar el ítem, la secretaría
    // perdería el lugar donde está.
    expect(screen.getByRole('link', { name: 'Cursos y Comisiones' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('muestra el nombre y el código del curso a la vista', () => {
    expect(screen.getByText('Python Inicial · CUR-101')).toBeInTheDocument()
  })

  it('muestra las columnas en el orden que fija el spec', () => {
    const encabezados = screen.getAllByRole('columnheader').map((th) => th.textContent)

    expect(encabezados).toEqual(COLUMNAS)
  })

  it('muestra las comisiones del curso con su arancel formateado', () => {
    const filas = filasDeComisiones()

    expect(filas.map((fila) => fila.cells[0].textContent)).toEqual(['CUR-101'])
    expect(within(screen.getByRole('table')).getByText('$45.000')).toBeInTheDocument()
  })

  it('muestra el período de cursada en la columna PERÍODO', async () => {
    // `PERÍODO` va después de `HORARIO`: las dos fechas del período de cursada (historia #49).
    expect(filasDeComisiones()[0].cells[4].textContent).toBe('04/08/2026 – 26/11/2026')
  })

  it('no muestra comisiones de otro curso', () => {
    expect(screen.queryByText('CUR-104')).not.toBeInTheDocument()
    expect(within(screen.getByRole('table')).queryByText('$52.000')).not.toBeInTheDocument()
  })

  it('muestra el buscador habilitado', () => {
    const input = screen.getByLabelText(/Buscar comisión/)
    expect(input).not.toBeDisabled()
  })

  it('filtra la tabla por código, docente u horario', async () => {
    const user = userEvent.setup()
    const input = screen.getByLabelText(/Buscar comisión/)
    await user.type(input, 'Martín')
    const filas = filasDeComisiones()
    expect(filas).toHaveLength(1)
    expect(filas[0]).toHaveTextContent('CUR-101')
  })

  it('muestra mensaje cuando no hay comisiones coincidentes', async () => {
    const user = userEvent.setup()
    const input = screen.getByLabelText(/Buscar comisión/)
    await user.type(input, 'zzzz')
    expect(screen.getByText('No se encontraron comisiones.')).toBeInTheDocument()
  })

  it('restaura la tabla al vaciar la búsqueda', async () => {
    const user = userEvent.setup()
    const input = screen.getByLabelText(/Buscar comisión/)
    await user.type(input, 'zzzz')
    await user.clear(input)
    expect(filasDeComisiones().length).toBeGreaterThan(0)
  })

  it('vuelve al catálogo', async () => {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Volver a cursos' }))

    expect(currentPath()).toBe(RUTA_CATALOGO)
    expect(await screen.findByRole('heading', { name: 'Cursos' })).toBeInTheDocument()
  })

  it('ofrece la acción de edición en cada fila de la tabla', () => {
    // Historia #4: la tabla suma la columna ACCIONES con `Editar` por comisión.
    expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(
      filasDeComisiones().length,
    )
    expect(screen.queryByRole('button', { name: /modificar/i })).not.toBeInTheDocument()
  })
})

describe('la comisión cerrada por cupo', () => {
  beforeEach(() => abrirCurso(RUTA_CURSO_LLENO))

  it('marca la comisión sin vacantes con el chip LLENO en rojo', () => {
    const chip = within(filasDeComisiones()[0]).getByText('LLENO')

    expect(chip.className).toContain('text-red-800')
  })
})

describe('las vacantes de una comisión con lugar', () => {
  beforeEach(() => abrirCurso())

  it('deja las vacantes a la vista y sin chip', () => {
    const fila = filasDeComisiones()[0]

    // `VACANTES` es la séptima columna desde la historia #49: `PERÍODO` corrió un lugar las que
    // siguen a `HORARIO`. El chip `LLENO` va dentro de la celda, al lado del 0.
    expect(fila.cells[6].textContent).toBe('7')
    expect(within(fila).queryByText('LLENO')).not.toBeInTheDocument()
  })
})

describe('una ruta de curso que no existe', () => {
  beforeEach(() => abrir('/admin/cursos/CUR-999'))

  it('avisa que el curso no existe y no dibuja la tabla de comisiones', async () => {
    // Una tabla vacía se leería como "este curso no tiene comisiones", que es falso: el curso no
    // está en el catálogo.
    expect(await screen.findByRole('heading', { name: 'Curso no encontrado' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Comisiones Activas' })).not.toBeInTheDocument()
  })

  it('ofrece volver al catálogo', async () => {
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: 'Curso no encontrado' })
    await user.click(screen.getByRole('button', { name: 'Volver a cursos' }))

    expect(await screen.findByRole('heading', { name: 'Cursos' })).toBeInTheDocument()
  })
})

describe('modal de alta', () => {
  beforeEach(abrirCatalogo)

  it('abre con los campos en el orden del spec y los dos botones', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    // `Sede` no está en el patrón: la sede es opcional en toda modalidad y el campo se renderiza
    // solo cuando la modalidad elegida sea `Presencial` o `Híbrido`. El modal abre con `Modalidad`
    // en `Seleccionar…`, así que todavía no corresponde mostrarla.
    const etiquetas = screen
      .getAllByText(
        /^(Curso \/ Programa|Docente Asignado|Días y Horarios|Cupo Máximo|Valor de Arancel de Comisión \(AR\$\)|Modalidad)\*?$/,
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
    ])

    // El `toEqual` de arriba **no** puede probar que la sede no esté: como `Sede` quedó fuera del
    // patrón, `getAllByText` filtra el rótulo y el orden daría igual con el campo renderizado. La
    // aserción que sí falla si el campo aparece va por `queryByLabelText`, que no filtra nada.
    expect(screen.queryByLabelText(/^Sede/)).not.toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar Comisión' })).toBeInTheDocument()
  })

  it('no pide el código de la comisión, porque el sistema lo genera', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    expect(screen.queryByLabelText(/Código Comisión/)).not.toBeInTheDocument()
    expect(screen.getByText(/El código de la comisión/)).toBeInTheDocument()
  })

  it('abre con el horario vacío y ofrece agregarlo', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    expect(screen.getByText('Sin horarios definidos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar horarios' })).toBeInTheDocument()
  })

  it('muestra el horario cargado como chips y cambia el botón a modificarlo', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await cargarHorarios(user)

    expect(screen.getByText(TEXTO_POR_DEFECTO)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modificar horarios' })).toBeInTheDocument()
  })

  it('no guarda sin horarios y muestra el error bajo el campo', async () => {
    const crear = vi.fn()
    stubDataSource({ crearComision: crear })
    const user = userEvent.setup()
    await abrirModal(user)

    await user.selectOptions(screen.getByLabelText(/^Modalidad/), 'VIRTUAL')
    const cursos = screen.getByLabelText(/^Curso \/ Programa/)
    await user.selectOptions(cursos, within(cursos).getByRole('option', { name: 'Python Inicial' }))
    await user.selectOptions(screen.getByLabelText(/^Docente Asignado/), '1')
    await user.type(screen.getByLabelText(/Cupo Máximo/), '20')
    await user.type(screen.getByLabelText(/Valor de Arancel de Comisión/), '52000')
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    expect(await screen.findByText('Agregá al menos un horario.')).toBeInTheDocument()
    expect(crear).not.toHaveBeenCalled()
  })

  it('ofrece las tres modalidades del dominio', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    const opciones = within(screen.getByLabelText(/^Modalidad/))
      .getAllByRole('option')
      .map((opcion) => opcion.textContent)

    expect(opciones).toEqual(['Seleccionar…', 'Virtual', 'Presencial', 'Híbrido'])
  })

  it('deja el selector de curso vacío y editable desde el catálogo', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    expect(screen.getByLabelText(/^Curso \/ Programa/)).toHaveValue('')
    expect(screen.getByLabelText(/^Curso \/ Programa/)).toBeEnabled()
  })

  it('guarda una modalidad presencial sin sede, porque la sede es opcional', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await completarComision(user, { modalidad: 'PRESENCIAL' })
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Crear Nueva Comisión' }),
      ).not.toBeInTheDocument(),
    )
    expect(await screen.findByText('Comisión CUR-101-2 creada.')).toBeInTheDocument()
  })

  it('guarda una modalidad híbrida sin sede, por la misma razón', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await completarComision(user, { modalidad: 'HIBRIDO' })
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Crear Nueva Comisión' }),
      ).not.toBeInTheDocument(),
    )
    expect(await screen.findByText('Comisión CUR-101-2 creada.')).toBeInTheDocument()
  })

  it('no manda la sede cuando la modalidad es Virtual, aunque se haya elegido antes', async () => {
    // El bug que cubre: el `select` de sede se desmonta al cambiar a Virtual, pero el valor elegido
    // queda en el estado del formulario. Si el payload lo leyera, mandaría una sede en una comisión
    // virtual y el CHECK `modalidad_virtual_sin_sede` de la base la rechazaría con 422. Por eso el
    // `sede_id` se deriva de `mostrarSede` y no de `campos.sede`.
    const crear = vi.fn(async () => ({
      id: 99,
      codigo: 'CUR-101-2',
      curso: { codigo: 'CUR-101', nombre: 'Python Inicial' },
      docente_id: 1,
      docente_nombre: 'Profe Martín',
      horarios: HORARIOS_POR_DEFECTO,
      dias_horarios: TEXTO_POR_DEFECTO,
      cupo_maximo: 20,
      arancel: 52000,
      vacantes: 20,
      modalidad: 'VIRTUAL',
      sede_id: null,
      sede_nombre: null,
    }))
    stubDataSource({ crearComision: crear })

    const user = userEvent.setup()
    await abrirModal(user)

    await completarComision(user, { modalidad: 'PRESENCIAL', sede: '1' })
    await user.selectOptions(screen.getByLabelText(/^Modalidad/), 'VIRTUAL')
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1))
    expect(crear.mock.calls[0][0]).toEqual({
      curso_id: 1,
      docente_id: 1,
      horarios: HORARIOS_POR_DEFECTO,
      fecha_inicio: '2026-08-03',
      fecha_fin: '2026-08-14',
      arancel: 52000,
      cupo_maximo: 20,
      modalidad: 'VIRTUAL',
      sede_id: null,
    })
  })

  it('no renderiza el campo Sede cuando la modalidad es Virtual', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await user.selectOptions(screen.getByLabelText(/^Modalidad/), 'VIRTUAL')

    expect(screen.queryByLabelText(/^Sede/)).not.toBeInTheDocument()
  })

  it('guarda una modalidad virtual sin sede y muestra el código derivado', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await completarComision(user, { modalidad: 'VIRTUAL' })
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Crear Nueva Comisión' }),
      ).not.toBeInTheDocument(),
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
      horarios: HORARIOS_POR_DEFECTO,
      dias_horarios: TEXTO_POR_DEFECTO,
      cupo_maximo: 20,
      arancel: 52000,
      vacantes: 20,
      modalidad: 'VIRTUAL',
      sede_id: null,
      sede_nombre: null,
    }))
    stubDataSource({ crearComision: crear })

    const user = userEvent.setup()
    await abrirModal(user)
    await completarComision(user, { modalidad: 'VIRTUAL' })
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1))
    expect(crear.mock.calls[0][0]).toEqual({
      curso_id: 1,
      docente_id: 1,
      horarios: HORARIOS_POR_DEFECTO,
      fecha_inicio: '2026-08-03',
      fecha_fin: '2026-08-14',
      arancel: 52000,
      cupo_maximo: 20,
      modalidad: 'VIRTUAL',
      sede_id: null,
    })
  })

  it('exige las dos fechas del período antes de guardar', async () => {
    const crear = vi.fn()
    stubDataSource({ crearComision: crear })
    const user = userEvent.setup()
    await abrirModal(user)

    await user.selectOptions(screen.getByLabelText(/^Modalidad/), 'VIRTUAL')
    const cursos = screen.getByLabelText(/^Curso \/ Programa/)
    await user.selectOptions(cursos, within(cursos).getByRole('option', { name: 'Python Inicial' }))
    await user.selectOptions(screen.getByLabelText(/^Docente Asignado/), '1')
    await cargarHorarios(user)
    await user.type(screen.getByLabelText(/Cupo Máximo/), '20')
    await user.type(screen.getByLabelText(/Valor de Arancel de Comisión/), '52000')
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    expect(
      await screen.findByText('Indicá la fecha de inicio de la cursada.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Indicá la fecha de fin de la cursada.')).toBeInTheDocument()
    expect(crear).not.toHaveBeenCalled()
  })

  it('no guarda con la fecha de fin anterior a la de inicio', async () => {
    // El orden lo comprueba el formulario antes de enviar, así que el 422 del backend no llega a
    // verse: la secretaría corrige la fecha en el campo (historia #49).
    const crear = vi.fn()
    stubDataSource({ crearComision: crear })
    const user = userEvent.setup()
    await abrirModal(user)

    await completarComision(user, { modalidad: 'VIRTUAL' })
    const fin = screen.getByLabelText(/Fecha de Fin de la Cursada/)
    await user.clear(fin)
    await user.type(fin, '2026-07-31')
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    expect(
      await screen.findByText('La fecha de fin no puede ser anterior a la de inicio.'),
    ).toBeInTheDocument()
    expect(crear).not.toHaveBeenCalled()
  })

  it('exige el docente de la comisión', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await user.selectOptions(screen.getByLabelText(/^Modalidad/), 'VIRTUAL')
    const cursos = screen.getByLabelText(/^Curso \/ Programa/)
    await user.selectOptions(cursos, within(cursos).getByRole('option', { name: 'Python Inicial' }))
    await cargarHorarios(user)
    await user.type(screen.getByLabelText(/Cupo Máximo/), '20')
    await user.type(screen.getByLabelText(/Valor de Arancel de Comisión/), '52000')
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    expect(await screen.findByText('Elegí el docente de la comisión.')).toBeInTheDocument()
  })

  it.each([['1.1'], ['5.3'], ['2.5'], ['']])(
    'rechaza el cupo %s del alta sin llamar a la fuente',
    async (cupo) => {
      // El alta aceptaba `1.1` y lo mandaba a la API, que respondía 422 sin decir qué campo
      // corregir. La edición ya exigía el entero; ahora el alta también (D57).
      const crear = vi.fn()
      stubDataSource({ crearComision: crear })
      const user = userEvent.setup()
      await abrirModal(user)

      await completarComision(user, { cupo })
      await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

      expect(await screen.findByText('El cupo debe ser un entero positivo.')).toBeInTheDocument()
      expect(crear).not.toHaveBeenCalled()
      expect(screen.getByRole('dialog', { name: 'Crear Nueva Comisión' })).toBeInTheDocument()
    },
  )

  it('acepta un cupo entero y lo envía como número', async () => {
    const crear = vi.fn(async () => ({
      id: 99,
      codigo: 'CUR-101-2',
      curso: { codigo: 'CUR-101', nombre: 'Python Inicial' },
      docente_id: 1,
      docente_nombre: 'Profe Martín',
      horarios: HORARIOS_POR_DEFECTO,
      dias_horarios: TEXTO_POR_DEFECTO,
      cupo_maximo: 12,
      arancel: 52000,
      vacantes: 12,
      modalidad: 'VIRTUAL',
      sede_id: null,
      sede_nombre: null,
    }))
    stubDataSource({ crearComision: crear })
    const user = userEvent.setup()
    await abrirModal(user)

    await completarComision(user, { cupo: '12' })
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1))
    expect(crear.mock.calls[0][0].cupo_maximo).toBe(12)
  })

  it('exige un cupo y un arancel positivos', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await user.selectOptions(screen.getByLabelText(/^Modalidad/), 'VIRTUAL')
    const cursos = screen.getByLabelText(/^Curso \/ Programa/)
    await user.selectOptions(cursos, within(cursos).getByRole('option', { name: 'Python Inicial' }))
    await user.selectOptions(screen.getByLabelText(/^Docente Asignado/), '1')
    await cargarHorarios(user)
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
    await abrirModal(user)

    await completarComision(user, { modalidad: 'VIRTUAL' })
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ya hay una comisión para ese curso.',
    )
    expect(screen.getByRole('dialog', { name: 'Crear Nueva Comisión' })).toBeInTheDocument()
    expect(screen.queryByText(/Comisión CUR\d+-\d+ creada\./)).not.toBeInTheDocument()
  })

  it('muestra el 409 de choque de horario bajo el campo de horarios', async () => {
    stubDataSource({
      crearComision: vi.fn(async () => {
        throw Object.assign(new Error('Ese horario se superpone con la comisión CUR-101-1 (Mar 19-21hs), que dicta el mismo docente.'), { status: 409 })
      }),
    })
    const user = userEvent.setup()
    await abrirModal(user)

    await completarComision(user, { modalidad: 'VIRTUAL' })
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    expect(
      await screen.findByText(/se superpone con la comisión CUR-101-1 \(Mar 19-21hs\)/),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Crear Nueva Comisión' })).toBeInTheDocument()
  })

  it('mantiene lo que el operador completó cuando el alta se rechaza', async () => {
    stubDataSource({
      crearComision: vi.fn(async () => {
        throw new Error('Ya hay una comisión para ese curso.')
      }),
    })
    const user = userEvent.setup()
    await abrirModal(user)

    await completarComision(user, { modalidad: 'VIRTUAL' })
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))
    await screen.findByRole('alert')

    expect(screen.getByText(TEXTO_POR_DEFECTO)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Modalidad/)).toHaveValue('VIRTUAL')
  })

  it('cierra sin guardar cuando se cancela', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Crear Nueva Comisión' }),
      ).not.toBeInTheDocument(),
    )
  })
})

describe('alta de comisión desde dentro de un curso', () => {
  beforeEach(() => abrirCurso())

  it('abre con el curso de la ruta ya elegido y bloqueado', async () => {
    const user = userEvent.setup()
    await abrirModal(user)

    const selector = screen.getByLabelText(/^Curso \/ Programa/)

    expect(selector).toHaveValue('1')
    expect(selector).toBeDisabled()
    expect(within(selector).getByRole('option', { name: 'Python Inicial' })).toBeInTheDocument()
  })

  it('manda el identificador del curso de la ruta y no su código', async () => {
    // La comisión se crea desde un curso, así que el selector no se toca: si la pantalla mandara
    // el código en lugar del identificador, el payload sería `NaN` y la base rechazaría el alta.
    const crear = vi.fn(async () => ({
      id: 99,
      codigo: 'CUR-101-2',
      curso: { codigo: 'CUR-101', nombre: 'Python Inicial' },
      docente_id: 1,
      docente_nombre: 'Profe Martín',
      horarios: HORARIOS_POR_DEFECTO,
      dias_horarios: TEXTO_POR_DEFECTO,
      cupo_maximo: 20,
      arancel: 52000,
      vacantes: 20,
      modalidad: 'VIRTUAL',
      sede_id: null,
      sede_nombre: null,
    }))
    stubDataSource({ crearComision: crear })

    const user = userEvent.setup()
    await abrirModal(user)
    await completarComision(user, { modalidad: 'VIRTUAL', conCurso: false })
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1))
    expect(crear.mock.calls[0][0].curso_id).toBe(1)
    expect(Number.isNaN(crear.mock.calls[0][0].curso_id)).toBe(false)
  })

  it('agrega la comisión creada a la tabla del curso abierto', async () => {
    const user = userEvent.setup()
    await abrirModal(user)
    await completarComision(user, { modalidad: 'VIRTUAL', conCurso: false })
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    expect(await screen.findByText('Comisión CUR-101-2 creada.')).toBeInTheDocument()
    expect(filasDeComisiones().map((fila) => fila.cells[0].textContent)).toEqual([
      'CUR-101',
      'CUR-101-2',
    ])
  })

  it('deja el formulario abierto y muestra el motivo cuando la fuente rechaza el alta', async () => {
    stubDataSource({
      crearComision: vi.fn(async () => {
        throw new Error('Ya hay una comisión para ese curso.')
      }),
    })
    const user = userEvent.setup()
    await abrirModal(user)

    await completarComision(user, { modalidad: 'VIRTUAL', conCurso: false })
    await user.click(screen.getByRole('button', { name: 'Guardar Comisión' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ya hay una comisión para ese curso.',
    )
    expect(screen.getByRole('dialog', { name: 'Crear Nueva Comisión' })).toBeInTheDocument()
    expect(screen.queryByText(/Comisión CUR\d+-\d+ creada\./)).not.toBeInTheDocument()
  })
})

describe('menú de la tarjeta', () => {
  beforeEach(abrirCatalogo)

  it('despliega Editar curso sin abrir el curso', async () => {
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Acciones de CUR-101' }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Editar curso' })).toBeInTheDocument()
    expect(currentPath()).toBe(RUTA_CATALOGO)
  })

  it('anuncia si el menú está abierto', async () => {
    const user = userEvent.setup()
    const boton = screen.getByRole('button', { name: 'Acciones de CUR-101' })

    expect(boton).toHaveAttribute('aria-haspopup', 'menu')
    expect(boton).toHaveAttribute('aria-expanded', 'false')

    await user.click(boton)

    expect(boton).toHaveAttribute('aria-expanded', 'true')
  })

  it('se cierra con Escape y devuelve el foco al botón', async () => {
    const user = userEvent.setup()
    const boton = screen.getByRole('button', { name: 'Acciones de CUR-101' })
    await user.click(boton)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(boton).toHaveFocus()
  })

  it('se cierra con un click afuera', async () => {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Acciones de CUR-101' }))

    await user.click(screen.getByRole('heading', { name: 'Cursos' }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('edición de curso', () => {
  beforeEach(abrirCatalogo)

  async function abrirEdicion(user, codigo = 'CUR-101') {
    await user.click(screen.getByRole('button', { name: `Acciones de ${codigo}` }))
    await user.click(screen.getByRole('menuitem', { name: 'Editar curso' }))
    return screen.getByRole('dialog', { name: 'Editar Curso' })
  }

  async function editarNombre(user, dialogo, nombre) {
    const campo = within(dialogo).getByLabelText(/Nombre del Curso/)
    await user.clear(campo)
    await user.type(campo, nombre)
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar Cambios' }))
  }

  it('abre precargado, sin campo de código y con los botones del spec', async () => {
    const user = userEvent.setup()
    const dialogo = await abrirEdicion(user)

    expect(within(dialogo).getByLabelText(/Nombre del Curso/)).toHaveValue('Python Inicial')
    expect(within(dialogo).getByLabelText(/Descripción/)).toHaveValue('')
    expect(within(dialogo).queryByLabelText(/Código/)).not.toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Guardar Cambios' })).toBeInTheDocument()
  })

  it('guarda, actualiza la tarjeta y confirma la edición', async () => {
    const user = userEvent.setup()
    const dialogo = await abrirEdicion(user)

    await editarNombre(user, dialogo, 'Python Inicial Editado')

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Editar Curso' })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('status')).toHaveTextContent('Curso CUR-101 actualizado.')
    expect(tarjetaDe('Python Inicial Editado')).toHaveTextContent('CUR-101')
  })

  it('actualiza el nombre del curso en la tabla de comisiones', async () => {
    const user = userEvent.setup()
    const dialogo = await abrirEdicion(user)

    await editarNombre(user, dialogo, 'Python Inicial Editado')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Editar Curso' })).not.toBeInTheDocument(),
    )

    await user.click(tarjetaDe('Python Inicial Editado'))

    expect(await screen.findByText('Python Inicial Editado · CUR-101')).toBeInTheDocument()
    expect(filasDeComisiones()[0].cells[1].textContent).toBe('Python Inicial Editado')
  })

  it('deja el modal abierto con el motivo cuando el nombre ya pertenece a otro curso', async () => {
    stubDataSource({
      editarCurso: vi.fn(async () => {
        throw new Error('Ya existe un curso con ese nombre: CUR-104 — Diseño UX/UI Avanzado.')
      }),
    })
    const user = userEvent.setup()
    const dialogo = await abrirEdicion(user)

    await editarNombre(user, dialogo, 'Diseño UX/UI Avanzado')

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un curso con ese nombre')
    expect(screen.getByRole('dialog', { name: 'Editar Curso' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(tarjetaDe('Python Inicial')).toHaveTextContent('CUR-101')
  })
})

describe('alta de curso', () => {
  beforeEach(abrirCatalogo)

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
    await crearCurso(user, 'Excel Intermedio')
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

describe('comisión heredada sin período', () => {
  // CUR-103 llegó del cliente sin fechas: la tabla dice que no está definido en lugar de dejar la
  // celda vacía, que se confundiría con un dato que no cargó (D64).
  beforeEach(() => abrirCurso('/admin/cursos/CUR-103'))

  it('muestra Sin definir en la columna del período', () => {
    expect(filasDeComisiones()[0].cells[4].textContent).toBe('Sin definir')
  })
})

describe('edición de comisión', () => {
  beforeEach(() => abrirCurso())

  async function abrirEdicion(user) {
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    return screen.findByRole('dialog', { name: 'Editar Comisión' })
  }

  it('abre precargada, sin curso, modalidad, sede ni código, con los inscriptos a la vista', async () => {
    const user = userEvent.setup()

    const dialogo = await abrirEdicion(user)

    expect(within(dialogo).getByLabelText(/^Docente Asignado/)).toHaveValue('1')
    expect(within(dialogo).getByText('Mar y Jue 19-21hs')).toBeInTheDocument()
    expect(within(dialogo).getByLabelText(/Cupo Máximo/)).toHaveValue(30)
    expect(within(dialogo).getByLabelText(/Valor de Arancel de Comisión/)).toHaveValue(45000)
    expect(within(dialogo).queryByLabelText(/Curso \/ Programa/)).not.toBeInTheDocument()
    expect(within(dialogo).queryByLabelText(/^Modalidad/)).not.toBeInTheDocument()
    expect(within(dialogo).queryByLabelText(/^Sede/)).not.toBeInTheDocument()
    expect(within(dialogo).queryByLabelText(/Código/)).not.toBeInTheDocument()
    // CUR-101 tiene cupo 30 y 7 vacantes: 23 inscriptos ocupan banco.
    expect(dialogo).toHaveTextContent('23 inscriptos activos')
  })

  it('precarga el período guardado y muestra cuántas clases tiene', async () => {
    const user = userEvent.setup()

    const dialogo = await abrirEdicion(user)

    expect(within(dialogo).getByLabelText(/Fecha de Inicio de la Cursada/)).toHaveValue(
      '2026-08-04',
    )
    expect(within(dialogo).getByLabelText(/Fecha de Fin de la Cursada/)).toHaveValue('2026-11-26')
    // El número lo calcula la API sobre el período guardado —34 martes y jueves— y el navegador lo
    // muestra sin volver a contarlo (D64).
    expect(dialogo).toHaveTextContent('34 clases en el período guardado')
  })

  it('exige el período al editar una comisión que no lo tiene', async () => {
    // La comisión heredada se puede editar, pero no se puede guardar sin fechas: si no, quedaría sin
    // período para siempre (D64).
    cleanup()
    await abrirCurso('/admin/cursos/CUR-103')
    const user = userEvent.setup()
    const dialogo = await abrirEdicion(user)

    await user.click(within(dialogo).getByRole('button', { name: 'Guardar Cambios' }))

    expect(
      await within(dialogo).findByText('Indicá la fecha de inicio de la cursada.'),
    ).toBeInTheDocument()
    expect(within(dialogo).getByText('Indicá la fecha de fin de la cursada.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Editar Comisión' })).toBeInTheDocument()
  })

  it('guarda, actualiza la fila con las vacantes nuevas y confirma la edición', async () => {
    const user = userEvent.setup()
    const dialogo = await abrirEdicion(user)
    const cupo = within(dialogo).getByLabelText(/Cupo Máximo/)

    await user.clear(cupo)
    await user.type(cupo, '25')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar Cambios' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Editar Comisión' })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('status')).toHaveTextContent('Comisión CUR-101 actualizada.')
    const fila = filasDeComisiones()[0]
    expect(fila.cells[5].textContent).toBe('25')
    expect(fila.cells[6].textContent).toBe('2')
  })

  it('rechaza un cupo menor que los inscriptos sin llamar a la fuente', async () => {
    const editar = vi.fn()
    stubDataSource({ editarComision: editar })
    const user = userEvent.setup()
    const dialogo = await abrirEdicion(user)
    const cupo = within(dialogo).getByLabelText(/Cupo Máximo/)

    await user.clear(cupo)
    await user.type(cupo, '10')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar Cambios' }))

    expect(
      await within(dialogo).findByText(/La comisión tiene 23 inscriptos activos/),
    ).toBeInTheDocument()
    expect(editar).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Editar Comisión' })).toBeInTheDocument()
    expect(filasDeComisiones()[0].cells[5].textContent).toBe('30')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('deja el modal abierto con el motivo cuando la fuente rechaza la edición', async () => {
    stubDataSource({
      editarComision: vi.fn(async () => {
        throw new Error(
          'La comisión tiene 23 inscriptos activos: el cupo máximo no puede ser menor que 23.',
        )
      }),
    })
    const user = userEvent.setup()
    const dialogo = await abrirEdicion(user)
    const cupo = within(dialogo).getByLabelText(/Cupo Máximo/)

    // 29 pasa la validación local: el rechazo simula una fila vieja, donde el servidor sabe más.
    await user.clear(cupo)
    await user.type(cupo, '29')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar Cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('23 inscriptos activos')
    expect(screen.getByRole('dialog', { name: 'Editar Comisión' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('exige el docente antes de guardar', async () => {
    const user = userEvent.setup()
    const dialogo = await abrirEdicion(user)

    await user.selectOptions(within(dialogo).getByLabelText(/^Docente Asignado/), '')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar Cambios' }))

    expect(await screen.findByText('Elegí el docente de la comisión.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Editar Comisión' })).toBeInTheDocument()
  })
})

describe('edición de comisión con un docente que ya no está en el padrón', () => {
  it('mantiene el docente asignado en el selector, rotulado como baja', async () => {
    // `GET /docentes` devuelve solo activos: sin esta opción el selector arrancaría vacío y no se
    // podría guardar ni el arancel de una comisión cuyo docente quedó inactivo (D51).
    resetDataSource()
    stubBackend()
    stubDataSource({ listarDocentes: vi.fn(async () => []) })
    renderAppAs('ADMIN', RUTA_CURSO)
    await screen.findByRole('heading', { name: 'Comisiones Activas' })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Editar Comisión' })

    const selector = within(dialogo).getByLabelText(/^Docente Asignado/)
    expect(within(selector).getByRole('option', { name: 'Profe Martín (baja)' })).toBeInTheDocument()
    expect(selector).toHaveValue('1')
  })
})
