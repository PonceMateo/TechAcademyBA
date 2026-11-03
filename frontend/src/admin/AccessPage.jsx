import { useEffect, useState } from 'react'
import { useSession } from '../auth/SessionContext'
import { Badge, Button, Campo, Card, Input, StatusIndicator } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import {
  buscarAlumnos,
  forzarBloqueoManual,
  listarComisiones,
  listarEmailsHabilitados,
  listarEmpresas,
  obtenerAlumno,
} from '../services/dataService'
import { formatFechaCorta } from '../utils/formato'

/**
 * Habilitación de accesos (9.7 y HU 64).
 *
 * **La ficha tiene una sección por inscripción activa.** La categoría arancelaria y la habilitación
 * son de la inscripción, no del alumno: una cursada corporativa cubierta por una empresa y otra
 * particular se leen por separado. Las inscripciones que no están `ACTIVA` no se muestran; la ficha
 * modal de la HU 61 es la que las muestra todas con su estado.
 *
 * **La búsqueda no depende de una ruta de habilitación.** Se resuelve contra el padrón por DNI,
 * email o nombre con `GET /alumnos?q=` y, cuando no hay alumno, contra las cuentas corporativas por
 * CUIT o razón social. La ruta `/habilitaciones/consulta` que usaba antes nunca existió en el
 * backend, así que la pantalla solo funcionaba con datos de ejemplo.
 *
 * **El motivo del forzado es obligatorio y el error va pegado a su campo.** La historia #27 pide
 * motivo, usuario y fecha de la operación; el prototipo ofrece el botón y ningún campo. El forzado
 * sigue siendo **sobre el alumno**: extenderlo a una sección con su endpoint es la H/U 30.
 *
 * **La copia de correos filtra por acceso, no por categoría.** Copia los correos de los alumnos
 * habilitados de la comisión elegida del catálogo real y, cuando no hay ninguno, informa que no hay
 * nada para copiar en lugar de copiar una lista vacía.
 */

const AYUDA_BUSQUEDA =
  'Buscá por DNI de alumno, Email institucional, CUIT de empresa o Razón Social.'

const TEXTO_HABILITADO = 'El alumno cumple con la condición arancelaria.'

const SIN_DOCUMENTO = 'Sin DNI (alumno exterior)'

function etiquetaCategoria(categoria, porcentajeBeca) {
  const nombres = {
    PARTICULAR: 'Particular',
    BECADO_PARCIAL: `Becado parcial ${porcentajeBeca}%`,
    BECADO_TOTAL: 'Becado total',
    CORPORATIVO: 'Corporativo',
  }

  return nombres[categoria] ?? categoria
}

