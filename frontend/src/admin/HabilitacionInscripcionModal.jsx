import { useState } from 'react'
import { Badge, Button, Input, Modal } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { ESTADO_HABILITACION } from '../domain/enums'
import {
  forzarHabilitacionInscripcion,
  quitarForzadoHabilitacion,
} from '../services/dataService'

/**
 * Habilitación manual de una inscripción (H/U 30).
 *
 * **El forzado es de la inscripción, no del alumno.** El modal recibe la inscripción elegida en la
 * ficha, muestra los dos estados —el que calcula la regla y el efectivo— y solo deja forzar el
 * contrario al automático. Con un forzado vigente, la única acción es volver a la regla.
 *
 * **El motivo es obligatorio y la confirmación es un paso aparte.** El primer botón valida el
 * motivo y pide confirmación; recién el segundo guarda. Mientras guarda, los botones quedan
 * deshabilitados para que un doble click no mande dos pedidos.
 *
 * **El administrador no viaja desde acá.** El backend lo toma de la sesión; el modal solo manda
 * estado y motivo.
 */
export function HabilitacionInscripcionModal({ alumno, inscripcion, onClose, onGuardado }) {
  const [motivo, setMotivo] = useState('')
  const [errorMotivo, setErrorMotivo] = useState(null)
  const [fallo, setFallo] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const acceso = inscripcion.acceso
  const forzado = acceso?.forzado === true
  const automatico = acceso?.estado_automatico ?? acceso?.estado ?? ESTADO_HABILITACION.BLOQUEADO
  const contrario =
    automatico === ESTADO_HABILITACION.HABILITADO
      ? ESTADO_HABILITACION.BLOQUEADO
      : ESTADO_HABILITACION.HABILITADO
  const comision = `${inscripcion.comision.codigo} ${inscripcion.comision.nombre}`

  function pedirConfirmacion() {
    if (motivo.trim() === '') {
      setErrorMotivo('El motivo es obligatorio.')
      return
    }
    setErrorMotivo(null)
    setFallo(null)
    setConfirmando(true)
  }

  async function forzar() {
    if (guardando) {
      return
    }
    setGuardando(true)
    setFallo(null)
    try {
      await forzarHabilitacionInscripcion(inscripcion.id, { estado: contrario, motivo })
      onGuardado('forzado')
    } catch (error) {
      const mensaje = error?.message ?? 'No se pudo forzar la habilitación.'
      if (mensaje.toLowerCase().includes('motivo')) {
        setErrorMotivo(mensaje)
      } else {
        setFallo(mensaje)
      }
      setConfirmando(false)
    } finally {
      setGuardando(false)
    }
  }

  async function quitarForzado() {
    if (guardando) {
      return
    }
    setGuardando(true)
    setFallo(null)
    try {
      await quitarForzadoHabilitacion(inscripcion.id)
      onGuardado('quitado')
    } catch (error) {
      setFallo(error?.message ?? 'No se pudo quitar el forzado.')
    } finally {
      setGuardando(false)
    }
  }

  const tonoAutomatico =
    automatico === ESTADO_HABILITACION.HABILITADO ? TONO.VERDE : TONO.ROJO
  const tonoEfectivo =
    acceso?.estado === ESTADO_HABILITACION.HABILITADO ? TONO.VERDE : TONO.ROJO

  return (
    <Modal
      abierto
      titulo="Estado de habilitación"
      onClose={onClose}
      pie={
        forzado ? (
          <>
            <Button variante="secundario" onClick={onClose} disabled={guardando}>
              Cerrar
            </Button>
            <Button onClick={quitarForzado} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Volver a estado automático'}
            </Button>
          </>
        ) : (
          <>
            <Button variante="secundario" onClick={onClose} disabled={guardando}>
              Cancelar
            </Button>
            {confirmando ? (
              <Button
                variante={contrario === ESTADO_HABILITACION.BLOQUEADO ? 'peligro' : 'primario'}
                onClick={forzar}
                disabled={guardando}
              >
                {guardando ? 'Guardando…' : 'Confirmar forzado'}
              </Button>
            ) : (
              <Button onClick={pedirConfirmacion} disabled={guardando}>
                {`Forzar ${contrario}`}
              </Button>
            )}
          </>
        )
      }
    >
      <div className="grid gap-4">
        <dl className="grid gap-3">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2">
            <dt className="text-sm text-slate-500">Alumno</dt>
            <dd className="text-right text-sm font-medium text-slate-900">{alumno.nombre}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2">
            <dt className="text-sm text-slate-500">Comisión</dt>
            <dd className="text-right text-sm font-medium text-slate-900">{comision}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2">
            <dt className="text-sm text-slate-500">Estado calculado automáticamente</dt>
            <dd className="text-right">
              <Badge tono={tonoAutomatico}>{automatico}</Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-sm text-slate-500">Estado efectivo actual</dt>
            <dd className="text-right">
              <Badge tono={tonoEfectivo}>{acceso?.estado ?? automatico}</Badge>
            </dd>
          </div>
        </dl>

        {forzado ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">El estado fue modificado manualmente.</p>
            <p className="mt-1">{`Motivo vigente: ${acceso.motivo ?? acceso.causa ?? 'no especificado'}.`}</p>
            <p className="mt-1">
              Al volver al estado automático, la habilitación se calcula otra vez con la categoría,
              la beca y las cobranzas de la inscripción.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {`El forzado solo puede ser el estado contrario al automático: ${contrario}.`}
            </div>

            <Input
              id="motivo-habilitacion"
              etiqueta="Motivo"
              valor={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              obligatorio
              error={errorMotivo}
            />

            {confirmando && (
              <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {`¿Confirmás forzar el estado ${contrario} de esta inscripción?`}
              </p>
            )}
          </>
        )}

        {fallo !== null && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {fallo}
          </p>
        )}
      </div>
    </Modal>
  )
}
