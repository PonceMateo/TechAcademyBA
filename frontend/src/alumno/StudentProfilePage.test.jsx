import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEMO_PASSWORD,
  accountForRole,
  currentPath,
  renderAppAs,
  resetDataSource,
  stubBackend,
  stubDataSource,
} from '../test/support'
import { inicialesDe } from '../utils/formato'
import { TITULO_MENU } from './navegacion'

/**
 * Perfil del alumno (11.5).
 *
 * Lo que se verifica es qué campos admiten edición y cuáles no: `DNI` y `Nombre` aparecen
 * deshabilitados con la leyenda `solo lectura`, y `Email` y `Teléfono` aceptan escribir. El ítem
 * deshabilitado de certificados se comprueba por lo que no tiene: la ruta da 404 y el contenido del
 * prototype —la pantalla con `Descargar certificado`— no se construyó.
 */

beforeEach(async () => {
  resetDataSource()
  stubBackend()
  renderAppAs('ALUMNO', '/alumno/perfil')
  await screen.findByRole('heading', { name: 'Mi Perfil' })
  await screen.findByDisplayValue('cami_rod@hotmail.com')
})

describe('tarjeta de identidad', () => {
  it('muestra el avatar y el nombre de la cuenta de la sesión, el chip y la nota', () => {
    const cuenta = accountForRole('ALUMNO')
    const identidad = within(screen.getByRole('heading', { name: 'Identidad' }).closest('section'))

    expect(identidad.getByText(inicialesDe(cuenta.nombre))).toBeInTheDocument()
    expect(identidad.getByText(cuenta.nombre)).toBeInTheDocument()
    expect(identidad.getByText('ALUMNO · PERMISOS MÍNIMOS')).toBeInTheDocument()
    expect(identidad.getByText('Solo podés editar tus datos de contacto.')).toBeInTheDocument()
  })
})

describe('datos personales', () => {
  it('muestra los cuatro valores que toma de los datos del cliente', () => {
    expect(screen.getByLabelText(/DNI/)).toHaveValue('40.112.233')
    expect(screen.getByLabelText(/Nombre/)).toHaveValue('Camila Rodríguez')
    expect(screen.getByLabelText(/Email/)).toHaveValue('cami_rod@hotmail.com')
    expect(screen.getByLabelText(/Teléfono/)).toHaveValue('011 4788-1122')
  })

  it('deja el DNI y el nombre deshabilitados, con la leyenda solo lectura', () => {
    const dni = screen.getByLabelText(/DNI/)
    const nombre = screen.getByLabelText(/Nombre/)

    expect(dni).toBeDisabled()
    expect(nombre).toBeDisabled()
    // La leyenda va en la etiqueta, así que forma parte del nombre accesible del campo.
    expect(dni).toHaveAccessibleName(/DNI.*solo lectura/)
    expect(nombre).toHaveAccessibleName(/Nombre.*solo lectura/)
  })

  it('no deja cambiar el DNI ni el nombre escribiendo en ellos', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/DNI/), '99.999.999')
    await user.type(screen.getByLabelText(/Nombre/), 'Otra Persona')

    expect(screen.getByLabelText(/DNI/)).toHaveValue('40.112.233')
    expect(screen.getByLabelText(/Nombre/)).toHaveValue('Camila Rodríguez')
  })

  it('deja editar el email y el teléfono y confirma el guardado', async () => {
    const user = userEvent.setup()
    const email = screen.getByLabelText(/Email/)
    const telefono = screen.getByLabelText(/Teléfono/)

    expect(email).not.toBeDisabled()
    expect(telefono).not.toBeDisabled()

    await user.clear(email)
    await user.type(email, 'camila.rod@gmail.com')
    // El teléfono del ejemplo es el texto crudo de la planilla del cliente: para guardar hay que
    // reingresarlo en formato internacional, que es la regla del padrón (D57).
    await user.clear(telefono)
    await user.type(telefono, '+5491147881122')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Datos de contacto actualizados.')
    expect(screen.getByLabelText(/Email/)).toHaveValue('camila.rod@gmail.com')
  })

  it('marca el teléfono cuando todavía tiene el formato viejo del padrón', async () => {
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El teléfono debe tener el formato internacional',
    )
  })

  it('deshabilita el botón mientras guarda', async () => {
    const user = userEvent.setup()
    stubDataSource({ actualizarPerfilAlumno: () => new Promise(() => {}) })
    await user.clear(screen.getByLabelText(/Teléfono/))

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const boton = await screen.findByRole('button', { name: 'Guardando…' })
    expect(boton).toBeDisabled()
  })

  it('informa el conflicto cuando el email ya es de otra cuenta y conserva lo anterior', async () => {
    const user = userEvent.setup()
    const email = screen.getByLabelText(/Email/)

    await user.clear(email)
    await user.type(email, 'juan.perez@gmail.com')
    await user.clear(screen.getByLabelText(/Teléfono/))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ya está registrado')
    expect(screen.getByLabelText(/Email/)).toHaveValue('cami_rod@hotmail.com')
  })
})

