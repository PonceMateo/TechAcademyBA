import { useEffect, useState } from 'react'
import { Badge, Button, Modal, StatusIndicator } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { CATEGORIA_INSCRIPCION, ESTADO_HABILITACION } from '../domain/enums'
import { formatDocumento, formatMonedaConCentavos, formatTelefono } from '../utils/formato'
import { obtenerAlumno } from '../services/dataService'

/**
 * Ficha del alumno en modal (HU 61).
 *
 * **Se monta al abrir y se desmonta al cerrar.** El padrón ya no trae datos de inscripción (HU 64),
 * así que la categoría, el estado de acceso y los importes se consultan en `GET /alumnos/{id}` en
 * el momento de abrir: no hay ruta nueva, el saldo no queda viejo después de cobrar y el estado de
 * la ficha no sobrevive a un alumno para mostrarse sobre otro.
 *
 * **Una pestaña por inscripción, activa o no.** La categoría, la empresa y el acceso son de la
 * inscripción, no del alumno. En las `ACTIVA` se muestra el estado de habilitación con su causa; en
 * las demás, el estado de la inscripción, porque una cursada terminada no tiene bloqueo que
 * derivar. Los importes se muestran igual: la deuda de una cursada terminada existe.
 *
 * **El dinero sale de la misma regla que el estado.** El backend deriva el requerido con el arancel
 * actual y lo cuantiza a centavos; acá se muestra con centavos para que un saldo de `0,01` no se
 * lea como `$0` al lado de un acceso bloqueado. Una inscripción corporativa se muestra a cargo de
 * la empresa y una becada total, exenta.
 *
 * **Los datos personales van en modo lectura.** Editar, restablecer la contraseña y eliminar viven
 * en el menú `⋮`; la categoría se cambia desde la pestaña abierta. La ficha solo abre esos modales.
 *
 * **Un detalle que no llega no se inventa.** Mientras la consulta corre la ficha lo dice, y si
 * falla muestra el motivo: sin inscripciones, estados ni importes de relleno.
 */

/** Lo que el cliente escribe en la planilla cuando el alumno no tiene documento (D30). */
const SIN_DOCUMENTO = 'Sin DNI (alumno exterior)'

const SIN_DATO = '—'

const TEXTO_HABILITADO = 'El alumno cumple con la condición arancelaria.'

const SIN_INSCRIPCIONES =
  'Este alumno todavía no tiene inscripciones. Inscribilo en una comisión para ver su categoría, su estado y su saldo.'

const TONOS_CATEGORIA = {
  [CATEGORIA_INSCRIPCION.PARTICULAR]: { etiqueta: 'Particular', tono: TONO.GRIS },
  [CATEGORIA_INSCRIPCION.BECADO_PARCIAL]: { etiqueta: 'Becado parcial', tono: TONO.VIOLETA },
  [CATEGORIA_INSCRIPCION.BECADO_TOTAL]: { etiqueta: 'Becado total', tono: TONO.MAGENTA },
  [CATEGORIA_INSCRIPCION.CORPORATIVO]: { etiqueta: 'Corporativo', tono: TONO.CELESTE },
}

const CAMPOS_DATOS = [
  { clave: 'documento', etiqueta: 'DNI' },
  { clave: 'nombre', etiqueta: 'Nombre Completo' },
  { clave: 'email', etiqueta: 'Email Registrado' },
  { clave: 'telefono', etiqueta: 'Teléfono' },
]

function datosDeLectura(alumno) {
  return {
    documento: formatDocumento(alumno.documento ?? SIN_DOCUMENTO),
    nombre: alumno.nombre,
    email: alumno.email,
    telefono: alumno.telefono ? formatTelefono(alumno.telefono) : SIN_DATO,
  }
}

function etiquetaCategoria(inscripcion) {
  const definicion = TONOS_CATEGORIA[inscripcion.categoria] ?? {
    etiqueta: inscripcion.categoria,
    tono: TONO.GRIS,
  }
  const conPorcentaje =
    inscripcion.categoria === CATEGORIA_INSCRIPCION.BECADO_PARCIAL &&
    inscripcion.porcentaje_beca !== null
      ? ` ${inscripcion.porcentaje_beca}%`
      : ''

  return `${definicion.etiqueta}${conPorcentaje}`
}

/**
 * El saldo que muestra la pestaña: la empresa cuando es corporativo, `Exento` cuando el requerido
 * es cero por beca total y, si no, el saldo pendiente con centavos.
 */
function saldoDe(inscripcion) {
  if (inscripcion.saldo_pendiente === null || inscripcion.saldo_pendiente === undefined) {
    return 'A cargo de la empresa'
  }
  if (Number(inscripcion.monto_requerido) === 0) {
    return 'Exento'
  }
  return formatMonedaConCentavos(inscripcion.saldo_pendiente)
}

