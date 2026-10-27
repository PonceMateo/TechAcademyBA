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

  it('entrega el teléfono en E.164 al escribirlo dígito por dígito', async () => {
    const user = userEvent.setup()
    render(<CampoDePrueba />)

    const campo = screen.getByLabelText('Teléfono')
    await user.click(campo)
    await user.keyboard('1112345678')

    // Lo que se ve es el número nacional: el `+54` lo aporta el selector y no se escribe como texto.
    expect(campo).toHaveValue('11 1234-5678')
    expect(document.activeElement).toBe(campo)
    expect(screen.getByTestId('valor')).toHaveTextContent('+541112345678')
  })

  it('no cambia el control por un input de texto a mitad del tipeo', async () => {
    const user = userEvent.setup()
    render(<CampoDePrueba />)

    const campo = screen.getByLabelText('Teléfono')
    await user.click(campo)
    await user.keyboard('1')

    // El primer dígito deja `+54` como valor interno, que todavía no es un número parseable. Si eso
    // abriera el modo legacy, el campo se reemplazaría, se perdería el foco y aceptaría letras.
    expect(screen.getByLabelText('Número de teléfono del país')).toHaveValue('AR')
    expect(document.activeElement).toBe(campo)
    await user.keyboard('abc')
    expect(screen.getByTestId('valor')).toHaveTextContent('+541')
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

  it('muestra un teléfono guardado sin el +54 como texto', () => {
    render(<CampoDePrueba inicial="+541140000001" />)

    // El `+54` lo aporta el selector de país: si apareciera en el campo, habría que borrarlo a mano.
    // El `0` inicial es el prefijo nacional que agrega la librería al mostrar un número guardado.
    expect(screen.getByLabelText('Teléfono')).toHaveValue('011 4000-0001')
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
