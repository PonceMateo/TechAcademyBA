import { useEffect, useState } from 'react'
import { Badge, Button, Campo, Card, Modal, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import {
  ESTADO_COMPROBANTE_ALUMNO,
  ESTADO_COMPROBANTE_LABELS,
  MEDIO_PAGO_LABELS,
  TIPO_FACTURA,
  TITULAR_SIN_IDENTIFICAR,
} from '../domain/enums'
import {
  aceptarComprobante,
  descargarArchivoComprobante,
  listarComprobantes,
  observarComprobante,
  obtenerComprobante,
  rechazarComprobante,
} from '../services/dataService'
import { formatFechaCorta, formatMoneda } from '../utils/formato'

/**
 * Panel de revisión de comprobantes de alumnos (HU 52 y HU 54).
 *
 * **El circuito completo vive acá, dentro de Cobranzas e Ingresos.** Secretaría lista los envíos,
 * abre el comprobante con su adjunto integrado y resuelve: aceptar crea la cobranza acreditada
 * reutilizando el alta existente, observar deja al alumno reenviarlo y rechazar es definitivo.
 *
 * **El orden y los permisos no los decide la pantalla.** El backend devuelve los pendientes
 * primero y del más viejo al más nuevo por fecha de recepción, y vuelve a validar el rol y el
 * estado en cada acción: deshabilitar un botón no es un control de acceso.
 *
 * **El adjunto se pide con la sesión de Secretaría y se muestra integrado.** En producción el
 * backend redirige a una URL firmada de vida corta; el navegador solo ve un `Blob` y nunca una URL
 * privada permanente.
 */

const ESTADOS = {
  [ESTADO_COMPROBANTE_ALUMNO.PENDIENTE_REVISION]: { tono: TONO.AMBAR },
  [ESTADO_COMPROBANTE_ALUMNO.ACEPTADO]: { tono: TONO.VERDE },
  [ESTADO_COMPROBANTE_ALUMNO.OBSERVADO]: { tono: TONO.CELESTE },
  [ESTADO_COMPROBANTE_ALUMNO.RECHAZADO]: { tono: TONO.ROJO },
}

const ETIQUETA_CONFIRMACION = {
  ACEPTAR: 'Confirmar aceptación',
  OBSERVAR: 'Confirmar observación',
  RECHAZAR: 'Confirmar rechazo',
}

/** Fecha y hora de recepción: la del envío, que es la que ordena la bandeja. */
function fechaHoraDeEnvio(valor) {
  if (!valor) {
    return ''
  }
  const fecha = formatFechaCorta(String(valor).slice(0, 10))
  const hora = String(valor).slice(11, 16)
  return hora === '' ? fecha : `${fecha} ${hora}`
}

function EstadoBadge({ estado }) {
  return (
    <Badge tono={ESTADOS[estado]?.tono ?? TONO.GRIS}>
      {ESTADO_COMPROBANTE_LABELS[estado] ?? estado}
    </Badge>
  )
}

const COLUMNAS = [
  {
    clave: 'alumno',
    titulo: 'ALUMNO',
    render: (fila) => <span className="font-medium">{fila.alumno}</span>,
  },
  {
    clave: 'comision',
    titulo: 'COMISIÓN',
    render: (fila) => (
      <span className="inline-flex flex-col">
        <span>{fila.inscripcion.nombre_curso}</span>
        <span className="text-xs text-slate-500">{fila.inscripcion.codigo}</span>
      </span>
    ),
  },
  {
    clave: 'titular',
    titulo: 'TITULAR',
    // Nulo es "no identificado" (D67): no se completa con el alumno ni se inventa un nombre.
    render: (fila) => fila.titular ?? <span className="text-slate-400">{TITULAR_SIN_IDENTIFICAR}</span>,
  },
  { clave: 'importe', titulo: 'IMPORTE', render: (fila) => formatMoneda(fila.importe) },
  {
    clave: 'fecha_pago',
    titulo: 'FECHA DEL PAGO',
    render: (fila) => formatFechaCorta(fila.fecha_pago),
  },
  {
    clave: 'medio',
    titulo: 'MEDIO',
    render: (fila) => MEDIO_PAGO_LABELS[fila.medio] ?? fila.medio,
  },
  {
    clave: 'estado',
    titulo: 'ESTADO',
    render: (fila) => (
      <span className="inline-flex flex-col items-start gap-1">
        <EstadoBadge estado={fila.estado} />
        {fila.motivo !== null && fila.motivo !== undefined && (
          <span className="text-xs text-slate-600">{fila.motivo}</span>
        )}
      </span>
    ),
  },
]

/** Un dato de solo lectura del detalle: rótulo arriba, valor abajo. */
function Dato({ etiqueta, valor }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{etiqueta}</dt>
      <dd className="text-slate-900">{valor}</dd>
    </div>
  )
}

