import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEMO_PASSWORD,
  accountForRole,
  renderAppAs,
  resetDataSource,
  stubBackend,
  stubDataSource,
} from '../test/support'
import { inicialesDe } from '../utils/formato'
import { TITULO_MENU } from './navegacion'

/**
 * Perfil del docente (10.5 y HU 90).
 *
 * Lo que se verifica es qué campos admiten edición y cuáles no: `Nombre`, `Apellido`, `DNI` y
 * `CUIL` aparecen deshabilitados, y `Email` y `Teléfono` aceptan escribir y guardar. La tarjeta de
 * seguridad usa el backend falso de `stubBackend`, que ya implementa
 * `POST /auth/change-password` con la contraseña de demostración.
 *
 * Los casos que importan del guardado son los del spec: éxito, email que ya usa otra persona y
 * forma inválida. En los dos rechazos, lo ingresado tiene que quedar en pantalla para poder
 * corregirlo.
 */

const COLUMNAS = ['CÓDIGO', 'CURSO', 'HORARIO', 'ESTADO']

async function entrar(ruta = '/docente/perfil') {
  resetDataSource()
  stubBackend()
  renderAppAs('DOCENTE', ruta)
  await screen.findByRole('heading', { name: 'Mi Perfil' })
  // El encabezado se dibuja antes de que lleguen los datos: esperar el email del perfil espera de
  // verdad a que el perfil se haya cargado.
  await screen.findByDisplayValue('profe.martin@techacademy.invalid')
}

// La flecha es necesaria: `beforeEach(entrar)` le pasaría a `entrar` el contexto del test como ruta.
beforeEach(() => entrar())

describe('tarjeta de identidad', () => {
  it('muestra el avatar y el nombre de la cuenta de la sesión y la nota', () => {
    const cuenta = accountForRole('DOCENTE')
    const identidad = within(screen.getByRole('heading', { name: 'Identidad' }).closest('section'))

    expect(identidad.getByText(inicialesDe(cuenta.nombre))).toBeInTheDocument()
    expect(identidad.getByText(cuenta.nombre)).toBeInTheDocument()
    expect(identidad.queryByText('DOCENTE · PERMISOS REDUCIDOS')).not.toBeInTheDocument()
    expect(
      identidad.getByText('Los cambios administrativos deben solicitarse a Secretaría BA.'),
    ).toBeInTheDocument()
  })
})

describe('datos personales', () => {
  it('muestra la identidad y el contacto del docente autenticado', () => {
    expect(screen.getByLabelText(/Nombre/)).toHaveValue('Profe')
    expect(screen.getByLabelText(/Apellido/)).toHaveValue('Martín')
    expect(screen.getByLabelText(/DNI/)).toHaveValue('28.114.402')
    expect(screen.getByLabelText(/CUIL/)).toHaveValue('20-28114402-4')
    expect(screen.getByLabelText(/Email/)).toHaveValue('profe.martin@techacademy.invalid')
  })

  it('deja la identidad deshabilitada y sin la leyenda solo lectura', () => {
    for (const etiqueta of [/Nombre/, /Apellido/, /DNI/, /CUIL/]) {
      const campo = screen.getByLabelText(etiqueta)
      expect(campo).toBeDisabled()
      expect(campo).not.toHaveAccessibleName(/solo lectura/)
    }
  })

  it('no deja cambiar la identidad escribiendo en sus campos', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/Nombre/), 'Otra Persona')
    await user.type(screen.getByLabelText(/CUIL/), '99-99999999-9')

    expect(screen.getByLabelText(/Nombre/)).toHaveValue('Profe')
    expect(screen.getByLabelText(/CUIL/)).toHaveValue('20-28114402-4')
  })

  it('deja editar el email y el teléfono y confirma el guardado', async () => {
    const user = userEvent.setup()
    const email = screen.getByLabelText(/Email/)
    const telefono = screen.getByLabelText(/Teléfono/)

    expect(email).not.toBeDisabled()
    expect(telefono).not.toBeDisabled()

    await user.clear(email)
    await user.type(email, 'profe.martin.nuevo@techacademy.invalid')
    await user.clear(telefono)
    await user.type(telefono, '+5491140000099')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Datos de contacto actualizados.')
    expect(screen.getByLabelText(/Email/)).toHaveValue('profe.martin.nuevo@techacademy.invalid')
  })

  it('informa el email duplicado y conserva lo ingresado', async () => {
    const user = userEvent.setup()
    stubDataSource({
      actualizarPerfilDocente: async () => {
        throw new Error('El email ocupado@techacademy.invalid ya está registrado en el padrón de docentes.')
      },
    })
    const email = screen.getByLabelText(/Email/)

    await user.clear(email)
    await user.type(email, 'ocupado@techacademy.invalid')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ya está registrado')
    expect(screen.getByLabelText(/Email/)).toHaveValue('ocupado@techacademy.invalid')
  })

  it('marca el email con forma inválida y no borra lo escrito', async () => {
    const user = userEvent.setup()
    const email = screen.getByLabelText(/Email/)

    await user.clear(email)
    await user.type(email, 'sin-arroba')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El email no tiene un formato válido.')
    expect(screen.getByLabelText(/Email/)).toHaveValue('sin-arroba')
  })
})

