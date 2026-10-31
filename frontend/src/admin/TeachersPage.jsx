import { useEffect, useRef, useState } from 'react'
import { isValidPhoneNumber } from 'react-phone-number-input'
import { Badge, Button, Campo, CampoTelefono, Card, Input, Modal, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import {
  componerCuil,
  dniConForma,
  dniDigitos,
  emailConForma,
  formatearCuil,
  partirCuil,
  PREFIJOS_CUIL,
} from '../domain/validacion'
import {
  buscarDocentes,
  crearDocente,
  editarDocente,
  restablecerPasswordDocente,
} from '../services/dataService'
import { formatDocumento, formatTelefono } from '../utils/formato'

/**
 * Padrón de docentes (9.4).
 *
 * **Las columnas son las del dato, no las del modelo.** La fuente de datos ya devuelve el nombre
 * unido y el conte de comisiones, así que la pantalla no sabe de dónde viene la fila.
 *
 * **El alta pide nombre, apellido, DNI, mail, teléfono y un CUIL opcional** (D57). El CUIL se
 * arma con tres controles —prefijo `20/23/24/27`, el DNI de solo lectura y un verificador de un
 * dígito— y viaja en 11 dígitos o `null`; un CUIL parcial no se envía. La columna CUIL de la
 * tabla lo muestra con guiones y un guion cuando el docente todavía no lo completó.
 *
 * **El dígito verificador lo escribe la secretaría.** No se calcula por módulo 11 (D57), así que
 * un CUIL completo se manda tal cual y la API lo guarda sin revisar ese dígito.
 *
 * **El teléfono se carga con selector de país y viaja en E.164 o `null`** (D57): la API dejó de
 * aceptar texto libre, así que el formulario valida antes de enviar.
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
 * teléfono (D52). Al abrir la edición, el CUIL guardado se parte en prefijo y verificador y los 8
 * dígitos del medio se arman con el DNI actual, así que un CUIL que no coincidía se corrige al
 * guardar (D57). Omitir el CUIL en el `PUT` conserva el actual, así que el formulario siempre lo
 * manda: en 11 dígitos o en `null`.
 *
 * El control de clases dictadas se muestra deshabilitado con `Próximamente` para que el cliente vea
 * el hueco (D20).
 *
 * **El alta entrega una contraseña inicial propia (HU #66).** La fuente la devuelve solo en la
 * respuesta del alta; la pantalla la muestra una única vez en un modal para que Secretaría se la
 * entregue al docente y la borra al cerrarlo. No se envía por correo y no queda en el padrón, en la
 * edición ni al recargar.
 */
const COLUMNAS = [
  {
    clave: 'nombre',
    titulo: 'DOCENTE',
    render: (fila) => <span className="font-medium">{fila.nombre}</span>,
  },
  { clave: 'dni', titulo: 'DNI', render: (fila) => formatDocumento(fila.dni) },
  {
    clave: 'cuil',
    titulo: 'CUIL',
    render: (fila) => (fila.cuil ? formatearCuil(fila.cuil) : '—'),
  },
  { clave: 'email', titulo: 'EMAIL', render: (fila) => fila.email },
  {
    clave: 'telefono',
    titulo: 'TELÉFONO',
    render: (fila) => (fila.telefono ? formatTelefono(fila.telefono) : '—'),
  },
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

const CAMPOS_VACIOS = {
  nombre: '',
  apellido: '',
  dni: '',
  email: '',
  telefono: '',
  cuilPrefijo: '',
  cuilVerificador: '',
}

const LARGO_MINIMO_PASSWORD = 8

/**
 * Los tres controles del CUIL: prefijo, DNI de solo lectura y verificador (D57).
 *
 * Vive fuera de la página porque el alta y la edición dibujan el mismo grupo y una copia por modal
 * termina con dos comportamientos. El prefijo arranca vacío —sin él, el CUIL es opcional— y el DNI
 * se completa con ceros a la izquierda hasta 8 dígitos, que es la comparación de la API.
 */
function CampoCuil({ id, dni, prefijo, verificador, onPrefijo, onVerificador, error = null }) {
  const digitosDni = dniDigitos(dni)

  return (
    <Campo etiqueta="CUIL" id={`${id}-prefijo`} error={error}>
      <div className="flex items-center gap-2">
        <select
          id={`${id}-prefijo`}
          aria-label="Prefijo del CUIL"
          value={prefijo}
          onChange={onPrefijo}
          className="foco-acento rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
        >
          <option value="">Sin prefijo</option>
          {PREFIJOS_CUIL.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
        <span className="text-slate-400">-</span>
        <input
          aria-label="Parte del DNI en el CUIL"
          readOnly
          value={digitosDni === '' ? '' : digitosDni.padStart(8, '0')}
          placeholder="00000000"
          className="w-24 rounded-lg border border-slate-300 bg-slate-100 px-2 py-2 text-sm text-slate-500"
        />
        <span className="text-slate-400">-</span>
        <input
          aria-label="Dígito verificador del CUIL"
          inputMode="numeric"
          maxLength={1}
          value={verificador}
          onChange={onVerificador}
          className="foco-acento w-10 rounded-lg border border-slate-300 bg-white px-2 py-2 text-center text-sm text-slate-900"
        />
      </div>
    </Campo>
  )
}

/** Lo que se escribe en el campo cuando el CUIL está a medio completar (D57). */
const CUIL_INCOMPLETO = 'El CUIL está incompleto: elegí el prefijo y escribí el verificador.'

/**
 * El CUIL que viaja en el cuerpo: 11 dígitos, `null` para borrarlo, o `undefined` para no mandarlo.
 *
 * El prefijo y el verificador van en el estado separados del DNI, así que el CUIL se compone recién
 * acá. Un CUIL a medio completar devuelve `null` y la validación es la que frena el envío: no se
 * manda un número que la API va a rechazar.
 *
 * **Un CUIL guardado que los controles no pueden mostrar no se borra.** Si la fila trae un prefijo
 * fuera de `20/23/24/27` —un dato de antes de D57, cuando la columna era obligatoria y el CHECK solo
 * pedía "no vacío"—, `partirCuil` deja los controles vacíos y mandar `null` borraría el CUIL cuando
 * alguien solo viene a corregir un teléfono. En ese caso el campo se omite y el `PUT` conserva el
 * que había (D57).
 */
function cuilParaEnviar(datos, cuilOriginal = null) {
  if (datos.cuilPrefijo === '' && datos.cuilVerificador === '') {
    return cuilOriginal !== null && partirCuil(cuilOriginal).prefijo === '' ? undefined : null
  }
  return componerCuil(datos.cuilPrefijo, datos.dni, datos.cuilVerificador)
}

export function TeachersPage() {
  const [docentes, setDocentes] = useState([])
  const [consulta, setConsulta] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [campos, setCampos] = useState(CAMPOS_VACIOS)
  const [errores, setErrores] = useState({})
  const [aviso, setAviso] = useState(null)
  const [fallo, setFallo] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [credenciales, setCredenciales] = useState(null)
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

  /**
   * Los cuatro manejadores que no son un `value` directo: el teléfono entrega el valor ya armado y
   * el CUIL limpia su verificador cuando cambia el DNI o el prefijo (D57).
   */
  function cambiarTelefono(setter) {
    return (valor) => setter((anteriores) => ({ ...anteriores, telefono: valor }))
  }

  function cambiarDni(setter) {
    return (evento) =>
      setter((anteriores) => ({
        ...anteriores,
        dni: evento.target.value,
        cuilVerificador: '',
      }))
  }

  function cambiarPrefijoCuil(setter) {
    return (evento) =>
      setter((anteriores) => ({
        ...anteriores,
        cuilPrefijo: evento.target.value,
        cuilVerificador: '',
      }))
  }

  function cambiarVerificadorCuil(setter) {
    return (evento) =>
      setter((anteriores) => ({
        ...anteriores,
        cuilVerificador: evento.target.value.replace(/\D/g, '').slice(0, 1),
      }))
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
    } else if (!dniConForma(datos.dni)) {
      encontrados.dni = 'El DNI debe tener 7 u 8 dígitos.'
    }
    if (datos.email.trim() === '') {
      encontrados.email = 'El mail es obligatorio.'
    } else if (!emailConForma(datos.email)) {
      encontrados.email = 'El mail no tiene un formato válido.'
    }
    if (datos.telefono !== '' && !isValidPhoneNumber(datos.telefono)) {
      encontrados.telefono = 'El teléfono no es válido: elegí el país y escribí el número.'
    }
    // El CUIL es opcional, pero a medio completar no se envía: la API lo rechaza con 422 (D57).
    const cuilCargado = datos.cuilPrefijo !== '' || datos.cuilVerificador !== ''
    if (cuilCargado && cuilParaEnviar(datos) === null) {
      encontrados.cuil = CUIL_INCOMPLETO
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
      const creado = await crearDocente({
        nombre: campos.nombre,
        apellido: campos.apellido,
        dni: campos.dni,
        email: campos.email,
        telefono: campos.telefono === '' ? null : campos.telefono,
        cuil: cuilParaEnviar(campos),
      })
      setDocentes((anteriores) => [...anteriores, creado])
      cerrarModal()
      setAviso(`Docente ${creado.nombre} dado de alta.`)
      // HU #66: la contraseña inicial se muestra una sola vez, en un modal, para que Secretaría se
      // la entregue al docente. No se envía por correo.
      setCredenciales({
        nombre: creado.nombre,
        email: creado.email,
        password: creado.password_inicial,
      })
    } catch (error) {
      setFallo(error?.message ?? 'No se pudo guardar el docente.')
    } finally {
      setGuardando(false)
    }
  }

  function cerrarCredenciales() {
    setCredenciales(null)
  }

  function abrirEdicion(docente) {
    setDocenteEditando(docente)
    const { prefijo, verificador } = partirCuil(docente.cuil)
    setCamposEdicion({
      nombre: docente.nombres ?? docente.nombre,
      apellido: docente.apellido ?? '',
      dni: docente.dni,
      email: docente.email,
      // El valor guardado puede ser legacy: el control lo normaliza al abrirlo y conserva el crudo
      // si no se puede interpretar (D57).
      telefono: docente.telefono ?? '',
      cuilPrefijo: prefijo,
      cuilVerificador: verificador,
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
      const cuil = cuilParaEnviar(camposEdicion, docenteEditando.cuil)
      const actualizado = await editarDocente(docenteEditando.id, {
        nombre: camposEdicion.nombre,
        apellido: camposEdicion.apellido,
        dni: camposEdicion.dni,
        email: camposEdicion.email,
        telefono: camposEdicion.telefono === '' ? null : camposEdicion.telefono,
        // Lo que muestran los controles viaja siempre: `null` cuando se vaciaron y 11 dígitos
        // cuando se completaron. Solo se omite el CUIL guardado que los controles no pueden
        // representar, para no borrarlo sin que nadie lo haya pedido (D57).
        ...(cuil !== undefined && { cuil }),
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
      setAviso(`Contraseña de ${nombre} restablecida. Deberá cambiarla en su próximo ingreso.`)
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
        acciones={
          <Button variante="secundario" onClick={() => setModalAbierto(true)}>
            + Nuevo Docente
          </Button>
        }
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
        abierto={credenciales !== null}
        titulo="Credenciales del docente"
        onClose={cerrarCredenciales}
        pie={<Button onClick={cerrarCredenciales}>Entendido</Button>}
      >
        {credenciales !== null && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Docente <span className="font-medium">{credenciales.nombre}</span> dado de alta.
              Entregale estas credenciales:
            </p>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Usuario
                </dt>
                <dd className="mt-1 break-all text-sm font-medium text-slate-900">
                  {credenciales.email}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Contraseña inicial
                </dt>
                <dd className="mt-1">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-900">
                    {credenciales.password}
                  </code>
                </dd>
              </div>
            </dl>
            <p className="text-sm text-slate-700">
              El docente deberá cambiarla en su primer ingreso.
            </p>
          </div>
        )}
      </Modal>

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
            onChange={cambiarDni(setCampos)}
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
          <CampoTelefono
            id="docente-telefono"
            etiqueta="Teléfono"
            valor={campos.telefono}
            onChange={cambiarTelefono(setCampos)}
            error={errores.telefono ?? null}
          />
          <CampoCuil
            id="docente-cuil"
            dni={campos.dni}
            prefijo={campos.cuilPrefijo}
            verificador={campos.cuilVerificador}
            onPrefijo={cambiarPrefijoCuil(setCampos)}
            onVerificador={cambiarVerificadorCuil(setCampos)}
            error={errores.cuil ?? null}
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
          El docente se crea con una cuenta de acceso para ese mail y una contraseña inicial que vas
          a ver al confirmar.
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
                onChange={cambiarDni(setCamposEdicion)}
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
              <CampoTelefono
                id="editar-docente-telefono"
                etiqueta="Teléfono"
                valor={camposEdicion.telefono}
                onChange={cambiarTelefono(setCamposEdicion)}
                error={erroresEdicion.telefono ?? null}
              />
              <CampoCuil
                id="editar-docente-cuil"
                dni={camposEdicion.dni}
                prefijo={camposEdicion.cuilPrefijo}
                verificador={camposEdicion.cuilVerificador}
                onPrefijo={cambiarPrefijoCuil(setCamposEdicion)}
                onVerificador={cambiarVerificadorCuil(setCamposEdicion)}
                error={erroresEdicion.cuil ?? null}
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