/** El adjunto ya descargado, integrado en el modal y sin pestañas externas. */
function VisorAdjunto({ archivo, mime, nombre, error }) {
  if (error !== null) {
    return (
      <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    )
  }
  if (archivo === null) {
    return <p className="text-sm text-slate-600">Cargando el adjunto…</p>
  }
  if (mime === 'application/pdf') {
    return (
      <iframe
        src={archivo}
        title={`Comprobante ${nombre ?? ''}`.trim()}
        className="h-[60vh] w-full rounded-lg border border-slate-200"
      />
    )
  }
  return (
    <img
      src={archivo}
      alt={`Comprobante ${nombre ?? ''}`.trim()}
      className="mx-auto max-h-[60vh] w-auto rounded-lg border border-slate-200"
    />
  )
}

export function ComprobantesAlumnoCard() {
  const [filas, setFilas] = useState([])
  const [cargadas, setCargadas] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [seleccion, setSeleccion] = useState(null)
  const [adjunto, setAdjunto] = useState(null)
  const [errorAdjunto, setErrorAdjunto] = useState(null)
  //: Acción elegida en el modal: `null`, `ACEPTAR`, `OBSERVAR` o `RECHAZAR`.
  const [accion, setAccion] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [errorAccion, setErrorAccion] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function cargar(estado = filtro) {
    try {
      const resultado = await listarComprobantes(estado === '' ? {} : { estado })
      setFilas(resultado)
      setError(null)
    } catch (fallo) {
      setError(fallo?.message ?? 'No pudimos consultar los comprobantes.')
    } finally {
      setCargadas(true)
    }
  }

  useEffect(() => {
    // El filtro lo resuelve el backend: la pantalla no reordena ni recorta la lista.
    let vigente = true
    listarComprobantes(filtro === '' ? {} : { estado: filtro })
      .then((resultado) => {
        if (vigente) {
          setFilas(resultado)
          setError(null)
        }
      })
      .catch((fallo) => {
        if (vigente) {
          setError(fallo?.message ?? 'No pudimos consultar los comprobantes.')
        }
      })
      .finally(() => {
        if (vigente) {
          setCargadas(true)
        }
      })
    return () => {
      vigente = false
    }
  }, [filtro])

  // El objeto del `Blob` se libera al cambiar de comprobante o al cerrar el modal.
  useEffect(() => {
    if (adjunto === null) {
      return undefined
    }
    const { url } = adjunto
    return () => URL.revokeObjectURL(url)
  }, [adjunto])

  async function abrir(fila) {
    setSeleccion(fila)
    setAccion(null)
    setMotivo('')
    setErrorAccion(null)
    setAviso(null)
    setAdjunto(null)
    setErrorAdjunto(null)

    try {
      const blob = await descargarArchivoComprobante(fila.id)
      setAdjunto({
        url: URL.createObjectURL(blob),
        mime: blob.type || fila.archivo_mime,
      })
    } catch (fallo) {
      setErrorAdjunto(fallo?.message ?? 'No pudimos abrir el comprobante.')
    }

    try {
      // El detalle se relee al abrir: si otro administrador ya lo resolvió, se ve acá.
      const detalle = await obtenerComprobante(fila.id)
      setSeleccion((actual) => (actual?.id === fila.id ? detalle : actual))
    } catch {
      // La fila del listado ya trae los datos del pago: sin detalle el modal sigue siendo útil.
    }
  }

  function cerrar() {
    if (guardando) {
      return
    }
    setSeleccion(null)
    setAccion(null)
    setMotivo('')
    setErrorAccion(null)
  }

  function resolver() {
    if (guardando) {
      return
    }
    if (accion !== 'ACEPTAR' && motivo.trim() === '') {
      setErrorAccion('Indicá el motivo de la resolución.')
      return
    }

    setGuardando(true)
    setErrorAccion(null)
    const peticion =
      accion === 'ACEPTAR'
        ? aceptarComprobante(seleccion.id)
        : accion === 'OBSERVAR'
          ? observarComprobante(seleccion.id, motivo.trim())
          : rechazarComprobante(seleccion.id, motivo.trim())

    peticion
      .then((actualizado) => {
        setFilas((anteriores) =>
          // Con un filtro activo, la fila resuelta deja de pertenecer a la lista.
          filtro !== '' && actualizado.estado !== filtro
            ? anteriores.filter((fila) => fila.id !== actualizado.id)
            : anteriores.map((fila) => (fila.id === actualizado.id ? actualizado : fila)),
        )
        const etiqueta =
          actualizado.estado === ESTADO_COMPROBANTE_ALUMNO.ACEPTADO
            ? 'acreditado'
            : actualizado.estado === ESTADO_COMPROBANTE_ALUMNO.OBSERVADO
              ? 'observado'
              : 'rechazado'
        setAviso(`El comprobante de ${actualizado.alumno} quedó ${etiqueta}.`)
        setSeleccion(null)
        setAccion(null)
        setMotivo('')
      })
      .catch((fallo) => {
        setErrorAccion(fallo?.message ?? 'No pudimos resolver el comprobante.')
        if (fallo?.status === 409) {
          // Otro administrador llegó primero: se relee el estado y se recarga la lista.
          setAccion(null)
          obtenerComprobante(seleccion.id).then(setSeleccion).catch(() => {})
          cargar()
        }
      })
      .finally(() => setGuardando(false))
  }

  const pendiente = seleccion?.estado === ESTADO_COMPROBANTE_ALUMNO.PENDIENTE_REVISION

  const pie = seleccion === null ? null : pendiente ? (
    accion === null ? (
      <>
        <Button variante="secundario" onClick={cerrar}>
          Cerrar
        </Button>
        <Button variante="secundario" onClick={() => setAccion('OBSERVAR')}>
          Observar
        </Button>
        <Button variante="secundario" onClick={() => setAccion('RECHAZAR')}>
          Rechazar
        </Button>
        <Button onClick={() => setAccion('ACEPTAR')}>Aceptar</Button>
      </>
    ) : (
      <>
        <Button
          variante="secundario"
          onClick={() => {
            setAccion(null)
            setErrorAccion(null)
          }}
          disabled={guardando}
        >
          Volver
        </Button>
        <Button onClick={resolver} disabled={guardando}>
          {guardando ? 'Guardando…' : ETIQUETA_CONFIRMACION[accion]}
        </Button>
      </>
    )
  ) : (
    <Button variante="secundario" onClick={cerrar}>
      Cerrar
    </Button>
  )

  return (
    <Card titulo="Comprobantes de alumnos">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="max-w-xs">
          <Campo id="filtro-comprobantes" etiqueta="Filtrar por estado">
            <select
              id="filtro-comprobantes"
              value={filtro}
              onChange={(evento) => setFiltro(evento.target.value)}
            >
              <option value="">Todos (pendientes primero)</option>
              {Object.values(ESTADO_COMPROBANTE_ALUMNO).map((estado) => (
                <option key={estado} value={estado}>
                  {ESTADO_COMPROBANTE_LABELS[estado]}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </div>

      {error !== null && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {aviso !== null && (
        <p role="status" className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {aviso}
        </p>
      )}

      {cargadas && (
        <Table
          columnas={[
            ...COLUMNAS,
            {
              clave: 'acciones',
              titulo: 'ADJUNTO',
              render: (fila) => (
                <Button variante="secundario" tamano="chico" onClick={() => abrir(fila)}>
                  Ver comprobante
                </Button>
              ),
            },
          ]}
          filas={filas}
          claveDeFila={(fila) => fila.id}
          vacio={<p className="text-sm text-slate-600">No hay comprobantes para este filtro.</p>}
        />
      )}

      <Modal
        abierto={seleccion !== null}
        titulo="Comprobante de alumno"
        onClose={cerrar}
        pie={pie}
      >
        {seleccion !== null && (
          <div className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Dato etiqueta="Alumno" valor={seleccion.alumno} />
              <Dato
                etiqueta="Inscripción"
                valor={`${seleccion.inscripcion.nombre_curso} · ${seleccion.inscripcion.codigo}`}
              />
              <Dato etiqueta="Fecha del pago" valor={formatFechaCorta(seleccion.fecha_pago)} />
              <Dato etiqueta="Importe" valor={formatMoneda(seleccion.importe)} />
              <Dato
                etiqueta="Medio de pago"
                valor={MEDIO_PAGO_LABELS[seleccion.medio] ?? seleccion.medio}
              />
              <Dato etiqueta="Titular" valor={seleccion.titular ?? TITULAR_SIN_IDENTIFICAR} />
              {seleccion.factura_a_solicitada && (
                <>
                  <Dato etiqueta="Factura" valor={TIPO_FACTURA.A} />
                  <Dato etiqueta="CUIT" valor={seleccion.cuit ?? '—'} />
                </>
              )}
              <Dato etiqueta="Recepción" valor={fechaHoraDeEnvio(seleccion.enviado_at)} />
              <Dato
                etiqueta="Estado actual"
                valor={<EstadoBadge estado={seleccion.estado} />}
              />
              {seleccion.revisado_at !== null && seleccion.revisado_at !== undefined && (
                <Dato
                  etiqueta="Resuelto"
                  valor={`${fechaHoraDeEnvio(seleccion.revisado_at)}${
                    seleccion.revisado_por_nombre ? ` · ${seleccion.revisado_por_nombre}` : ''
                  }`}
                />
              )}
              {seleccion.cobranza_id !== null && seleccion.cobranza_id !== undefined && (
                <Dato etiqueta="Cobranza" valor={`#${seleccion.cobranza_id}`} />
              )}
            </dl>

            {seleccion.motivo !== null && seleccion.motivo !== undefined && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <span className="font-medium">Motivo:</span> {seleccion.motivo}
              </div>
            )}

            {accion !== null && (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {accion === 'ACEPTAR' ? (
                  <p>
                    Vas a acreditar el pago: se crea la cobranza a cargo de{' '}
                    <strong>{seleccion.titular ?? TITULAR_SIN_IDENTIFICAR}</strong> imputada a la
                    inscripción y la habilitación se recalcula con las reglas existentes.
                  </p>
                ) : (
                  <Campo
                    id="motivo-resolucion"
                    etiqueta={accion === 'OBSERVAR' ? 'Motivo de la observación' : 'Motivo del rechazo'}
                    obligatorio
                    error={errorAccion}
                  >
                    <textarea
                      id="motivo-resolucion"
                      rows={3}
                      value={motivo}
                      onChange={(evento) => setMotivo(evento.target.value)}
                      disabled={guardando}
                      className="foco-acento w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </Campo>
                )}
                {accion !== 'ACEPTAR' && (
                  <p className="mt-2 text-xs text-slate-600">
                    {accion === 'OBSERVAR'
                      ? 'El alumno va a ver el motivo y va a poder reenviar el comprobante.'
                      : 'El rechazo es definitivo para este comprobante y el alumno va a ver el motivo.'}
                  </p>
                )}
              </div>
            )}

            {accion !== 'OBSERVAR' && accion !== 'RECHAZAR' && errorAccion !== null && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorAccion}
              </p>
            )}

            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
                Adjunto
              </p>
              <VisorAdjunto
                archivo={adjunto?.url ?? null}
                mime={adjunto?.mime ?? seleccion.archivo_mime}
                nombre={seleccion.archivo_nombre}
                error={errorAdjunto}
              />
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}
