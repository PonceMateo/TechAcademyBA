import { useEffect, useRef, useState } from 'react'
import { Badge, Button, Card, Input, Modal, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import {
  buscarDocentes,
  crearDocente,
  editarDocente,
  restablecerPasswordDocente,
} from '../services/dataService'

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
 * **La edición conserva las comisiones.** La respuesta trae la fila actualizada y la pantalla la
 * fusiona con la que mostraba, porque el conte de comisiones ya estaba calculado y la edición no
 * lo vuelve a resolver: sin la fusión, la columna `COMISIONES ASIGNADAS` se vaciaría al corregir un
 * teléfono (D52). El CUIL tampoco se edita: sigue fuera del contrato, igual que en el alta (D33).
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
    render: (fila) => {
      const comisiones = fila.comisiones ?? []
      if (comisiones.length === 0) {
        return <span className="text-slate-500">Sin comisión</span>
      }
      return (
        <span className="block space-y-1">
          {comisiones.map((comision) => (
            <span key={comision.id} className="block">
              {comision.codigo} · {comision.nombre}
            </span>
          ))}
        </span>
      )
    },
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

const LARGO_MINIMO_PASSWORD = 8

export function TeachersPage() {
  const [docentes, setDocentes] = useState([])
  const [consulta, setConsulta] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [campos, setCampos] = useState(CAMPOS_VACIOS)
  const [errores, setErrores] = useState({})
  const [aviso, setAviso] = useState(null)
  const [fallo, setFallo] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [docenteEditando, setDocenteEditando] = useState(null)
  const [camposEdicion, setCamposEdicion] = useState(CAMPOS_VACIOS)
  const [erroresEdicion, setErroresEdicion] = useState({})
  const [falloEdicion, setFalloEdicion] = useState(null)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [docentePassword, setDocentePassword] = useState(null)
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [erroresPassword, setErroresPassword] = useState({})
  const [falloPassword, setFalloPassword] = useState(null)
  const [guardandoPassword, setGuardandoPassword] = useState(false)
  const ultimaConsulta = useRef(0)

  useEffect(() => {
    // Un contador identifica cada consulta y la limpieza apaga la anterior: una respuesta vieja
    // no puede pisar el resultado más reciente, aunque el temporizador ya se haya disparado.
    const consultaActual = ultimaConsulta.current + 1
    ultimaConsulta.current = consultaActual
    let vigente = true
    const demora = consulta.trim() === '' ? 0 : 300
    const temporizador = setTimeout(() => {
      buscarDocentes(consulta).then((resultado) => {
        if (vigente && consultaActual === ultimaConsulta.current) {
          setDocentes(resultado)
        }
      })
    }, demora)

    return () => {
      vigente = false
      clearTimeout(temporizador)
    }
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

  function validar(datos) {
    const encontrados = {}

    if (datos.nombre.trim() === '') {
      encontrados.nombre = 'El nombre es obligatorio.'
    }
    if (datos.apellido.trim() === '') {
      encontrados.apellido = 'El apellido es obligatorio.'
    }
    if (datos.dni.trim() === '') {
      encontrados.dni = 'El DNI es obligatorio.'
    }
    if (datos.email.trim() === '') {
      encontrados.email = 'El mail es obligatorio.'
    }

    return encontrados
  }

  async function guardar() {
    const encontrados = validar(campos)
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

  function abrirEdicion(docente) {
    setDocenteEditando(docente)
    setCamposEdicion({
      nombre: docente.nombres ?? docente.nombre,
      apellido: docente.apellido ?? '',
      dni: docente.dni,
      email: docente.email,
      telefono: docente.telefono ?? '',
    })
    setErroresEdicion({})
    setFalloEdicion(null)
  }

  function cerrarEdicion() {
    setDocenteEditando(null)
    setCamposEdicion(CAMPOS_VACIOS)
    setErroresEdicion({})
    setFalloEdicion(null)
  }

  function cambiarEdicion(campo) {
    return (evento) =>
      setCamposEdicion((anteriores) => ({ ...anteriores, [campo]: evento.target.value }))
  }

  async function guardarEdicion() {
    const encontrados = validar(camposEdicion)
    setErroresEdicion(encontrados)

    if (Object.keys(encontrados).length > 0) {
      return
    }

    setGuardandoEdicion(true)
    setFalloEdicion(null)
    try {
      const actualizado = await editarDocente(docenteEditando.id, {
        nombre: camposEdicion.nombre,
        apellido: camposEdicion.apellido,
        dni: camposEdicion.dni,
        email: camposEdicion.email,
        telefono: camposEdicion.telefono === '' ? null : camposEdicion.telefono,
      })
      // Las comisiones ya estaban resueltas en la fila y la edición no las recalcula (D52).
      setDocentes((anteriores) =>
        anteriores.map((fila) =>
          fila.id === actualizado.id
            ? {
                ...actualizado,
                comisiones: fila.comisiones,
                comisiones_asignadas: fila.comisiones_asignadas,
              }
            : fila,
        ),
      )
      cerrarEdicion()
      setAviso(`Docente ${actualizado.nombre} actualizado.`)
    } catch (error) {
      setFalloEdicion(error?.message ?? 'No se pudo guardar la edición.')
    } finally {
      setGuardandoEdicion(false)
    }
  }

  function abrirPassword(docente) {
    setDocentePassword(docente)
    setNuevaPassword('')
    setConfirmarPassword('')
    setErroresPassword({})
    setFalloPassword(null)
  }

  function cerrarPassword() {
    setDocentePassword(null)
    setNuevaPassword('')
    setConfirmarPassword('')
    setErroresPassword({})
    setFalloPassword(null)
  }

  async function guardarPassword() {
    const encontrados = {}
    if (nuevaPassword.length < LARGO_MINIMO_PASSWORD) {
      encontrados.nuevaPassword = `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`
    }
    if (confirmarPassword !== nuevaPassword) {
      encontrados.confirmarPassword = 'Las contraseñas no coinciden.'
    }
    setErroresPassword(encontrados)

    if (Object.keys(encontrados).length > 0) {
      return
    }

    setGuardandoPassword(true)
    setFalloPassword(null)
    try {
      await restablecerPasswordDocente(docentePassword.id, nuevaPassword)
      const nombre = docentePassword.nombre
      cerrarPassword()
      setAviso(
        `Contraseña de ${nombre} restablecida. Deberá cambiarla en su próximo ingreso.`,
      )
    } catch (error) {
      setFalloPassword(error?.message ?? 'No se pudo restablecer la contraseña.')
    } finally {
      setGuardandoPassword(false)
    }
  }

  // La columna de acciones necesita los manejadores de esta pantalla, así que se agrega acá y no
  // en la constante de las columnas del dato.
  const columnas = [
    ...COLUMNAS,
    {
      clave: 'acciones',
      titulo: 'ACCIONES',
      render: (fila) => (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variante="secundario"
            tamano="chico"
            className="whitespace-nowrap"
            onClick={() => abrirEdicion(fila)}
          >
            Editar
          </Button>
          <Button
            variante="secundario"
            tamano="chico"
            className="whitespace-nowrap"
            onClick={() => abrirPassword(fila)}
          >
            Restablecer contraseña
          </Button>
        </div>
      ),
    },
  ]

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
          columnas={columnas}
          filas={docentes}
          vacio={<p className="text-sm text-slate-500">No se encontraron docentes</p>}
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

      <Modal
        abierto={docenteEditando !== null}
        titulo="Editar Docente"
        onClose={cerrarEdicion}
        pie={
          <>
            <Button variante="secundario" onClick={cerrarEdicion}>
              Cancelar
            </Button>
            <Button onClick={guardarEdicion} disabled={guardandoEdicion}>
              {guardandoEdicion ? 'Guardando…' : 'Guardar Cambios'}
            </Button>
          </>
        }
      >
        {docenteEditando !== null && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="editar-docente-nombre"
                etiqueta="Nombre"
                valor={camposEdicion.nombre}
                onChange={cambiarEdicion('nombre')}
                obligatorio
                error={erroresEdicion.nombre ?? null}
              />
              <Input
                id="editar-docente-apellido"
                etiqueta="Apellido"
                valor={camposEdicion.apellido}
                onChange={cambiarEdicion('apellido')}
                obligatorio
                error={erroresEdicion.apellido ?? null}
              />
              <Input
                id="editar-docente-dni"
                etiqueta="DNI"
                valor={camposEdicion.dni}
                onChange={cambiarEdicion('dni')}
                obligatorio
                error={erroresEdicion.dni ?? null}
              />
              <Input
                id="editar-docente-email"
                etiqueta="Mail"
                type="email"
                valor={camposEdicion.email}
                onChange={cambiarEdicion('email')}
                obligatorio
                error={erroresEdicion.email ?? null}
              />
              <Input
                id="editar-docente-telefono"
                etiqueta="Teléfono"
                valor={camposEdicion.telefono}
                onChange={cambiarEdicion('telefono')}
              />
            </div>

            {falloEdicion !== null && (
              <p
                role="alert"
                className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {falloEdicion}
              </p>
            )}

            <p className="mt-4 text-xs text-slate-500">
              El docente conserva sus comisiones asignadas y su historial.
            </p>
          </>
        )}
      </Modal>

      <Modal
        abierto={docentePassword !== null}
        titulo="Restablecer contraseña"
        onClose={cerrarPassword}
        pie={
          <>
            <Button variante="secundario" onClick={cerrarPassword}>
              Cancelar
            </Button>
            <Button onClick={guardarPassword} disabled={guardandoPassword}>
              {guardandoPassword ? 'Guardando…' : 'Restablecer contraseña'}
            </Button>
          </>
        }
      >
        {docentePassword !== null && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Nueva contraseña para <span className="font-medium">{docentePassword.nombre}</span>.
              La anterior dejará de ser válida y deberá cambiarla en su próximo ingreso.
            </p>
            <Input
              id="docente-nueva-password"
              etiqueta="Nueva contraseña"
              type="password"
              valor={nuevaPassword}
              onChange={(evento) => setNuevaPassword(evento.target.value)}
              obligatorio
              error={erroresPassword.nuevaPassword ?? null}
            />
            <Input
              id="docente-confirmar-password"
              etiqueta="Confirmar contraseña"
              type="password"
              valor={confirmarPassword}
              onChange={(evento) => setConfirmarPassword(evento.target.value)}
              obligatorio
              error={erroresPassword.confirmarPassword ?? null}
            />

            {falloPassword !== null && (
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {falloPassword}
              </p>
            )}
          </div>
        )}
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
