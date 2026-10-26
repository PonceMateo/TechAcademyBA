import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { CampoTelefono } from './CampoTelefono'

/**
 * El control de teléfono (D57).
 *
 * Lo que importa de este componente es qué valor entrega: siempre E.164 o vacío, nunca el texto
 * que quedó guardado de antes. Los cuatro casos son los del spec —válido, vacío, legacy y país
 * inicial— y el formulario de docentes y el de alumnos usan el mismo control.
 */

/** Envuelve el control con estado, como lo haría el formulario, y muestra el valor resultante. */
function CampoDePrueba({ inicial = '', error = null }) {
  const [valor, setValor] = useState(inicial)

  return (
    <div>
      <CampoTelefono
        id="telefono"
        etiqueta="Teléfono"
        valor={valor}
        onChange={setValor}
        error={error}
      />
      <p data-testid="valor">{valor}</p>
    </div>
  )
}

describe('CampoTelefono', () => {
  it('arranca con Argentina y ofrece todos los países', async () => {
    render(<CampoDePrueba />)

    const selector = screen.getByLabelText('Número de teléfono del país')
    expect(selector).toHaveValue('AR')
    // El listado completo son más de 200 países: si el control ofreciera un subconjunto, el
    // alumno del exterior no tendría dónde elegir su código.
    expect(screen.getAllByRole('option').length).toBeGreaterThan(200)
    expect(screen.getByRole('option', { name: 'Argentina' })).toBeInTheDocument()
  })

  it('entrega el teléfono en E.164', async () => {
    const user = userEvent.setup()
    render(<CampoDePrueba />)

    // Se pega el número entero y no dígito por dígito: el control reacomoda el cursor mientras se
    // escribe, y lo que el test tiene que afirmar es el valor que sale, no cómo formatea el caret.
    await user.click(screen.getByLabelText('Teléfono'))
    await user.paste('+5491112345678')

    expect(screen.getByTestId('valor')).toHaveTextContent('+5491112345678')
  })

  it('entrega vacío cuando el campo queda sin teléfono', async () => {
    const user = userEvent.setup()
    render(<CampoDePrueba inicial="+5491112345678" />)

    await user.clear(screen.getByLabelText('Teléfono'))

    expect(screen.getByTestId('valor')).toHaveTextContent('')
  })

  it('normaliza a E.164 un teléfono guardado que se puede interpretar', () => {
    render(<CampoDePrueba inicial="+54 11 4000-0001" />)

    // El formulario guarda E.164 aunque la secretaría no toque el campo: si no, el `PUT` llevaría
    // el texto viejo y la API lo rechazaría.
    expect(screen.getByTestId('valor')).toHaveTextContent('+541140000001')
  })

  it('conserva sin aviso un valor legacy que no se puede interpretar', () => {
    render(<CampoDePrueba inicial="particular" />)

    expect(screen.getByLabelText('Teléfono')).toHaveValue('particular')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByTestId('valor')).toHaveTextContent('particular')
  })

  it('pasa al selector de países cuando se descarta el valor legacy', async () => {
    const user = userEvent.setup()
    render(<CampoDePrueba inicial="000" />)

    await user.click(screen.getByRole('button', { name: 'Usar el selector de países' }))

    expect(screen.getByLabelText('Número de teléfono del país')).toHaveValue('AR')
    expect(screen.getByTestId('valor')).toHaveTextContent('')
  })

  it('muestra el error del formulario en el campo', () => {
    render(<CampoDePrueba inicial="particular" error="El teléfono no es válido." />)

    expect(screen.getByRole('alert')).toHaveTextContent('El teléfono no es válido.')
    expect(screen.getByLabelText('Teléfono')).toHaveAttribute('aria-invalid', 'true')
  })
})
