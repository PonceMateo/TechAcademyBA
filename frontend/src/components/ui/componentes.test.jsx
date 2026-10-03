import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ESTADO_HABILITACION } from '../../domain/enums'
import { formatFechaCorta, formatMoneda } from '../../utils/formato'
import { Badge, Button, Card, Campo, Input, Modal, StatusIndicator, Table } from './index'

/**
 * Componentes compartidos (8.3).
 *
 * Se prueban los que tienen una regla propia: la insignia distingue habilitado de bloqueado y
 * muestra la causa, y la tabla y el modal respetan lo que la pantalla les pasa. Lo demás es
 * estructura y se verifica usándolos desde las pantallas del grupo 9.
 */

const COLUMNAS = [
  { clave: 'codigo', titulo: 'CÓDIGO', render: (fila) => fila.codigo },
  { clave: 'arancel', titulo: 'ARANCEL', render: (fila) => formatMoneda(fila.arancel) },
]

/** Input controlado, para probar que lo tipeado llega al `onChange`. */
function CodigoComision() {
  const [valor, setValor] = useState('')

  return (
    <Input
      id="codigo"
      etiqueta="Código Comisión"
      valor={valor}
      onChange={(evento) => setValor(evento.target.value)}
      placeholder="Ej: CUR-111"
    />
  )
}

describe('Badge', () => {
  it('muestra el texto que le pasan y el tono que le piden', () => {
    render(<Badge tono="verde">PARTICULAR</Badge>)

    const insignia = screen.getByText('PARTICULAR')
    expect(insignia).toBeInTheDocument()
    expect(insignia.className).toContain('text-green-800')
  })
})

describe('StatusIndicator', () => {
  it('distingue habilitado de bloqueado por el color', () => {
    const { rerender } = render(<StatusIndicator estado={ESTADO_HABILITACION.HABILITADO} />)

    expect(screen.getByText('HABILITADO').className).toContain('text-green-800')

    rerender(
      <StatusIndicator estado={ESTADO_HABILITACION.BLOQUEADO} causa="comprobante ilegible" />,
    )

    expect(screen.getByText('BLOQUEADO').className).toContain('text-red-800')
  })

  it('muestra la causa junto al estado bloqueado', () => {
    render(<StatusIndicator estado={ESTADO_HABILITACION.BLOQUEADO} causa="debe saldo" />)

    expect(screen.getByText('BLOQUEADO')).toBeInTheDocument()
    expect(screen.getByText('debe saldo')).toBeInTheDocument()
  })

  it('muestra el texto de apoyo cuando está habilitado', () => {
    render(
      <StatusIndicator
        estado={ESTADO_HABILITACION.HABILITADO}
        habilitadoTexto="El alumno cumple con la condición arancelaria."
      />,
    )

    expect(screen.getByText('El alumno cumple con la condición arancelaria.')).toBeInTheDocument()
  })

  it('se niega a mostrar un bloqueo sin causa', () => {
    // Silenciar el console.error que React imprime cuando un render tira.
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<StatusIndicator estado={ESTADO_HABILITACION.BLOQUEADO} />)).toThrow(
      /necesita la causa/,
    )

    consola.mockRestore()
  })
})

describe('Table', () => {
  it('dibuja los encabezados y las filas que le pasan', () => {
    render(
      <Table
        columnas={COLUMNAS}
        filas={[
          { id: 1, codigo: 'CUR-101', arancel: 45000 },
          { id: 2, codigo: 'CUR-104', arancel: 52000 },
        ]}
      />,
    )

    expect(screen.getByRole('columnheader', { name: 'CÓDIGO' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'ARANCEL' })).toBeInTheDocument()
    expect(screen.getByText('$45.000')).toBeInTheDocument()
    expect(screen.getByText('CUR-104')).toBeInTheDocument()
  })

  it('deja la celda vacía cuando el valor es nulo, sin inventar un guion', () => {
    render(<Table columnas={COLUMNAS} filas={[{ id: 1, codigo: 'CUR-101', arancel: null }]} />)

    expect(screen.getByText('CUR-101')).toBeInTheDocument()
    expect(screen.queryByText('$-')).not.toBeInTheDocument()
  })

  it('muestra lo que la pantalla pasa como estado vacío', () => {
    render(<Table columnas={COLUMNAS} filas={[]} vacio={<p>No se encontraron resultados</p>} />)

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText('No se encontraron resultados')).toBeInTheDocument()
  })
})

