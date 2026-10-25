import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HorarioCompacto } from './HorarioCompacto'

/**
 * El horario en la tabla (historia #48).
 *
 * La columna no puede crecer de alto: se pinta una línea con puntos suspensivos, el texto completo
 * queda en el tooltip y, cuando hay más de un grupo, aparece el badge `+N` con la lista completa. El
 * badge es una regla determinista —más de un grupo— y no una medición del ancho, que en `jsdom` no
 * existe.
 */

const UN_GRUPO = [
  { dia: 'MAR', inicio: '19:00', fin: '21:00' },
  { dia: 'JUE', inicio: '19:00', fin: '21:00' },
]

const DOS_GRUPOS = [
  { dia: 'LUN', inicio: '19:00', fin: '21:00' },
  { dia: 'MIE', inicio: '19:00', fin: '21:00' },
  { dia: 'MAR', inicio: '18:15', fin: '21:30' },
]

const SIETE_DIAS = [
  { dia: 'LUN', inicio: '09:00', fin: '11:00' },
  { dia: 'MAR', inicio: '10:00', fin: '12:00' },
  { dia: 'MIE', inicio: '11:00', fin: '13:00' },
  { dia: 'JUE', inicio: '12:00', fin: '14:00' },
  { dia: 'VIE', inicio: '13:00', fin: '15:00' },
  { dia: 'SAB', inicio: '14:00', fin: '16:00' },
  { dia: 'DOM', inicio: '15:00', fin: '17:00' },
]

describe('horario compacto', () => {
  it('muestra una línea con el texto completo en el tooltip', () => {
    render(<HorarioCompacto horarios={UN_GRUPO} texto="Mar y Jue 19-21hs" />)

    expect(screen.getByTitle('Mar y Jue 19-21hs')).toHaveTextContent('Mar y Jue 19-21hs')
  })

  it('no muestra el badge cuando hay un solo grupo', () => {
    render(<HorarioCompacto horarios={UN_GRUPO} texto="Mar y Jue 19-21hs" />)

    expect(screen.queryByRole('button', { name: /Ver los/ })).not.toBeInTheDocument()
  })

  it('muestra el badge +1 con dos grupos y el popover con la lista completa', async () => {
    const user = userEvent.setup()
    render(<HorarioCompacto horarios={DOS_GRUPOS} texto="no se usa" />)

    const badge = screen.getByRole('button', { name: 'Ver los 2 horarios completos' })
    expect(badge).toHaveTextContent('+1')

    await user.click(badge)

    const popover = screen.getByRole('dialog', { name: 'Horarios completos' })
    expect(popover).toHaveTextContent('Lun y Mié 19-21hs')
    expect(popover).toHaveTextContent('Mar 18:15-21:30hs')
  })

  it('con siete días distintos muestra +6 y no trunca el popover', async () => {
    const user = userEvent.setup()
    render(<HorarioCompacto horarios={SIETE_DIAS} texto="no se usa" />)

    const badge = screen.getByRole('button', { name: 'Ver los 7 horarios completos' })
    expect(badge).toHaveTextContent('+6')

    await user.click(badge)

    expect(screen.getByRole('dialog', { name: 'Horarios completos' })).toHaveTextContent(
      'Dom 15-17hs',
    )
  })

  it('cierra el popover con Escape', async () => {
    const user = userEvent.setup()
    render(<HorarioCompacto horarios={DOS_GRUPOS} texto="no se usa" />)

    await user.click(screen.getByRole('button', { name: /Ver los/ }))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Horarios completos' })).not.toBeInTheDocument()
  })

  it('cae al texto de la comisión cuando no hay horarios estructurados', () => {
    render(<HorarioCompacto horarios={[]} texto="Sábados intensivo" />)

    expect(screen.getByTitle('Sábados intensivo')).toHaveTextContent('Sábados intensivo')
    expect(screen.queryByRole('button', { name: /Ver los/ })).not.toBeInTheDocument()
  })
})