describe('seguridad', () => {
  it('cambia la contraseña con la actual correcta', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Contraseña actual'), DEMO_PASSWORD)
    await user.type(screen.getByLabelText('Contraseña nueva'), 'NuevaClave123!')
    await user.type(screen.getByLabelText('Repetí la nueva'), 'NuevaClave123!')
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Contraseña actualizada.')
  })

  it('rechaza la confirmación distinta sin enviar el cambio', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Contraseña actual'), DEMO_PASSWORD)
    await user.type(screen.getByLabelText('Contraseña nueva'), 'NuevaClave123!')
    await user.type(screen.getByLabelText('Repetí la nueva'), 'OtraClave123!')
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La confirmación no coincide con la contraseña nueva.',
    )
  })

  it('muestra el error cuando la contraseña actual es incorrecta', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Contraseña actual'), 'Incorrecta123!')
    await user.type(screen.getByLabelText('Contraseña nueva'), 'NuevaClave123!')
    await user.type(screen.getByLabelText('Repetí la nueva'), 'NuevaClave123!')
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña actual no es correcta.')
  })
})

describe('comisiones asignadas', () => {
  it('muestra las cuatro columnas en el orden del spec', () => {
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(COLUMNAS)
  })

  it('muestra CUR-101 con su horario y el estado Activa en verde', () => {
    const fila = within(screen.getByRole('table')).getAllByRole('row')[1]

    expect(fila.cells[0]).toHaveTextContent('CUR-101')
    expect(fila.cells[1]).toHaveTextContent('Python Inicial')
    expect(fila.cells[2]).toHaveTextContent('Mar y Jue · 19 a 21 hs')

    const estado = within(fila.cells[3]).getByText('Activa')
    expect(estado.className).toContain('green')
  })
})

describe('notas y certificación', () => {
  it('es un ítem deshabilitado del menú, con Próximamente y sin enlace', () => {
    expect(screen.queryByRole('link', { name: 'Notas y Certificación' })).not.toBeInTheDocument()
    expect(screen.getByText('Notas y Certificación')).toBeInTheDocument()
    expect(screen.getAllByText('Próximamente')).toHaveLength(1)
  })

  it('no tiene pantalla detrás: la ruta da 404', async () => {
    cleanup()

    resetDataSource()
    stubBackend()
    renderAppAs('DOCENTE', '/docente/notas')

    expect(await screen.findByText('No encontramos esa página')).toBeInTheDocument()

    // Tampoco hay tabla de notas, campo de carga ni control de certificación en el shell.
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('absorbe el seguimiento de clases dictadas y no lo abre como ítem aparte', () => {
    const menu = within(screen.getByRole('navigation', { name: TITULO_MENU }))
    const items = menu.getAllByRole('listitem').map((item) => item.textContent)

    expect(items.join(' ')).not.toContain('Clases dictadas')
    expect(items.join(' ')).toContain('Notas y Certificación')
  })
})

describe('perfil sin endpoint', () => {
  it('muestra que no hay docente para mostrar', async () => {
    cleanup()
    stubDataSource({
      obtenerPerfilDocente: async () => {
        throw new Error('No pudimos conectar con el servidor.')
      },
    })
    renderAppAs('DOCENTE', '/docente/perfil')

    expect(await screen.findByText('No hay ningún docente para mostrar.')).toBeInTheDocument()
  })
})
