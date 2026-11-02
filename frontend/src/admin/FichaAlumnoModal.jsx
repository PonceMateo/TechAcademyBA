import { useEffect, useState } from 'react'
import { Badge, Modal, Select, StatusIndicator, Tooltip } from '../components/ui'
import { textoCausa } from './causasBloqueo'
import { TONO } from '../components/ui/paleta'
import { CATEGORIA_INSCRIPCION } from '../domain/enums'
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
 * **Una comisión a la vez.** El selector elige entre las inscripciones del alumno, activas o no.
 * La categoría, la empresa y el acceso son de la inscripción: en las `ACTIVA` se muestra el estado
 * de habilitación con su causa —y si está forzado, se dice—; en las demás, el estado de la
 * inscripción, porque una cursada terminada no tiene bloqueo que derivar.
 *
 * **El dinero se muestra, no se calcula.** «Arancel a abonar» es `monto_requerido` y «Saldo
 * pendiente» es `saldo_pendiente`, los dos derivados por el backend con el arancel actual y
 * cuantizados a centavos (D68 y D70). Lo observado no descuenta: se informa aparte con un
 * indicador que solo aparece cuando hay algo observado. Una inscripción corporativa se muestra a
 * cargo de la empresa y una becada total, exenta.
 *
 * **Los datos personales van en modo lectura.** Editar, restablecer la contraseña y eliminar viven
 * en el menú `⋮`; la categoría se cambia desde la comisión elegida. La ficha solo abre esos modales.
 *
 * **Un detalle que no llega no se inventa.** Mientras la consulta corre la ficha lo dice, y si
 * falla muestra el motivo: sin inscripciones, estados ni importes de relleno.
 */

/** Lo que el cliente escribe en la planilla cuando el alumno no tiene documento (D30). */
const SIN_DOCUMENTO = 'Sin DNI (alumno exterior)'

const SIN_DATO = '—'

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
  { clave: 'nombre', etiqueta: 'Nombre completo' },
  { clave: 'email', etiqueta: 'Email registrado' },
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

/** Una fila etiqueta/valor de la ficha: la etiqueta en gris, el valor en peso medio a la derecha. */
function Fila({ etiqueta, children }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
      <dt className="text-sm text-slate-500">{etiqueta}</dt>
      <dd className="flex items-center gap-2 text-right text-sm font-medium text-slate-900">
        {children}
      </dd>
    </div>
  )
}

/**
 * El aviso de comprobantes observados: solo aparece cuando hay algo observado, y se muestra con
 * hover y con el foco del teclado. El botón apunta al texto con `aria-describedby`.
 */
function IndicadorObservados({ observado }) {
  return (
    <Tooltip
      id="ayuda-comprobantes-observados"
      label="Comprobantes observados"
      content={`Incluye ${formatMonedaConCentavos(observado)} en comprobantes observados`}
      tonoBoton="ambar"
    >
      i
    </Tooltip>
  )
}

/**
 * El saldo que muestra la ficha: la empresa cuando es corporativo, `Exento` cuando el requerido
 * es cero por beca total y, si no, el saldo con centavos que deriva el backend (D70).
 */
function saldoDe(inscripcion) {
  const saldo = inscripcion.saldo_pendiente
  const sinSaldo =
    inscripcion.categoria === CATEGORIA_INSCRIPCION.CORPORATIVO ||
    saldo === null ||
    saldo === undefined
  if (sinSaldo) {
    return 'A cargo de la empresa'
  }
  if (inscripcion.categoria === CATEGORIA_INSCRIPCION.BECADO_TOTAL) {
    return 'Exento'
  }
  return formatMonedaConCentavos(saldo)
}

function IconoEditar() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-3.5 w-3.5"
    >
      <path d="M13.6 3.4a1.8 1.8 0 0 1 2.6 2.6l-7.7 7.7-3.4.8.8-3.4 7.7-7.7Z" />
    </svg>
  )
}

