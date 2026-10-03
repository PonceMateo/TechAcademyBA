import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Card, Table } from '../components/ui'
import { obtenerComisionesAsignadas } from '../services/dataService'

/**
 * Mis alumnos (10.3, primera parte del camino).
 *
 * **Es un selector de comisión y no el padrón.** El ítem `Mis Alumnos` del menú no puede abrir
 * directamente una comisión porque el docente puede tener más de una, así que esta pantalla lista
 * las suyas y de ahí se entra al padrón de la elegida. El caso del maquetado tiene una sola, que es
 * lo que el cliente registra, y la fila no se completa con comisiones inventadas.
 *
 * **No trae los contadores de acceso.** Los vive `Mis Comisiones`, que es donde el docente cruza
 * los indicadores con su padrón; repetirlos acá sería mostrar el mismo dato en dos lugares con dos
 * chances de contradecirse.
 */
const COLUMNAS = [
  {
    clave: 'codigo',
    titulo: 'CÓDIGO',
    render: (fila) => <span className="font-medium">{fila.codigo}</span>,
  },
  { clave: 'curso', titulo: 'CURSO', render: (fila) => fila.nombre_curso },
  { clave: 'docente', titulo: 'DOCENTE', render: (fila) => fila.docente_nombre },
  { clave: 'horario', titulo: 'HORARIO', render: (fila) => fila.horario },
  {
    clave: 'accion',
    titulo: 'ALUMNOS',
    render: (fila) => (
      <Link
        to={`/docente/alumnos/${fila.codigo}`}
        className="text-sm font-medium text-teal-800 underline"
      >
        Ver alumnos
      </Link>
    ),
  },
]

export function TeacherStudentsPage() {
  const [comisiones, setComisiones] = useState([])

  useEffect(() => {
    obtenerComisionesAsignadas().then(setComisiones)
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Mis Alumnos</h2>

      <Card titulo="Comisiones donde doy clases">
        <Table
          columnas={COLUMNAS}
          filas={comisiones}
          claveDeFila={(fila) => fila.codigo}
          vacio={
            <p className="text-sm text-slate-500">
              No tenés comisiones asignadas en este período lectivo.
            </p>
          }
        />
      </Card>
    </div>
  )
}