describe('tarjeta de seguridad', () => {
  it('cambia la contraseña y lo informa sin salir del perfil', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Contraseña actual'), DEMO_PASSWORD)
    await user.type(screen.getByLabelText('Contraseña nueva'), 'NuevaClave1')
    await user.type(screen.getByLabelText('Repetí la nueva'), 'NuevaClave1')
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Contraseña actualizada.')
    expect(currentPath()).toBe('/alumno/perfil')
  })

  it('rechaza la contraseña actual incorrecta', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Contraseña actual'), 'NoEsLaClave')
    await user.type(screen.getByLabelText('Contraseña nueva'), 'NuevaClave1')
    await user.type(screen.getByLabelText('Repetí la nueva'), 'NuevaClave1')
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La contraseña actual no es correcta.',
    )
  })

  it('no manda el cambio si la confirmación no coincide', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Contraseña actual'), DEMO_PASSWORD)
    await user.type(screen.getByLabelText('Contraseña nueva'), 'NuevaClave1')
    await user.type(screen.getByLabelText('Repetí la nueva'), 'OtraClave1')
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La confirmación no coincide con la contraseña nueva.',
    )
  })
})

describe('ítems deshabilitados del menú', () => {
  it('deja certificados y pago de cuota sin enlace y con Próximamente', () => {
    const menu = within(screen.getByRole('navigation', { name: TITULO_MENU }))

    expect(menu.queryByRole('link', { name: 'Certificados' })).not.toBeInTheDocument()
    expect(menu.queryByRole('link', { name: 'Pagar la cuota' })).not.toBeInTheDocument()
    expect(menu.getAllByText('Próximamente')).toHaveLength(2)
  })

  it('no tiene pantalla de certificados detrás: la ruta da 404 y no hay descarga', async () => {
    cleanup()
    renderAppAs('ALUMNO', '/alumno/certificados')

    expect(await screen.findByText('No encontramos esa página')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Descargar certificado/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Descarga no disponible/)).not.toBeInTheDocument()
  })

  it('no tiene pantalla de pago de cuota detrás', async () => {
    cleanup()
    renderAppAs('ALUMNO', '/alumno/pagar-la-cuota')

    expect(await screen.findByText('No encontramos esa página')).toBeInTheDocument()
  })
})

describe('perfil sin endpoint', () => {
  it('muestra que no hay alumno para mostrar', async () => {
    cleanup()
    stubDataSource({
      obtenerPerfilAlumno: async () => {
        throw new Error('No pudimos conectar con el servidor.')
      },
    })
    renderAppAs('ALUMNO', '/alumno/perfil')

    expect(await screen.findByText('No hay ningún alumno para mostrar.')).toBeInTheDocument()
  })
})
