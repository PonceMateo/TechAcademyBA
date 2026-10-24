import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SelectorHorarios } from './SelectorHorarios'

/**
 * El selector de horarios (historia #48).
 *
 * **Se prueban los casos del criterio**: los dos modos y el cambio en ambos sentidos, el fin que
 * propone el rango, el `Listo` deshabilitado sin días y el tipeo normalizado. Lo que no se prueba
 * acá es el popover del picker: es la librería, y su comportamiento visual se revisa en el
 * navegador.
 */

function montar({ horarios = [], onListo = vi.fn(), onCancelar = vi.fn() } = {}) {
  render(
    <SelectorHorarios abierto horarios={horarios} onListo={onListo} onCancelar={onCancelar} />,
  )
  return { onListo, onCancelar }
}

describe('modo mismo horario', () => {
  it('abre con el switch activado y un único rango para los siete días', () => {
    montar()

    expect(screen.getByRole('switch', { name: 'Mismo horario todos los días' })).toBeChecked()
    expect(screen.getByLabelText('Hora de inicio')).toBeInTheDocument()
    expect(screen.getByLabelText('Hora de fin')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Hora de inicio del Lunes/)).not.toBeInTheDocument()
  })

  it('devuelve un horario por día activo cuando se confirma', async () => {
    const user = userEvent.setup()
    const { onListo } = montar()

    await user.click(screen.getByRole('button', { name: 'Listo' }))

    expect(onListo).toHaveBeenCalledTimes(1)
    expect(onListo.mock.calls[0][0]).toHaveLength(7)
    expect(onListo.mock.calls[0][0][0]).toEqual({ dia: 'LUN', inicio: '19:00', fin: '21:00' })
  })

  it('saca el día que se apaga', async () => {
    const user = userEvent.setup()
    const { onListo } = montar()

    const domingo = screen.getByRole('button', { name: 'Domingo' })
    expect(domingo).toHaveAttribute('aria-pressed', 'true')

    await user.click(domingo)
    await user.click(screen.getByRole('button', { name: 'Listo' }))

    expect(domingo).toHaveAttribute('aria-pressed', 'false')
    expect(onListo.mock.calls[0][0].map((horario) => horario.dia)).not.toContain('DOM')
  })

  it('deshabilita Listo cuando no queda ningún día activo', async () => {
    const user = userEvent.setup()
    montar()

    for (const nombre of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) {
      await user.click(screen.getByRole('button', { name: nombre }))
    }

    expect(screen.getByRole('button', { name: 'Listo' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Elegí al menos un día')
  })

  it('se opera con el teclado, no solo con el mouse', async () => {
    const user = userEvent.setup()
    const { onListo } = montar()

    const martes = screen.getByRole('button', { name: 'Martes' })
    martes.focus()
    await user.keyboard('{Enter}')
    await user.click(screen.getByRole('button', { name: 'Listo' }))

    expect(onListo.mock.calls[0][0].map((horario) => horario.dia)).not.toContain('MAR')
  })

  it('propone dos horas de fin al cambiar el inicio', async () => {
    const user = userEvent.setup()
    const { onListo } = montar()

    const inicio = screen.getByLabelText('Hora de inicio')
    await user.clear(inicio)
    await user.type(inicio, '18:00')
    await user.tab()
    await user.click(screen.getByRole('button', { name: 'Listo' }))

    expect(onListo.mock.calls[0][0][0]).toEqual({ dia: 'LUN', inicio: '18:00', fin: '20:00' })
  })

  it('topea el fin propuesto en las 22:00', async () => {
    const user = userEvent.setup()
    const { onListo } = montar()

    const inicio = screen.getByLabelText('Hora de inicio')
    await user.clear(inicio)
    await user.type(inicio, '21:00')
    await user.tab()
    await user.click(screen.getByRole('button', { name: 'Listo' }))

    expect(onListo.mock.calls[0][0][0]).toEqual({ dia: 'LUN', inicio: '21:00', fin: '22:00' })
  })

  it('redondea lo que se tipea al múltiplo de 15 más cercano', async () => {
    const user = userEvent.setup()
    const { onListo } = montar()

    const inicio = screen.getByLabelText('Hora de inicio')
    await user.clear(inicio)
    await user.type(inicio, '13:42')
    await user.tab()
    await waitFor(() => expect(screen.getByLabelText('Hora de inicio')).toHaveValue('13:45'))

    await user.click(screen.getByRole('button', { name: 'Listo' }))
    expect(onListo.mock.calls[0][0][0].inicio).toBe('13:45')
  })

  it('restaura el valor anterior cuando el texto no se entiende', async () => {
    const user = userEvent.setup()
    montar()

    const inicio = screen.getByLabelText('Hora de inicio')
    await user.clear(inicio)
    await user.type(inicio, 'a la tarde')
    await user.tab()

    await waitFor(() => expect(screen.getByLabelText('Hora de inicio')).toHaveValue('19:00'))
  })
})

describe('modo distinto por día', () => {
  it('al apagar el switch copia el rango a los días activos y abre una fila por día', async () => {
    const user = userEvent.setup()
    const { onListo } = montar()

    await user.click(screen.getByRole('switch', { name: 'Mismo horario todos los días' }))

    expect(screen.getByLabelText('Hora de inicio del Lunes')).toHaveValue('19:00')
    expect(screen.getByLabelText('Hora de inicio del Domingo')).toHaveValue('19:00')

    await user.click(screen.getByRole('button', { name: 'Listo' }))

    expect(onListo.mock.calls[0][0]).toHaveLength(7)
    expect(new Set(onListo.mock.calls[0][0].map((horario) => `${horario.inicio}-${horario.fin}`))).toEqual(
      new Set(['19:00-21:00']),
    )
  })

  it('carga un rango por día y los devuelve todos', async () => {
    const user = userEvent.setup()
    const { onListo } = montar()

    await user.click(screen.getByRole('switch', { name: 'Mismo horario todos los días' }))
    for (const nombre of ['Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) {
      await user.click(screen.getByRole('button', { name: nombre }))
    }

    const inicio = screen.getByLabelText('Hora de inicio del Martes')
    await user.clear(inicio)
    await user.type(inicio, '18:15')
    await user.tab()
    const fin = screen.getByLabelText('Hora de fin del Martes')
    await user.clear(fin)
    await user.type(fin, '21:30')
    await user.tab()

    await user.click(screen.getByRole('button', { name: 'Listo' }))

    expect(onListo.mock.calls[0][0]).toEqual([
      { dia: 'LUN', inicio: '19:00', fin: '21:00' },
      { dia: 'MAR', inicio: '18:15', fin: '21:30' },
    ])
  })

  it('vuelve a mismo: con rangos distintos pide confirmación y usa el primer día activo', async () => {
    const user = userEvent.setup()
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { onListo } = montar({
      horarios: [
        { dia: 'LUN', inicio: '18:00', fin: '20:00' },
        { dia: 'MAR', inicio: '19:00', fin: '21:00' },
      ],
    })

    expect(screen.getByRole('switch', { name: 'Mismo horario todos los días' })).not.toBeChecked()

    await user.click(screen.getByRole('switch', { name: 'Mismo horario todos los días' }))
    expect(confirmar).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Listo' }))

    expect(onListo.mock.calls[0][0]).toEqual([
      { dia: 'LUN', inicio: '18:00', fin: '20:00' },
      { dia: 'MAR', inicio: '18:00', fin: '20:00' },
    ])

    confirmar.mockRestore()
  })

  it('si la confirmación se cancela, se queda en modo distinto', async () => {
    const user = userEvent.setup()
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false)
    montar({
      horarios: [
        { dia: 'LUN', inicio: '18:00', fin: '20:00' },
        { dia: 'MAR', inicio: '19:00', fin: '21:00' },
      ],
    })

    await user.click(screen.getByRole('switch', { name: 'Mismo horario todos los días' }))

    expect(screen.getByRole('switch', { name: 'Mismo horario todos los días' })).not.toBeChecked()
    expect(screen.getByLabelText('Hora de inicio del Martes')).toHaveValue('19:00')

    confirmar.mockRestore()
  })

  it('abre en modo distinto cuando los horarios guardados tienen rangos distintos', () => {
    montar({
      horarios: [
        { dia: 'LUN', inicio: '18:00', fin: '20:00' },
        { dia: 'MAR', inicio: '19:00', fin: '21:00' },
      ],
    })

    expect(screen.getByRole('switch', { name: 'Mismo horario todos los días' })).not.toBeChecked()
    expect(screen.getByLabelText('Hora de inicio del Lunes')).toHaveValue('18:00')
    expect(screen.getByLabelText('Hora de inicio del Martes')).toHaveValue('19:00')
  })
})

describe('lo que el selector devuelve', () => {
  it('cancelar descarta los cambios y no devuelve horarios', async () => {
    const user = userEvent.setup()
    const { onListo, onCancelar } = montar()

    await user.click(screen.getByRole('button', { name: 'Domingo' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onCancelar).toHaveBeenCalledTimes(1)
    expect(onListo).not.toHaveBeenCalled()
  })

  it('abre con los horarios guardados, incluido el que tiene minutos', () => {
    montar({ horarios: [{ dia: 'MAR', inicio: '18:15', fin: '21:30' }] })

    expect(screen.getByRole('switch', { name: 'Mismo horario todos los días' })).toBeChecked()
    expect(screen.getByLabelText('Hora de inicio')).toHaveValue('18:15')
    expect(screen.getByLabelText('Hora de fin')).toHaveValue('21:30')
    expect(screen.getByRole('button', { name: 'Lunes' })).toHaveAttribute('aria-pressed', 'false')
  })
})
