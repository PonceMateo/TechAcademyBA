import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Badge, Card } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { CATEGORIA_INSCRIPCION } from '../domain/enums'
import { listarInscripcionesAlumno } from '../services/dataService'

/**
 * Cursos del alumno (11.2).
 *
 * **Una tarjeta por inscripción y ni una más.** El maqueteado tiene una sola inscripción en los datos
 * del cliente: agregar una segunda para ilustrar el caso bloqueado sería inventar un curso que el
 * alumno no tiene. El estado bloqueado se alcanza forzando el bloqueo de esta misma inscripción, que
 * es lo que hace la secretaría cuando el comprobante no se puede leer.
 *
 * **El bloqueo muestra la causa y ofrece el camino a `Mis Pagos`.** El prototipo no muestra ni una
 * cosa ni la otra, y las dos son la historia que hay dentro del alcance mínimo: un alumno bloqueado
 * que ve `Bloqueado` sin saber por qué ni qué hacer no puede resolverlo.
 *
 * **La categoría arancelaria es el mismo dato que muestra el padrón de la secretaría.** Los cuatro
 * valores del enum con su color viven en `paleta.js`, no en esta pantalla: si el color fuera de acá,
 * `Becado parcial` sería violeta en una pantalla y gris en otra.
 *
 * **Sin inscripciones no hay una lista vacía, hay un mensaje.** El spec pide que el alumno sin
 * cursos vea que no tiene cursos activos.
 */
const TONOS_CATEGORIA = {
  [CATEGORIA_INSCRIPCION.PARTICULAR]: { etiqueta: 'Particular', tono: TONO.GRIS },
  [CATEGORIA_INSCRIPCION.BECADO_PARCIAL]: { etiqueta: 'Becado parcial', tono: TONO.VIOLETA },
  [CATEGORIA_INSCRIPCION.BECADO_TOTAL]: { etiqueta: 'Becado total', tono: TONO.MAGENTA },
  [CATEGORIA_INSCRIPCION.CORPORATIVO]: { etiqueta: 'Corporativo', tono: TONO.CELESTE },
}

const SIN_INSCRIPCIONES = 'No tenés cursos activos en este período lectivo.'

function etiquetaCategoria(categoria, porcentajeBeca) {
  const definicion = TONOS_CATEGORIA[categoria] ?? { etiqueta: categoria, tono: TONO.GRIS }
  const conPorcentaje =
    definicion.etiqueta === 'Becado parcial' && porcentajeBeca !== null ? ` ${porcentajeBeca}%` : ''

  return `${definicion.etiqueta}${conPorcentaje}`
}

export function StudentCoursesPage() {
  const [inscripciones, setInscripciones] = useState([])
  const [cargadas, setCargadas] = useState(false)

  useEffect(() => {
    listarInscripcionesAlumno().then((resultado) => {
      setInscripciones(resultado)
      setCargadas(true)
    })
  }, [])

  if (cargadas && inscripciones.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Mis Cursos</h2>
        <Card titulo="Mis Cursos">
          <p className="text-sm text-slate-600">{SIN_INSCRIPCIONES}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Mis Cursos</h2>

      <div className="grid gap-4 lg:grid-cols-2">
        {inscripciones.map((inscripcion) => {
          const bloqueado = inscripcion.acceso.estado === 'BLOQUEADO'
          const tono = bloqueado ? TONO.ROJO : TONO.VERDE
          const estado = bloqueado ? 'Bloqueado' : 'Habilitado'

          return (
            <Card key={inscripcion.codigo}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tono={TONO.GRIS}>{inscripcion.codigo}</Badge>
                <Badge tono={tono}>{estado}</Badge>
              </div>

              <h3 className="mt-3 text-lg font-semibold text-slate-900">
                {inscripcion.nombre_curso}
              </h3>

              <p className="mt-3 text-sm text-slate-600">
                {`Docente · ${inscripcion.docente_nombre}`}
              </p>
              <p className="text-sm text-slate-600">{inscripcion.horario}</p>
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <span>Categoría</span>
                <Badge tono={TONOS_CATEGORIA[inscripcion.categoria]?.tono ?? TONO.GRIS}>
                  {etiquetaCategoria(inscripcion.categoria, inscripcion.porcentaje_beca)}
                </Badge>
              </p>

              {/* El banner es el estado de acceso, grande y con su causa. Es un estado del componente
                  y no una segunda tarjeta: el alumno tiene un curso, no dos. */}
              <div
                className={`mt-4 rounded-lg px-4 py-3 ${bloqueado ? 'bg-red-50' : 'bg-green-50'}`}
              >
                <p
                  className={`text-lg font-semibold ${
                    bloqueado ? 'text-red-800' : 'text-green-800'
                  }`}
                >
                  {estado}
                </p>
                {bloqueado && (
                  <p className="mt-1 text-sm">
                    {`Causa: ${inscripcion.acceso.causa}`}
                    <Link to="/alumno/pagos" className="ml-2 font-medium underline">
                      Ir a Mis Pagos
                    </Link>
                  </p>
                )}
              </div>

              <div className="mt-4">
                <Link
                  to={`/alumno/cursos/${inscripcion.codigo}`}
                  className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Ver detalle
                </Link>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
