import { useEffect, useState } from 'react'
import { Badge, Button, Card, Input, Modal, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { buscarDocentes, crearDocente } from '../services/dataService'

/**
 * Padrón de docentes (9.4).
 *
 * **Las columnas son las del dato, no las del modelo.** La fuente de datos ya devuelve el nombre
 * unido y el conte de comisiones, así que la pantalla no sabe de dónde viene la fila.
 *
 * **El alta pide nombre, apellido, DNI, mail y teléfono. No pide CUIL** (D33): en esta fase los
 * docentes no son personas reales, y un CUIL inventado es peor que ninguno. La columna CUIL sigue
 * en la tabla porque la base la tiene, y muestra un guion cuando el docente todavía no la
 * completó.
 *
 * **La columna CÁTEDRA no la puede llenar nadie.** El modelo no tiene ese campo, así que la fuente
 * real devuelve `null` y la pantalla muestra un guion. Se mantiene porque es una columna del
 * prototipo que el cliente pidió, y se deja a la vista que hoy no hay dato en vez de inventarlo.
 *
 * **Un alta fallida no cierra el formulario ni confirma nada.** Deja lo que la secretaría completó
 * y muestra el motivo que devuelve la fuente, que dice si se repitió el DNI o el email (D36).
 *
 * El control de clases dictadas se muestra deshabilitado con `Próximamente` para que el cliente vea
 * el hueco (D20).
 */
const COLUMNAS = [
  {
    clave: 'nombre',
    titulo: 'DOCENTE',
    render: (fila) => <span className="font-medium">{fila.nombre}</span>,
  },
  { clave: 'dni', titulo: 'DNI', render: (fila) => fila.dni },
  { clave: 'cuil', titulo: 'CUIL', render: (fila) => fila.cuil ?? '—' },
  { clave: 'email', titulo: 'EMAIL', render: (fila) => fila.email },
  { clave: 'telefono', titulo: 'TELÉFONO', render: (fila) => fila.telefono ?? '—' },
  { clave: 'catedra', titulo: 'CÁTEDRA O ESPECIALIDAD', render: (fila) => fila.catedra ?? '—' },
  {
    clave: 'comisiones',
    titulo: 'COMISIONES ASIGNADAS',
    render: (fila) => fila.comisiones_asignadas,
  },
  {
    clave: 'estado',
    titulo: 'ESTADO',
    render: (fila) => (
      <Badge tono={fila.activo ? TONO.VERDE : TONO.GRIS}>{fila.activo ? 'Activa' : 'Baja'}</Badge>
    ),
  },
]

const CAMPOS_VACIOS = { nombre: '', apellido: '', dni: '', email: '', telefono: '' }

export function TeachersPage() {
  const [docentes, setDocentes] = useState([])
  const [consulta, setConsulta] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [campos, setCampos] = useState(CAMPOS_VACIOS)
  const [errores, setErrores] = useState({})
  const [aviso, setAviso] = useState(null)
  const [fallo, setFallo] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    buscarDocentes(consulta).then(setDocentes)
  }, [consulta])

  function cambiar(campo) {
    return (evento) => setCampos((anteriores) => ({ ...anteriores, [campo]: evento.target.value }))
  }

  function cerrarModal() {
    setModalAbierto(false)
    setCampos(CAMPOS_VACIOS)
    setErrores({})
    setFallo(null)
  }

  function validar() {
    const encontrados = {}

    if (campos.nombre.trim() === '') {
      encontrados.nombre = 'El nombre es obligatorio.'
    }
    if (campos.apellido.trim() === '') {
      encontrados.apellido = 'El apellido es obligatorio.'
    }
    if (campos.dni.trim() === '') {
      encontrados.dni = 'El DNI es obligatorio.'
    }
    if (campos.email.trim() === '') {
      encontrados.email = 'El mail es obligatorio.'
    }

    return encontrados
  }

  async function guardar() {
    const encontrados = validar()
    setErrores(encontrados)

    if (Object.keys(encontrados).length > 0) {
      return
    }

    setGuardando(true)
    setFallo(null)
    try {
      // Sin `cuil`: el contrato no lo admite (D33).
      const creado = await crearDocente({
        nombre: campos.nombre,
        apellido: campos.apellido,
        dni: campos.dni,
        email: campos.email,
        telefono: campos.telefono === '' ? null : campos.telefono,
      })
      setDocentes((anteriores) => [...anteriores, creado])
      cerrarModal()
      setAviso(`Docente ${creado.nombre} dado de alta.`)
    } catch (error) {
      setFallo(error?.message ?? 'No se pudo guardar el docente.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card
        titulo="Padrón de Docentes"
        acciones={<Button variante="secundario" onClick={() => setModalAbierto(true)}>+ Nuevo Docente</Button>}
      >
        <div className="mb-4 max-w-sm">
          <Input
            id="buscar-docente"
            etiqueta="Buscar docente"
            valor={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
            placeholder="Buscar por nombre, apellido, DNI o email…"
          />
        </div>

        <Table
          columnas={COLUMNAS}
          filas={docentes}
          vacio={<p className="text-sm text-slate-500">No se encontraron resultados.</p>}
        />
      </Card>

      {aviso !== null && (
        <p
          role="status"
          className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
        >
          {aviso}
        </p>
      )}

      <Modal
        abierto={modalAbierto}
        titulo="Nuevo Docente"
        onClose={cerrarModal}
        pie={
          <>
            <Button variante="secundario" onClick={cerrarModal}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar Docente'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="docente-nombre"
            etiqueta="Nombre"
            valor={campos.nombre}
            onChange={cambiar('nombre')}
            obligatorio
            error={errores.nombre ?? null}
          />
          <Input
            id="docente-apellido"
            etiqueta="Apellido"
            valor={campos.apellido}
            onChange={cambiar('apellido')}
            obligatorio
            error={errores.apellido ?? null}
          />
          <Input
            id="docente-dni"
            etiqueta="DNI"
            valor={campos.dni}
            onChange={cambiar('dni')}
            obligatorio
            error={errores.dni ?? null}
          />
          <Input
            id="docente-email"
            etiqueta="Mail"
            type="email"
            valor={campos.email}
            onChange={cambiar('email')}
            obligatorio
            error={errores.email ?? null}
          />
          <Input
            id="docente-telefono"
            etiqueta="Teléfono"
            valor={campos.telefono}
            onChange={cambiar('telefono')}
          />
        </div>

        {fallo !== null && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {fallo}
          </p>
        )}

        <p className="mt-4 text-xs text-slate-500">
          El docente se crea con una cuenta de acceso para ese mail.
        </p>
      </Modal>

      <Card titulo="Control de Clases Dictadas">
        {/* Fuera del alcance mínimo: se muestra el hueco y no una pantalla vacía detrás (D20). */}
        <div className="flex items-center gap-2">
          <Button variante="secundario" disabled>
            Control de clases dictadas
          </Button>
          <Badge tono={TONO.GRIS}>Próximamente</Badge>
        </div>
      </Card>
    </div>
  )
}
