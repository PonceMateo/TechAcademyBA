import { useEffect, useState } from 'react'
import { Button, Campo, Modal } from '../components/ui'
import { ESTADO_COMISION } from '../domain/enums'
import {
  crearEmpresa,
  crearInscripcion,
  listarAlumnos,
  listarEmpresas,
} from '../services/dataService'

/**
 * Formulario de inscripción de un alumno (HU 14, 15, 60 y 64).
 *
 * **Es el mismo formulario en las dos pantallas.** La pantalla de Comisiones lo abre para elegir
 * alumno, comisión y categoría; la gestión de una comisión lo abre con `comisionId` para que la
 * comisión venga elegida y bloqueada. No hay una segunda versión de las reglas de beca y empresa:
 * las dos puertas usan este componente.
 *
 * **El campo bloqueado es una restricción de interfaz.** La autoridad es el backend, que recibe el
 * `comision_id` explícito y valida que exista, el cupo y el duplicado.
 *
 * **Un alta fallida no cierra el formulario ni confirma nada.** Deja lo que el operador completó y
 * muestra el motivo que devuelve la fuente (D36).
 */
export function InscripcionModal({
  abierto,
  comisionId = null,
  etiquetaComision = null,
  comisiones = [],
  onClose,
  onInscripto,
}) {
  const [alumnos, setAlumnos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState('')
  const [comisionSeleccionada, setComisionSeleccionada] = useState(
    comisionId === null ? '' : String(comisionId),
  )
  const [categoria, setCategoria] = useState('PARTICULAR')
  const [porcentaje, setPorcentaje] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [fallo, setFallo] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [modalEmpresa, setModalEmpresa] = useState(false)
  const [camposEmpresa, setCamposEmpresa] = useState({
    razon_social: '',
    cuit: '',
    requiere_factura_a: false,
  })
  const [erroresEmpresa, setErroresEmpresa] = useState({})
  const [falloEmpresa, setFalloEmpresa] = useState(null)
  const [guardandoEmpresa, setGuardandoEmpresa] = useState(false)

  // H/U 70: una comisión finalizada no admite altas, así que el selector no la ofrece. La comisión
  // abierta desde la gestión de una comisión no pasa por acá: viene fija y la valida la fuente.
  const comisionesVigentes = comisiones.filter(
    (candidata) => candidata.estado !== ESTADO_COMISION.FINALIZADA,
  )

  // El formulario se monta al abrirse, así que cada apertura arranca limpia sin un efecto de reset.
  useEffect(() => {
    listarAlumnos().then(setAlumnos)
    listarEmpresas()
      .then(setEmpresas)
      .catch(() => setEmpresas([]))
  }, [])

  function abrirEmpresa() {
    setCamposEmpresa({ razon_social: '', cuit: '', requiere_factura_a: false })
    setErroresEmpresa({})
    setFalloEmpresa(null)
    setModalEmpresa(true)
  }

  /** Alta de la empresa sin cerrar el formulario: al volver queda seleccionada (HU 64). */
  async function guardarEmpresa() {
    const encontrados = {}
    if (camposEmpresa.razon_social.trim() === '') {
      encontrados.razon_social = 'La razón social es obligatoria.'
    }
    if (camposEmpresa.cuit.trim() === '') {
      encontrados.cuit = 'El CUIT es obligatorio.'
    }
    setErroresEmpresa(encontrados)
    if (Object.keys(encontrados).length > 0) {
      return
    }

    setGuardandoEmpresa(true)
    setFalloEmpresa(null)
    try {
      const creada = await crearEmpresa({
        razon_social: camposEmpresa.razon_social,
        cuit: camposEmpresa.cuit,
        requiere_factura_a: camposEmpresa.requiere_factura_a,
      })
      setEmpresas((anteriores) => [...anteriores, creada])
      setEmpresa(String(creada.id))
      setModalEmpresa(false)
    } catch (error) {
      setFalloEmpresa(error?.message ?? 'No se pudo guardar la empresa.')
    } finally {
      setGuardandoEmpresa(false)
    }
  }

  async function guardar() {
    const comision = comisionId === null ? comisionSeleccionada : String(comisionId)
    if (alumnoSeleccionado === '' || comision === '') {
      setFallo('Elegí el alumno y la comisión.')
      return
    }
    // La validación local repite la regla del backend para que el formulario no mande una
    // inscripción que va a volver con un 422 sin decir qué campo corregir (HU 64).
    if (categoria === 'BECADO_PARCIAL') {
      const valor = Number(porcentaje)
      if (porcentaje === '' || !Number.isInteger(valor) || valor < 1 || valor > 99) {
        setFallo('El porcentaje de la beca debe ser un entero entre 1 y 99.')
        return
      }
    }
    if (categoria === 'CORPORATIVO' && empresa === '') {
      setFallo('Seleccioná la empresa de la inscripción corporativa.')
      return
    }

    setGuardando(true)
    setFallo(null)
    try {
      const inscripcion = await crearInscripcion({
        alumno_id: Number(alumnoSeleccionado),
        comision_id: Number(comision),
        categoria,
        porcentaje_beca: categoria === 'BECADO_PARCIAL' ? Number(porcentaje) : null,
        empresa_id: categoria === 'CORPORATIVO' ? Number(empresa) : null,
      })
      onInscripto(inscripcion)
    } catch (error) {
      setFallo(error?.message ?? 'No se pudo inscribir al alumno.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <Modal
        abierto={abierto}
        titulo="Inscribir Alumno"
        onClose={onClose}
        pie={
          <>
            <Button variante="secundario" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Inscribir'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Campo id="comision-inscripcion" etiqueta="Comisión" obligatorio>
            {comisionId === null ? (
              <select
                id="comision-inscripcion"
                value={comisionSeleccionada}
                onChange={(evento) => setComisionSeleccionada(evento.target.value)}
              >
                <option value="">Seleccionar…</option>
                {comisionesVigentes.map((candidata) => (
                  <option key={candidata.id} value={String(candidata.id)}>
                    {candidata.codigo} · {candidata.curso.nombre}
                  </option>
                ))}
              </select>
            ) : (
              // La comisión de la pantalla no se puede cambiar: el flujo entero es de esa comisión.
              <select id="comision-inscripcion" value={String(comisionId)} disabled>
                <option value={String(comisionId)}>{etiquetaComision}</option>
              </select>
            )}
          </Campo>

          <Campo id="alumno-inscripcion" etiqueta="Alumno" obligatorio>
            <select
              id="alumno-inscripcion"
              value={alumnoSeleccionado}
              onChange={(evento) => setAlumnoSeleccionado(evento.target.value)}
            >
              <option value="">Seleccionar…</option>
              {alumnos.map((alumno) => (
                <option key={alumno.id} value={String(alumno.id)}>
                  {alumno.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo id="categoria-inscripcion" etiqueta="Categoría" obligatorio>
            <select
              id="categoria-inscripcion"
              value={categoria}
              onChange={(evento) => setCategoria(evento.target.value)}
            >
              <option value="PARTICULAR">Particular</option>
              <option value="BECADO_PARCIAL">Becado parcial</option>
              <option value="BECADO_TOTAL">Becado total</option>
              <option value="CORPORATIVO">Corporativo</option>
            </select>
          </Campo>

          {categoria === 'BECADO_PARCIAL' && (
            <Campo id="porcentaje-inscripcion" etiqueta="Descuento (%)" obligatorio>
              <input
                id="porcentaje-inscripcion"
                type="number"
                min="1"
                max="99"
                value={porcentaje}
                onChange={(evento) => setPorcentaje(evento.target.value)}
              />
            </Campo>
          )}

          {categoria === 'CORPORATIVO' && (
            <Campo id="empresa-inscripcion" etiqueta="Empresa" obligatorio>
              <div className="grid gap-2">
                <select
                  id="empresa-inscripcion"
                  value={empresa}
                  onChange={(evento) => setEmpresa(evento.target.value)}
                >
                  <option value="">Seleccionar…</option>
                  {empresas.map((candidata) => (
                    <option key={candidata.id} value={String(candidata.id)}>
                      {candidata.razon_social}
                    </option>
                  ))}
                </select>
                <Button variante="secundario" tamano="chico" onClick={abrirEmpresa}>
                  + Nueva Empresa
                </Button>
              </div>
            </Campo>
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

      <Modal
        abierto={modalEmpresa}
        titulo="Nueva Empresa"
        onClose={() => setModalEmpresa(false)}
        pie={
          <>
            <Button variante="secundario" onClick={() => setModalEmpresa(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarEmpresa} disabled={guardandoEmpresa}>
              {guardandoEmpresa ? 'Guardando…' : 'Guardar Empresa'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Campo
            id="empresa-inscripcion-razon"
            etiqueta="Razón Social"
            obligatorio
            error={erroresEmpresa.razon_social ?? null}
          >
            <input
              id="empresa-inscripcion-razon"
              value={camposEmpresa.razon_social}
              onChange={(evento) =>
                setCamposEmpresa((anteriores) => ({
                  ...anteriores,
                  razon_social: evento.target.value,
                }))
              }
            />
          </Campo>
          <Campo
            id="empresa-inscripcion-cuit"
            etiqueta="CUIT"
            obligatorio
            error={erroresEmpresa.cuit ?? null}
          >
            <input
              id="empresa-inscripcion-cuit"
              value={camposEmpresa.cuit}
              onChange={(evento) =>
                setCamposEmpresa((anteriores) => ({ ...anteriores, cuit: evento.target.value }))
              }
            />
          </Campo>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={camposEmpresa.requiere_factura_a}
              onChange={(evento) =>
                setCamposEmpresa((anteriores) => ({
                  ...anteriores,
                  requiere_factura_a: evento.target.checked,
                }))
              }
            />
            Requiere Factura A
          </label>
          {falloEmpresa !== null && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {falloEmpresa}
            </p>
          )}
        </div>
      </Modal>
    </>
  )
}
