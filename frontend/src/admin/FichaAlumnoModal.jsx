import { useEffect, useState } from 'react'
import { Button, Modal } from '../components/ui'
import { formatDocumento, formatTelefono } from '../utils/formato'
import { obtenerAlumno } from '../services/dataService'

/**
 * Ficha del alumno en modal (HU 61).
 *
 * **Se monta al abrir y se desmonta al cerrar.** El padrón ya no trae datos de inscripción (HU 64),
 * así que la categoría, el estado de acceso y los importes se consultan en `GET /alumnos/{id}` en
 * el momento de abrir: no hay ruta nueva, el saldo no queda viejo después de cobrar y el estado de
 * la ficha no sobrevive a un alumno para mostrarse sobre otro.
 *
 * **Los datos personales van en modo lectura.** Editar, restablecer la contraseña y eliminar viven
 * en el menú `⋮` y reutilizan los modales que ya existen; la ficha solo los abre.
 *
 * **Un detalle que no llega no se inventa.** Mientras la consulta corre la ficha lo dice, y si
 * falla muestra el motivo: sin inscripciones, estados ni importes de relleno.
 */

/** Lo que el cliente escribe en la planilla cuando el alumno no tiene documento (D30). */
const SIN_DOCUMENTO = 'Sin DNI (alumno exterior)'

const SIN_DATO = '—'

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

export function FichaAlumnoModal({
  alumno,
  onClose,
  onEditar,
  onRestablecerPassword,
  onEliminar,
}) {
  const [detalle, setDetalle] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState(null)
  const [menuAbierto, setMenuAbierto] = useState(false)

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
  }, [alumno])

  const datos = datosDeLectura(detalle ?? alumno)

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
      </div>
    </Modal>
  )
}
