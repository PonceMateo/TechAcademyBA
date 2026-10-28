import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Badge, Card } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { CATEGORIA_INSCRIPCION, ESTADO_HABILITACION } from '../domain/enums'
import { listarInscripcionesAlumno } from '../services/dataService'

/**
 * `Mis Cursos` (`/alumno/cursos`): la tarjeta de cada inscripción real del alumno (HUs 38 y 42).
 *
 * **Una tarjeta por inscripción y ni una más.** El estado bloqueado es un estado de la misma
 * tarjeta, no una segunda: cuando la inscripción no tiene un pago acreditado o Secretaría la forzó,
 * esa tarjeta se pinta con el banner `Bloqueado`, la causa que ve Administración y el camino a
 * `Mis Pagos`.
 *
 * **La pantalla distingue "no lo sé" de "no hay".** `inscripciones` arranca en `null` y sigue en
 * `null` si la consulta falla, así que el mensaje de que el alumno no tiene cursos **solo** aparece
 * cuando la fuente confirmó una lista vacía. Mientras carga se dice que está cargando, y si la
 * consulta falla se dice eso: la ausencia de tarjetas significa "todavía no lo sé" hasta que la
 * consulta resuelve.
 *
 * **El docente puede no estar asignado.** La comisión admite `docente_id` nulo, así que la línea
 * dice `a confirmar` en lugar de nombrar a una persona inventada.
 *
 * El tablero con los indicadores y la agenda vive en `/alumno` (`StudentDashboardPage`); esta
 * pantalla es la lista de cursadas a la que llega el ítem `Mis Cursos` del panel lateral.
 */

const TONOS_CATEGORIA = {
  [CATEGORIA_INSCRIPCION.PARTICULAR]: { etiqueta: 'Particular', tono: TONO.GRIS },
  [CATEGORIA_INSCRIPCION.BECADO_PARCIAL]: { etiqueta: 'Becado parcial', tono: TONO.VIOLETA },
  [CATEGORIA_INSCRIPCION.BECADO_TOTAL]: { etiqueta: 'Becado total', tono: TONO.MAGENTA },
  [CATEGORIA_INSCRIPCION.CORPORATIVO]: { etiqueta: 'Corporativo', tono: TONO.CELESTE },
}

const SIN_INSCRIPCIONES = 'No tenés cursos activos en este período lectivo.'
const CARGANDO = 'Cargando tus cursos…'
const NO_SE_PUDO_LEER = 'No pudimos cargar tus cursos. Volvé a intentar en un momento.'
const DOCENTE_A_CONFIRMAR = 'a confirmar'

function etiquetaCategoria(categoria, porcentajeBeca) {
  const definicion = TONOS_CATEGORIA[categoria] ?? { etiqueta: categoria, tono: TONO.GRIS }
  const conPorcentaje =
    definicion.etiqueta === 'Becado parcial' && porcentajeBeca !== null ? ` ${porcentajeBeca}%` : ''

  return `${definicion.etiqueta}${conPorcentaje}`
}

/** Tarjeta de una cursada: identificación, datos de la comisión y estado de acceso. */
function TarjetaCurso({ inscripcion }) {
  const bloqueada = inscripcion.acceso.estado === ESTADO_HABILITACION.BLOQUEADO
  const tono = bloqueada ? TONO.ROJO : TONO.VERDE
  const estado = bloqueada ? 'Bloqueado' : 'Habilitado'
  const docente = inscripcion.docente_nombre ?? DOCENTE_A_CONFIRMAR
  const categoria = TONOS_CATEGORIA[inscripcion.categoria] ?? { tono: TONO.GRIS }

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tono={TONO.DORADO}>{inscripcion.codigo}</Badge>
        <Badge tono={tono}>{estado}</Badge>
      </div>

      <h3 className="mt-3 text-lg font-semibold text-slate-900">{inscripcion.nombre_curso}</h3>

      <p className="mt-3 text-sm text-slate-600">{`Docente · ${docente}`}</p>
      <p className="text-sm text-slate-600">{inscripcion.horario}</p>
      <p className="flex items-center gap-2 text-sm text-slate-600">
        <span>Categoría</span>
        <Badge tono={categoria.tono}>
          {etiquetaCategoria(inscripcion.categoria, inscripcion.porcentaje_beca)}
        </Badge>
      </p>

      {/* El banner es el estado de acceso, grande y con su causa. Es un estado del componente y no
          una segunda tarjeta: el alumno tiene un curso, no dos. */}
      <div className={`mt-4 rounded-xl px-4 py-3 ${bloqueada ? 'bg-red-50' : 'bg-green-50'}`}>
        <p className={`text-lg font-semibold ${bloqueada ? 'text-red-800' : 'text-green-800'}`}>
          {estado}
        </p>
        {bloqueada ? (
          <p className="mt-1 text-sm text-red-900">
            {`Causa: ${inscripcion.acceso.causa}`}
            <Link to="/alumno/pagos" className="foco-acento ml-2 rounded font-medium underline">
              Ir a Mis Pagos
            </Link>
          </p>
        ) : (
          <p className="mt-1 text-sm text-green-900">Tu acceso a la clase está habilitado.</p>
        )}
      </div>

      <div className="mt-4 flex-1" />

      <div>
        <Link
          to={`/alumno/cursos/${inscripcion.codigo}`}
          className="boton-primario foco-acento inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white transition"
        >
          Ver detalle
        </Link>
      </div>
    </Card>
  )
}

export function StudentCoursesPage() {
  const [inscripciones, setInscripciones] = useState(null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    listarInscripcionesAlumno()
      .then(setInscripciones)
      .catch(() => {
        // El rechazo deja `inscripciones` en `null`: la pantalla no sabe cuántas hay, no afirma que
        // sean cero y lo dice en lugar de mostrar el mensaje de "no tenés cursos".
        setFallo(true)
      })
  }, [])

  const cargando = inscripciones === null && !fallo
  const sinCursos = inscripciones !== null && inscripciones.length === 0

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Mis Cursos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Una tarjeta por cada cursada en la que estás inscripto.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-slate-800">Cursadas</h2>
          {inscripciones !== null && (
            <Badge tono={TONO.GRIS}>
              {`${inscripciones.length} ${inscripciones.length === 1 ? 'cursada' : 'cursadas'}`}
            </Badge>
          )}
        </div>

        {cargando && (
          <Card>
            <p className="text-sm text-slate-500">{CARGANDO}</p>
          </Card>
        )}

        {fallo && (
          <Card>
            <p className="text-sm text-red-700">{NO_SE_PUDO_LEER}</p>
          </Card>
        )}

        {sinCursos && (
          <Card>
            <p className="text-sm text-slate-600">{SIN_INSCRIPCIONES}</p>
          </Card>
        )}

        {(inscripciones ?? []).length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {inscripciones.map((inscripcion) => (
              <TarjetaCurso key={inscripcion.codigo} inscripcion={inscripcion} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