describe('Modal', () => {
  it('no se ve mientras está cerrado y aparece cuando se abre', () => {
    const { rerender } = render(
      <Modal abierto={false} titulo="Crear Nueva Comisión" onClose={() => {}}>
        <p>Formulario</p>
      </Modal>,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    rerender(
      <Modal abierto titulo="Crear Nueva Comisión" onClose={() => {}}>
        <p>Formulario</p>
      </Modal>,
    )

    expect(screen.getByRole('dialog', { name: 'Crear Nueva Comisión' })).toBeInTheDocument()
  })

  it('se cierra con su botón de cerrar', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <Modal abierto titulo="Crear Nueva Comisión" onClose={onClose}>
        <p>Formulario</p>
      </Modal>,
    )

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('se cierra con Escape, y deja de escuchar cuando se cierra', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    const { rerender } = render(
      <Modal abierto titulo="Crear Nueva Comisión" onClose={onClose}>
        <p>Formulario</p>
      </Modal>,
    )

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(
      <Modal abierto={false} titulo="Crear Nueva Comisión" onClose={onClose}>
        <p>Formulario</p>
      </Modal>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('dibuja el pie que le pasan y el contenido', () => {
    render(
      <Modal
        abierto
        titulo="Crear Nueva Comisión"
        onClose={() => {}}
        pie={<Button>Guardar Comisión</Button>}
      >
        <p>Campos del alta</p>
      </Modal>,
    )

    expect(screen.getByText('Campos del alta')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar Comisión' })).toBeInTheDocument()
  })
})

describe('Input y Campo', () => {
  it('asocia la etiqueta con el control y escribe lo que se tipea', async () => {
    const user = userEvent.setup()
    render(<CodigoComision />)

    const campo = screen.getByLabelText('Código Comisión')
    expect(campo).toHaveAttribute('placeholder', 'Ej: CUR-111')

    await user.type(campo, 'CUR-111')
    expect(campo).toHaveValue('CUR-111')
  })

  it('muestra el error junto al campo y lo marca como inválido', () => {
    render(
      <Input
        id="sede"
        etiqueta="Sede"
        valor=""
        onChange={() => {}}
        obligatorio
        error="El campo Sede es obligatorio"
      />,
    )

    const campo = screen.getByLabelText(/Sede/)
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('El campo Sede es obligatorio')
  })

  it('aceita un control propio cuando el campo no es un input', () => {
    render(
      <Campo id="medio" etiqueta="Medio de Pago">
        <select id="medio">
          <option>Transferencia</option>
        </select>
      </Campo>,
    )

    expect(screen.getByLabelText('Medio de Pago')).toBeInTheDocument()
  })
})

describe('Card', () => {
  it('muestra el título literal que le pasan, sin transformarlo', () => {
    render(<Card titulo="Alertas de Gestión Pendiente">Cuerpo</Card>)

    const titulo = screen.getByRole('heading', { name: 'Alertas de Gestión Pendiente' })
    expect(titulo.className).not.toContain('uppercase')
    expect(screen.getByText('Cuerpo')).toBeInTheDocument()
  })
})

describe('Button', () => {
  it('no dispara nada cuando está deshabilitado', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(
      <Button disabled variante="secundario" onClick={onClick}>
        Próximamente
      </Button>,
    )

    const boton = screen.getByRole('button', { name: 'Próximamente' })
    expect(boton).toBeDisabled()

    await user.click(boton)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('dispara lo que le pasan cuando está habilitado', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(<Button onClick={onClick}>+ Nueva Comisión</Button>)
    await user.click(screen.getByRole('button', { name: '+ Nueva Comisión' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('formato es-AR', () => {
  it('escribe los importes con punto de miles y sin centavos', () => {
    expect(formatMoneda(45000)).toBe('$45.000')
    expect(formatMoneda(240000)).toBe('$240.000')
    expect(formatMoneda(0)).toBe('$0')
    expect(formatMoneda(null)).toBe('')
  })

  it('escribe las fechas cortas con barra', () => {
    expect(formatFechaCorta('2026-05-10')).toBe('10/05/2026')
    expect(formatFechaCorta(null)).toBe('')
  })
})
