import { useEffect, useState } from 'react'
import { Avatar, Badge, Card, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { obtenerPerfilDocente } from '../services/dataService'

/**
 * Perfil del docente (10.5).
 *
 * **Es la única pantalla del shell sin un solo control.** Ni un campo, ni un botón de guardado: el
 * spec la declara de solo lectura y el motivo es concreto —los cambios administrativos se piden a
 * Secretaría, y el chip y la nota lo dicen en pantalla.
 *
 * **El bloque de contacto muestra `Especialidad` y `Sede de referencia`, nada más.** El padrón de
 * docentes tiene correo y teléfono, pero la fuente del cliente no los registra para los docentes y
 * esta pantalla no los inventa: si el dato no existe para el cliente, tampoco se muestra.
 *
 * **El chip `DOCENTE · PERMISOS REDUCIDOS` va con la nota de a quién pedir los cambios.** Un chip
 * que dice "pocos permisos" sin decir a quién recurres deja la misma duda en las tres secciones.
 *
 * **El avatar y el nombre de la tarjeta son del maquetado, no de la sesión.** Son los mismos
 * placeholders del cliente que ya mostraba el pie del armazón; desde el change
 * `ui-figma-dashboards` el pie muestra el tagline y el período lectivo, así que estos dos literales
 * son contenido de esta tarjeta y viven acá.
 */
const PIE_AVATAR = 'PM'
const PIE_NOMBRE = 'Profe Martín'

const COLUMNAS = [
  {
    clave: 'codigo',
    titulo: 'CÓDIGO',
    render: (fila) => <span className="font-medium">{fila.codigo}</span>,
  },
  { clave: 'curso', titulo: 'CURSO', render: (fila) => fila.nombre_curso },
  { clave: 'horario', titulo: 'HORARIO', render: (fila) => fila.horario },
  {
    clave: 'estado',
    titulo: 'ESTADO',
    render: (fila) => (
      <Badge tono={fila.estado === 'Activa' ? TONO.VERDE : TONO.GRIS}>{fila.estado}</Badge>
    ),
  },
]

const CHIP_PERMISOS = 'DOCENTE · PERMISOS REDUCIDOS'
const NOTA_PERMISOS = 'Los cambios administrativos deben solicitarse a Secretaría BA.'

export function TeacherProfilePage() {
  const [perfil, setPerfil] = useState(null)

  useEffect(() => {
    obtenerPerfilDocente().then(setPerfil)
  }, [])

  if (perfil === null) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Mi Perfil</h2>
        <p className="text-sm text-slate-500">No hay ningún docente para mostrar.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Mi Perfil</h2>

      <Card titulo="Identidad">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar iniciales={PIE_AVATAR} tamano="grande" />

          <div>
            <p className="text-lg font-semibold text-slate-900">{PIE_NOMBRE}</p>
            <div className="mt-2">
              <Badge tono={TONO.AMBAR}>{CHIP_PERMISOS}</Badge>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600">{NOTA_PERMISOS}</p>
      </Card>

      <Card titulo="Datos de contacto">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Especialidad
            </dt>
            <dd className="text-sm text-slate-800">{perfil.especialidad}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Sede de referencia
            </dt>
            <dd className="text-sm text-slate-800">{perfil.sede}</dd>
          </div>
        </dl>

        <p className="mt-4 text-xs text-slate-500">
          Esta pantalla es de solo lectura: para cambiar un dato, pedilo a Secretaría BA.
        </p>
      </Card>

      <Card titulo="Comisiones asignadas">
        <Table
          columnas={COLUMNAS}
          filas={perfil.comisiones}
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
