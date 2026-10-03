import { useEffect, useState } from 'react'
import { Badge, Button, Card, Input, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { buscarDocentes } from '../services/dataService'

/**
 * Padrón de docentes (9.4).
 *
 * **Las columnas son las del dato, no las del modelo.** El modelo tiene `nombre` y `apellido` por
 * separado y un `activo` booleano; la pantalla muestra el nombre completo, el CUIL junto al DNI y
 * el estado `Activa`. La unión de las dos primeras columnas es el nombre que el cliente escribe,
 * y por eso se arma acá y no en el mock.
 *
 * **`+ Nuevo Docente` está sin formulario detrás, a propósito.** El prototipo no tiene esta
 * pantalla y el alta del docente es una historia del alcance mínimo, pero en este change es
 * maqueta: el botón existe y no abre nada. Lo mismo con el control de clases dictadas, que además
 * se muestra deshabilitado con `Próximamente` para que el cliente vea el hueco (D20).
 *
 * **La búsqueda filtra por el servicio**, no sobre el arreglo que ya está en la pantalla: el mismo
 * criterio tiene que servir cuando los datos vengan de la API.
 */
const COLUMNAS = [
  {
    clave: 'nombre',
    titulo: 'DOCENTE',
    render: (fila) => <span className="font-medium">{fila.nombre}</span>,
  },
  { clave: 'dni', titulo: 'DNI', render: (fila) => fila.dni },
  { clave: 'cuil', titulo: 'CUIL', render: (fila) => fila.cuil },
  { clave: 'email', titulo: 'EMAIL', render: (fila) => fila.email },
  { clave: 'telefono', titulo: 'TELÉFONO', render: (fila) => fila.telefono },
  { clave: 'catedra', titulo: 'CÁTEDRA O ESPECIALIDAD', render: (fila) => fila.catedra },
  {
    clave: 'comisiones',
    titulo: 'COMISIONES ASIGNADAS',
    render: (fila) => fila.comisiones_asignadas,
  },
  {
    clave: 'estado',
    titulo: 'ESTADO',
    render: (fila) => (
      <Badge tono={fila.activo ? TONO.VERDE : TONO.GRIS}>{fila.activo ? 'Activa' : 'Baja'}</Badge>
    ),
  },
]

export function TeachersPage() {
  const [docentes, setDocentes] = useState([])
  const [consulta, setConsulta] = useState('')

  useEffect(() => {
    buscarDocentes(consulta).then(setDocentes)
  }, [consulta])

  return (
    <div className="space-y-4">
      <Card
        titulo="Padrón de Docentes"
        acciones={
          // Sin formulario detrás: el alta real llega con la historia #9.
          <Button variante="secundario">+ Nuevo Docente</Button>
        }
      >
        <div className="mb-4 max-w-sm">
          <Input
            id="buscar-docente"
            etiqueta="Buscar docente"
            valor={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
            placeholder="Buscar por nombre, apellido, DNI o email…"
          />
        </div>

        <Table
          columnas={COLUMNAS}
          filas={docentes}
          vacio={<p className="text-sm text-slate-500">No se encontraron resultados.</p>}
        />
      </Card>

      <Card titulo="Control de Clases Dictadas">
        {/* Fuera del alcance mínimo: se muestra el hueco y no una pantalla vacía detrás (D20). */}
        <div className="flex items-center gap-2">
          <Button variante="secundario" disabled>
            Control de clases dictadas
          </Button>
          <Badge tono={TONO.GRIS}>Próximamente</Badge>
        </div>
      </Card>
    </div>
  )
}