function BloqueComision({ inscripcion, onCambiarCategoria }) {
  const definicion = TONOS_CATEGORIA[inscripcion.categoria] ?? {
    etiqueta: inscripcion.categoria,
    tono: TONO.GRIS,
  }
  const esCorporativo = inscripcion.categoria === CATEGORIA_INSCRIPCION.CORPORATIVO
  const esBecaTotal = inscripcion.categoria === CATEGORIA_INSCRIPCION.BECADO_TOTAL
  const observado = Number(inscripcion.total_observado ?? 0)

  return (
    <dl className="mt-4">
      <Fila etiqueta="Categoría arancelaria">
        <Badge tono={definicion.tono}>{etiquetaCategoria(inscripcion)}</Badge>
        <button
          type="button"
          aria-label="Editar categoría"
          title="Editar categoría"
          onClick={() => onCambiarCategoria(inscripcion)}
          className="foco-acento rounded p-1 text-slate-500 hover:bg-slate-100"
        >
          <IconoEditar />
        </button>
      </Fila>

      {esCorporativo && inscripcion.empresa != null && (
        <Fila etiqueta="Empresa">{inscripcion.empresa.razon_social}</Fila>
      )}

      <Fila etiqueta="Estado de habilitación">
        {inscripcion.acceso !== null && inscripcion.acceso !== undefined ? (
          <>
            <StatusIndicator
              estado={inscripcion.acceso.estado}
              causa={inscripcion.acceso.causa}
              forzado={inscripcion.acceso.forzado === true}
            />
            {inscripcion.acceso.estado === 'BLOQUEADO' && (
              <Tooltip
                id="ayuda-bloqueado"
                label="Motivo del bloqueo"
                content={
                  (() => {
                    const causa = inscripcion.acceso.causa ?? 'desconocido'
                    let texto = textoCausa(causa)
                    if (inscripcion.acceso.forzado === true) {
                      const razon = inscripcion.acceso.motivo ?? 'no especificado'
                      texto += ` Forzado por Secretaría: ${razon}.`
                    }
                    return texto
                  })()
                }
                tonoBoton="rojo"
              >
                i
              </Tooltip>
            )}
          </>
        ) : (
          <span>{`Estado de la inscripción: ${inscripcion.estado}`}</span>
        )}
      </Fila>

      <Fila etiqueta="Arancel de la comisión">
        {inscripcion.arancel != null ? formatMonedaConCentavos(inscripcion.arancel) : SIN_DATO}
      </Fila>

      <Fila etiqueta="Arancel a abonar">
        {esCorporativo || inscripcion.monto_requerido === null
          ? SIN_DATO
          : formatMonedaConCentavos(inscripcion.monto_requerido)}
      </Fila>

      <Fila etiqueta="Total pagado">
        {formatMonedaConCentavos(inscripcion.total_pagado ?? 0)}
      </Fila>

      <Fila etiqueta="Saldo pendiente">
        <span>{saldoDe(inscripcion)}</span>
        {observado > 0 && !esCorporativo && !esBecaTotal && (
          <IndicadorObservados observado={observado} />
        )}
      </Fila>
    </dl>
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
  const [comisionElegida, setComisionElegida] = useState(null)

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

  // Los datos personales salen de la fila del padrón, que es la que la edición actualiza; el
  // detalle aporta las inscripciones y los importes.
  const datos = datosDeLectura(alumno)
  const inscripciones = detalle?.inscripciones ?? []
  // La comisión elegida se guarda por id y no por índice: al recargar el detalle después de cambiar
  // una categoría la lista puede cambiar de orden y el índice apuntaría a otra inscripción.
  const inscripcionElegida =
    inscripciones.find((inscripcion) => String(inscripcion.id) === comisionElegida) ??
    inscripciones[0] ??
    null

  function elegirAccion(accion) {
    setMenuAbierto(false)
    accion(alumno)
  }

  const accionesMenu = (
    <div className="relative">
      <button
        type="button"
        aria-label="Acciones del alumno"
        aria-haspopup="menu"
        aria-expanded={menuAbierto}
        onClick={() => setMenuAbierto((a) => !a)}
        className="foco-acento rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
      >
        ⋮
      </button>
      {menuAbierto && (
        <div role="menu" className="absolute right-0 z-30 mt-1 min-w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <button type="button" role="menuitem" onClick={() => elegirAccion(onEditar)} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Editar</button>
          <button type="button" role="menuitem" onClick={() => elegirAccion(onRestablecerPassword)} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Restablecer contraseña</button>
          <button type="button" role="menuitem" onClick={() => elegirAccion(onEliminar)} className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50">Eliminar</button>
        </div>
      )}
    </div>
  )

  return (
    <Modal abierto titulo="Ficha del alumno" onClose={onClose} cerrarAlClickAfuera acciones={accionesMenu}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <dl className="flex-1">
            {CAMPOS_DATOS.map((campo) => (
              <Fila key={campo.clave} etiqueta={campo.etiqueta}>
                {datos[campo.clave]}
              </Fila>
            ))}
          </dl>
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
            <Select
              id="comision-ficha"
              etiqueta="Seleccionar comisión"
              valor={inscripcionElegida !== null ? String(inscripcionElegida.id) : ''}
              onChange={setComisionElegida}
              opciones={inscripciones.map((inscripcion) => ({
                valor: String(inscripcion.id),
                etiqueta: `${inscripcion.comision.codigo} ${inscripcion.comision.nombre}`,
              }))}
            />

            {inscripcionElegida !== null && (
              <BloqueComision
                inscripcion={inscripcionElegida}
                onCambiarCategoria={onCambiarCategoria}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