function PanelInscripcion({ inscripcion, onCambiarCategoria }) {
  const definicion = TONOS_CATEGORIA[inscripcion.categoria] ?? {
    etiqueta: inscripcion.categoria,
    tono: TONO.GRIS,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm text-slate-700">
            {`${inscripcion.comision.codigo} ${inscripcion.comision.nombre}`}
          </p>
          <p className="flex items-center gap-2 text-sm text-slate-700">
            Categoría
            <Badge tono={definicion.tono}>{etiquetaCategoria(inscripcion)}</Badge>
          </p>
          {inscripcion.empresa !== null && inscripcion.empresa !== undefined && (
            <p className="text-sm text-slate-700">
              {`Empresa: ${inscripcion.empresa.razon_social}`}
            </p>
          )}
        </div>
        <Button variante="secundario" tamano="chico" onClick={() => onCambiarCategoria(inscripcion)}>
          Categoría
        </Button>
      </div>

      {inscripcion.acceso !== null && inscripcion.acceso !== undefined ? (
        <div className="space-y-1">
          <StatusIndicator
            estado={inscripcion.acceso.estado}
            causa={inscripcion.acceso.causa}
            habilitadoTexto={TEXTO_HABILITADO}
          />
          {inscripcion.acceso.estado === ESTADO_HABILITACION.BLOQUEADO &&
            inscripcion.acceso.forzado === true && (
              <p className="text-xs text-slate-600">
                Bloqueo forzado manualmente: queda registrado con el usuario y la fecha.
              </p>
            )}
        </div>
      ) : (
        <p className="text-sm text-slate-700">
          {`Estado de la inscripción: ${inscripcion.estado}`}
        </p>
      )}

      <dl className="grid gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total pagado
          </dt>
          <dd className="mt-1 text-slate-900 tabular-nums">
            {formatMonedaConCentavos(inscripcion.total_pagado ?? 0)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Pendiente de acreditación
          </dt>
          <dd className="mt-1 text-slate-900 tabular-nums">
            {formatMonedaConCentavos(inscripcion.total_observado ?? 0)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Saldo pendiente
          </dt>
          <dd className="mt-1 text-slate-900 tabular-nums">{saldoDe(inscripcion)}</dd>
        </div>
      </dl>
    </div>
  )
}

export function FichaAlumnoModal({
  alumno,
  version = 0,
  onClose,
  onEditar,
  onRestablecerPassword,
  onEliminar,
  onCambiarCategoria,
}) {
  const [detalle, setDetalle] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState(null)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [pestana, setPestana] = useState(0)

  useEffect(() => {
    let vigente = true

    obtenerAlumno(alumno.id)
      .then((resultado) => {
        if (vigente) {
          setDetalle(resultado)
          setFallo(null)
        }
      })
      .catch((error) => {
        if (vigente) {
          setFallo(error?.message ?? 'No se pudo consultar la ficha del alumno.')
        }
      })
      .finally(() => {
        if (vigente) {
          setCargando(false)
        }
      })

    return () => {
      vigente = false
    }
  }, [alumno, version])

  const datos = datosDeLectura(detalle ?? alumno)
  const inscripciones = detalle?.inscripciones ?? []
  // El índice no puede apuntar fuera de la lista cuando una recategorización recarga el detalle.
  const indiceActivo = Math.min(pestana, Math.max(inscripciones.length - 1, 0))
  const inscripcionActiva = inscripciones[indiceActivo] ?? null

  function elegirAccion(accion) {
    setMenuAbierto(false)
    accion(alumno)
  }

  return (
    <Modal
      abierto
      titulo="Ficha del alumno"
      onClose={onClose}
      pie={
        <Button variante="secundario" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <dl className="grid flex-1 gap-3 sm:grid-cols-2">
            {CAMPOS_DATOS.map((campo) => (
              <div key={campo.clave}>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {campo.etiqueta}
                </dt>
                <dd className="mt-1 text-sm text-slate-900">{datos[campo.clave]}</dd>
              </div>
            ))}
          </dl>

          <div className="relative">
            <button
              type="button"
              aria-label="Acciones del alumno"
              aria-haspopup="menu"
              aria-expanded={menuAbierto}
              onClick={() => setMenuAbierto((abiertoAntes) => !abiertoAntes)}
              className="foco-acento rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
            >
              ⋮
            </button>

            {menuAbierto && (
              <div
                role="menu"
                className="absolute right-0 z-10 mt-1 min-w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => elegirAccion(onEditar)}
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  Editar
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => elegirAccion(onRestablecerPassword)}
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  Restablecer contraseña
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => elegirAccion(onEliminar)}
                  className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>

        {cargando && <p className="text-sm text-slate-500">Cargando la ficha…</p>}

        {fallo !== null && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {fallo}
          </p>
        )}

        {detalle !== null && inscripciones.length === 0 && (
          <p className="text-sm text-slate-500">{SIN_INSCRIPCIONES}</p>
        )}

        {inscripciones.length > 0 && (
          <>
            <div role="tablist" aria-label="Inscripciones del alumno" className="flex flex-wrap gap-2">
              {inscripciones.map((inscripcion, indice) => (
                <button
                  key={inscripcion.id}
                  type="button"
                  role="tab"
                  id={`pestana-inscripcion-${inscripcion.id}`}
                  aria-selected={indice === indiceActivo}
                  aria-controls={`panel-inscripcion-${inscripcion.id}`}
                  onClick={() => setPestana(indice)}
                  className={`foco-acento rounded-md border px-3 py-1.5 text-sm ${
                    indice === indiceActivo
                      ? 'border-slate-300 bg-white font-medium text-slate-900 shadow-sm'
                      : 'border-transparent text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {`${inscripcion.comision.codigo} · ${inscripcion.comision.nombre}`}
                </button>
              ))}
            </div>

            {inscripcionActiva !== null && (
              <div
                role="tabpanel"
                id={`panel-inscripcion-${inscripcionActiva.id}`}
                aria-labelledby={`pestana-inscripcion-${inscripcionActiva.id}`}
              >
                <PanelInscripcion
                  inscripcion={inscripcionActiva}
                  onCambiarCategoria={onCambiarCategoria}
                />
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