/** Fecha de hoy en formato ISO, en hora local: es la fecha de la operación del override. */
function hoy() {
  const ahora = new Date()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${ahora.getFullYear()}-${mes}-${dia}`
}

function fichaDe(resultado) {
  if (resultado === null) {
    return null
  }

  if (resultado.tipo === 'EMPRESA') {
    const empresa = resultado.empresa

    return {
      documento: empresa.cuit,
      nombre_completo: empresa.razon_social,
      email_registrado: 'Sin email en el padrón de alumnos',
    }
  }

  const alumno = resultado.alumno

  return {
    documento: alumno.documento ?? SIN_DOCUMENTO,
    nombre_completo: alumno.nombre,
    email_registrado: alumno.email,
  }
}

/** Campos de la ficha resumen, en el orden del spec. */
const CAMPOS_FICHA = [
  { clave: 'documento', etiqueta: 'DNI / Documento' },
  { clave: 'nombre_completo', etiqueta: 'Nombre Completo' },
  { clave: 'email_registrado', etiqueta: 'Email Registrado' },
]

export function AccessPage() {
  const { session } = useSession()
  const [consulta, setConsulta] = useState('')
  const [resultado, setResultado] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [errorMotivo, setErrorMotivo] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [copiados, setCopiados] = useState(null)
  const [comisiones, setComisiones] = useState(null)
  const [elegida, setElegida] = useState('')

  useEffect(() => {
    listarComisiones()
      .then(setComisiones)
      .catch(() => setComisiones([]))
  }, [])

  async function consultar() {
    setAviso(null)
    setCopiados(null)
    setErrorMotivo(null)
    setMotivo('')

    const texto = consulta.trim()
    if (texto === '') {
      setAviso('Escribí un DNI, un email, un CUIT o una razón social para consultar.')
      return
    }

    try {
      const alumnos = await buscarAlumnos(texto)
      if (alumnos.length > 0) {
        const alumno = await obtenerAlumno(alumnos[0].id)
        const inscripciones = (alumno.inscripciones ?? []).filter(
          (inscripcion) => inscripcion.estado === 'ACTIVA',
        )
        setResultado({ tipo: 'ALUMNO', alumno, inscripciones })
        return
      }

      // Sin alumno, la consulta puede ser una cuenta corporativa: el CUIT se compara en dígitos y
      // la razón social sin distinguir mayúsculas, porque el padrón no acepta `q` para empresas.
      const empresas = await listarEmpresas()
      const digitos = texto.replace(/\D/g, '')
      const aguja = texto.toLowerCase()
      const empresa = empresas.find(
        (candidata) =>
          (digitos !== '' &&
            (candidata.cuit_norm ?? String(candidata.cuit ?? '').replace(/\D/g, '')) === digitos) ||
          String(candidata.razon_social).toLowerCase().includes(aguja),
      )

      if (empresa === undefined) {
        setResultado(null)
        setAviso(`No encontramos a nadie con «${texto}» en el padrón ni en las cuentas corporativas.`)
        return
      }

      setResultado({ tipo: 'EMPRESA', empresa })
    } catch (error) {
      setResultado(null)
      setAviso(error.message)
    }
  }

  async function forzar() {
    if (resultado?.tipo !== 'ALUMNO') {
      setAviso('Primero consultá a un alumno: el forzado manual es sobre un alumno del padrón.')
      return
    }

    if (motivo.trim() === '') {
      setErrorMotivo('El motivo es obligatorio.')
      return
    }

    setErrorMotivo(null)
    try {
      await forzarBloqueoManual({
        alumnoId: resultado.alumno.id,
        motivo,
        usuario: session.nombre,
        fechaOperacion: hoy(),
      })
      // El estado se deriva de la inscripción, así que se vuelve a pedir el detalle: el forzado
      // aparece en cada una de sus secciones activas.
      const alumno = await obtenerAlumno(resultado.alumno.id)
      setResultado({
        tipo: 'ALUMNO',
        alumno,
        inscripciones: (alumno.inscripciones ?? []).filter(
          (inscripcion) => inscripcion.estado === 'ACTIVA',
        ),
      })
      setMotivo('')
      setAviso('Bloqueo forzado. Queda registrado con el usuario y la fecha de la operación.')
    } catch (error) {
      setAviso(error.message)
    }
  }

  async function copiar(codigo) {
    let correos
    try {
      correos = await listarEmailsHabilitados(codigo)
    } catch (error) {
      setCopiados(null)
      setAviso(error.message)
      return
    }

    if (correos.length === 0) {
      setCopiados(null)
      setAviso(`No hay correos para copiar: ${codigo} no tiene alumnos habilitados.`)
      return
    }

    setCopiados(correos)
    setAviso(
      `Se copiaron los correos de los alumnos habilitados de ${codigo}. Los bloqueados no van en la lista.`,
    )

    // El portapapeles del navegador es un permiso que puede estar denegado. La lista queda
    // escrita en pantalla igual, así que la acción sirve aunque la copia no ocurra.
    try {
      await globalThis.navigator?.clipboard?.writeText(correos.join(', '))
    } catch {
      // Sin portapapeles no hay nada que avisar: el resultado ya está a la vista.
    }
  }

  const ficha = fichaDe(resultado)

  return (
    <div className="space-y-4">
      <Card titulo="Buscador de Alumnos y Cuentas Corporativas">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-sm">
            <Input
              id="consulta-habilitacion"
              etiqueta="Buscar alumno o cuenta corporativa"
              valor={consulta}
              onChange={(evento) => setConsulta(evento.target.value)}
              placeholder="DNI, Email institucional, CUIT o Razón Social"
            />
          </div>
          <Button onClick={consultar}>Consultar Habilitación</Button>
        </div>

        <p className="mt-3 text-xs text-slate-500">{AYUDA_BUSQUEDA}</p>
      </Card>

      <Card titulo="Ficha Resumen del Alumno">
        {ficha === null ? (
          <p className="text-sm text-slate-500">
            Todavía no consultaste a nadie. Escribí un dato arriba y pulsá Consultar Habilitación.
          </p>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            {CAMPOS_FICHA.map((campo) => (
              <div key={campo.clave}>
                <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  {campo.etiqueta}
                </dt>
                <dd className="text-sm text-slate-800">{ficha[campo.clave]}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <Card titulo="Estado del Acceso">
        {resultado === null ? (
          <p className="text-sm text-slate-500">Sin consulta, no hay estado que mostrar.</p>
        ) : resultado.tipo === 'EMPRESA' ? (
          <p className="text-sm text-slate-600">
            La habilitación de una cuenta corporativa se deriva de sus cobranzas acreditadas y se
            revisa en la pantalla de cobranzas. La ficha muestra su CUIT, su razón social y su
            contrato, sin secciones de inscripción.
          </p>
        ) : resultado.inscripciones.length === 0 ? (
          <p className="text-sm text-slate-500">
            {`${resultado.alumno.nombre} no tiene inscripciones activas. El estado de sus inscripciones terminadas se ve en su ficha.`}
          </p>
        ) : (
          <div className="grid gap-4">
            {resultado.inscripciones.map((inscripcion) => (
              <section
                key={inscripcion.id}
                aria-label={`${inscripcion.comision.codigo} ${inscripcion.comision.nombre}`}
                className="rounded-md border border-slate-200 p-4"
              >
                <h3 className="font-medium text-slate-900">
                  {`${inscripcion.comision.codigo} ${inscripcion.comision.nombre}`}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {`Categoría Arancelaria: ${etiquetaCategoria(
                    inscripcion.categoria,
                    inscripcion.porcentaje_beca,
                  )}`}
                </p>
                <div className="mt-2">
                  <StatusIndicator
                    estado={inscripcion.acceso.estado}
                    causa={inscripcion.acceso.causa}
                    habilitadoTexto={TEXTO_HABILITADO}
                  />
                </div>
                {inscripcion.acceso.forzado !== undefined && inscripcion.acceso.forzado !== null && (
                  <p className="mt-2 text-xs text-slate-600">
                    {typeof inscripcion.acceso.forzado === 'object'
                      ? `Bloqueo forzado por ${inscripcion.acceso.forzado.usuario} el ${formatFechaCorta(inscripcion.acceso.forzado.fecha_operacion)}. Motivo: ${inscripcion.acceso.forzado.motivo}`
                      : `Bloqueo forzado manualmente.`}
                  </p>
                )}
              </section>
            ))}
          </div>
        )}
      </Card>

      <Card titulo="ACCIONES EXCEPCIONALES">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-md">
            <Input
              id="motivo"
              etiqueta="Motivo"
              valor={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              obligatorio
              error={errorMotivo}
            />
          </div>
          <Button variante="peligro" onClick={forzar}>
            Forzar Bloqueo Manual
          </Button>
        </div>

        {comisiones !== null && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="w-full max-w-md">
              <Campo etiqueta="Comisión" id="comision-copia">
                <select
                  id="comision-copia"
                  value={elegida}
                  onChange={(evento) => setElegida(evento.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">Elegí una comisión</option>
                  {comisiones.map((comision) => (
                    <option key={comision.codigo} value={comision.codigo}>
                      {comision.codigo}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>

            {elegida !== '' && (
              <Button variante="secundario" onClick={() => copiar(elegida)}>
                {`Copiar emails habilitados de ${elegida}`}
              </Button>
            )}
          </div>
        )}

        {aviso !== null && (
          <p role="status" className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {aviso}
          </p>
        )}

        {copiados !== null && (
          <ul
            aria-label="Correos copiados"
            className="mt-3 space-y-1 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            {copiados.map((correo) => (
              <li key={correo}>{correo}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card titulo="Emisión de Certificados">
        {/* Fuera del alcance mínimo: se muestra el hueco, sin pantalla detrás (D20). */}
        <div className="flex items-center gap-2">
          <Button variante="secundario" disabled>
            Emitir certificados
          </Button>
          <Badge tono={TONO.GRIS}>Próximamente</Badge>
        </div>
      </Card>
    </div>
  )
}
