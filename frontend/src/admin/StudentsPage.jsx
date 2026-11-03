import { useEffect, useState } from 'react'
import { isValidPhoneNumber } from 'react-phone-number-input'
import {
  Badge,
  Button,
  CampoTelefono,
  Card,
  Input,
  Modal,
  Table,
} from '../components/ui'
import { formatDocumento, formatTelefono } from '../utils/formato'
import { TONO } from '../components/ui/paleta'
import { FichaAlumnoModal } from './FichaAlumnoModal'
import { CategoriaInscripcionModal } from './CategoriaInscripcionModal'
import { HabilitacionInscripcionModal } from './HabilitacionInscripcionModal'
import { dniConForma, emailConForma } from '../domain/validacion'
import {
  buscarAlumnoReactivable,
  buscarAlumnos,
  cargarNominaEmpresa,
  crearAlumno,
  crearEmpresa,
  editarAlumno,
  eliminarAlumno,
  listarEmpresas,
  listarComisiones,
  reactivarAlumno,
  restablecerPasswordAlumno,
} from '../services/dataService'

/**
 * Alumnos e inscripciones (9.5 y 13).
 *
 * **La categoría arancelaria trae su color y no lo decide la fila.** Hay cuatro categorías en el
 * enum y cuatro colores, y el color es cosa de la interfaz: si el color viviera en el dato, cada
 * fila elegiría el suyo y `PARTICULAR` terminaría azul en una pantalla y gris en otra.
 *
 * **El acceso bloqueado muestra siempre la causa** (`StatusIndicator` la exige). Los dos casos
 * bloqueados del maquetado son los dos que el cliente tiene sin resolver, y ninguno se corrige por
 * la interfaz: Agustina Benítez por `comprobante ilegible` y Valeria Rossi por `debe saldo`.
 *
 * **El documento va tal como lo registra el cliente**, incluido el texto del alumno del exterior
 * (D30). Inventar un número para Nicolás Castro sería peor que mostrar el hueco: el padrón admite
 * alumnos sin documento justamente porque el instituto los inscribe.
 *
 * **Un alumno sin inscripción deja huecos, no datos inventados** (D43): `Sin comisión` en la
 * comisión asignada y `—` en la categoría y en el acceso. Esas columnas pertenecen a las historias
 * #14, #15 y siguientes.
 *
 * **El alta reutiliza el modal de Docentes y no crea componentes visuales.** Pide DNI, nombre,
 * email y teléfono opcional —nunca `tipo_documento`, porque esta entrega registra solo DNI
 * (D44)— y valida en el cliente lo mismo que valida el backend antes de enviar. La regla del DNI
 * y la del email son las compartidas con docentes (D57), y el teléfono se carga con selector de
 * país y viaja en E.164 o `null`. Un rechazo de la
 * fuente deja el modal abierto con lo cargado y muestra el motivo; un fallo de red no confirma
 * nada. Al confirmar, un modal superpuesto muestra **usuario y contraseña inicial** para que el
 * administrador se los entregue al alumno: no se envía ningún correo y el alumno deberá cambiarla
 * en su primer ingreso (D45).
 *
 * **El buscador consulta a la fuente por DNI o email (historia #16).** El filtro va al servicio,
 * no sobre el arreglo ya cargado: el mismo criterio sirve con datos de ejemplo y con la API, y la
 * consulta llega al servidor cuando el endpoint la resuelve.
 */

/** Lo que el cliente escribe en la planilla cuando el alumno no tiene documento (D30). */
const SIN_DOCUMENTO = 'Sin DNI (alumno exterior)'

const SIN_DATO = '—'

const COLUMNAS_ALUMNOS = [
  {
    clave: 'documento',
    titulo: 'DNI',
    render: (fila) => formatDocumento(fila.documento ?? SIN_DOCUMENTO),
  },
  {
    clave: 'nombre',
    titulo: 'NOMBRE',
    render: (fila) => <span className="font-medium">{fila.nombre}</span>,
  },
  { clave: 'email', titulo: 'EMAIL', render: (fila) => fila.email },
  {
    clave: 'telefono',
    titulo: 'TELÉFONO',
    render: (fila) => (fila.telefono ? formatTelefono(fila.telefono) : SIN_DATO),
  },
]

const COLUMNAS_EMPRESAS = [
  {
    clave: 'razon_social',
    titulo: 'RAZÓN SOCIAL',
    render: (fila) => <span className="font-medium">{fila.razon_social}</span>,
  },
  { clave: 'cuit', titulo: 'CUIT', render: (fila) => fila.cuit },
  {
    clave: 'factura',
    titulo: 'PREFERENCIA FACTURA',
    render: (fila) => <Badge tono={TONO.CELESTE}>{fila.requiere_factura_a ? 'A' : 'B'}</Badge>,
  },
  {
    clave: 'nomina',
    titulo: 'NÓMINA DE EMPLEADOS',
    render: (fila) => fila.nomina_empleados || '—',
  },
]

const CAMPOS_ALUMNO_VACIOS = { documento: '', nombre: '', email: '', telefono: '' }
const CAMPOS_EMPRESA_VACIOS = { razon_social: '', cuit: '', requiere_factura_a: false }
const EMPLEADO_NOMINA_VACIO = {
  documento: '',
  nombre: '',
  email: '',
  telefono: '',
}

export function StudentsPage() {
  const [alumnos, setAlumnos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [consulta, setConsulta] = useState('')
  // La fila cuya ficha está abierta (HU 61). La ficha pide el detalle al abrirse.
  const [alumnoFicha, setAlumnoFicha] = useState(null)
  const [modalAlumnoAbierto, setModalAlumnoAbierto] = useState(false)
  const [camposAlumno, setCamposAlumno] = useState(CAMPOS_ALUMNO_VACIOS)
  const [erroresAlumno, setErroresAlumno] = useState({})
  const [credenciales, setCredenciales] = useState(null)
  const [falloAlumno, setFalloAlumno] = useState(null)
  const [guardandoAlumno, setGuardandoAlumno] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  const [alumnoEditando, setAlumnoEditando] = useState(null)
  const [camposEdicion, setCamposEdicion] = useState(CAMPOS_ALUMNO_VACIOS)
  const [erroresEdicion, setErroresEdicion] = useState({})
  const [falloEdicion, setFalloEdicion] = useState(null)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  const [alumnoPassword, setAlumnoPassword] = useState(null)
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [erroresPassword, setErroresPassword] = useState({})
  const [falloPassword, setFalloPassword] = useState(null)
  const [guardandoPassword, setGuardandoPassword] = useState(false)

  const [alumnoAEliminar, setAlumnoAEliminar] = useState(null)
  const [falloBaja, setFalloBaja] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  const [alumnoReactivar, setAlumnoReactivar] = useState(null)
  const [falloReactivar, setFalloReactivar] = useState(null)
  const [reactivando, setReactivando] = useState(false)

  const [modalEmpresaAbierto, setModalEmpresaAbierto] = useState(false)
  const [camposEmpresa, setCamposEmpresa] = useState(CAMPOS_EMPRESA_VACIOS)
  const [erroresEmpresa, setErroresEmpresa] = useState({})
  const [falloEmpresa, setFalloEmpresa] = useState(null)
  const [guardandoEmpresa, setGuardandoEmpresa] = useState(false)
  const [comisiones, setComisiones] = useState([])
  const [modalNominaAbierto, setModalNominaAbierto] = useState(false)
  const [empresaNomina, setEmpresaNomina] = useState(null)
  const [comisionNomina, setComisionNomina] = useState('')
  const [empleadosNomina, setEmpleadosNomina] = useState([{ ...EMPLEADO_NOMINA_VACIO }])
  const [falloNomina, setFalloNomina] = useState(null)
  const [guardandoNomina, setGuardandoNomina] = useState(false)

  const [inscripcionCategoria, setInscripcionCategoria] = useState(null)
  const [inscripcionHabilitacion, setInscripcionHabilitacion] = useState(null)
  // Cambiar la categoría o la habilitación desde la ficha recarga solo el detalle (HU 61).
  const [fichaVersion, setFichaVersion] = useState(0)

  useEffect(() => {
    // El filtro va al servicio, no sobre el arreglo ya cargado: el mismo criterio tiene que
    // servir cuando los datos vengan de la API y la consulta llegue al servidor.
    buscarAlumnos(consulta)
      .then(setAlumnos)
      .catch(() => setAlumnos([]))
  }, [consulta])

  useEffect(() => {
    listarEmpresas()
      .then(setEmpresas)
      .catch(() => setEmpresas([]))
  }, [])

  useEffect(() => {
    listarComisiones()
      .then(setComisiones)
      .catch(() => setComisiones([]))
  }, [])

  function cambiarAlumno(campo) {
    return (evento) =>
      setCamposAlumno((anteriores) => ({ ...anteriores, [campo]: evento.target.value }))
  }

  function cerrarModalAlumno() {
    setModalAlumnoAbierto(false)
    setCamposAlumno(CAMPOS_ALUMNO_VACIOS)
    setErroresAlumno({})
    setFalloAlumno(null)
  }

  function validarAlumno(campos = camposAlumno) {
    const encontrados = {}
    const documento = campos.documento.trim()

    if (documento === '') {
      encontrados.documento = 'El DNI es obligatorio.'
    } else if (!dniConForma(documento)) {
      encontrados.documento = 'El DNI debe tener 7 u 8 dígitos.'
    }
    if (campos.nombre.trim() === '') {
      encontrados.nombre = 'El nombre es obligatorio.'
    }
    if (campos.email.trim() === '') {
      encontrados.email = 'El email es obligatorio.'
    } else if (!emailConForma(campos.email)) {
      encontrados.email = 'El email no tiene un formato válido.'
    }
    if (campos.telefono !== '' && !isValidPhoneNumber(campos.telefono)) {
      encontrados.telefono = 'El teléfono no es válido: elegí el país y escribí el número.'
    }

    return encontrados
  }

  async function guardarAlumno() {
    const encontrados = validarAlumno()
    setErroresAlumno(encontrados)

    if (Object.keys(encontrados).length > 0) {
      return
    }

    setGuardandoAlumno(true)
    setFalloAlumno(null)
    try {
      // Sin `tipo_documento`: el contrato no lo admite (D44).
      const creado = await crearAlumno({
        documento: camposAlumno.documento,
        nombre: camposAlumno.nombre,
        email: camposAlumno.email,
        telefono: camposAlumno.telefono === '' ? null : camposAlumno.telefono,
      })
      setAlumnos((anteriores) => [...anteriores, creado])
      cerrarModalAlumno()
      // D45: la contraseña inicial se muestra una sola vez, en un modal, para que Secretaría se
      // la entregue al alumno. No se envía por correo.
      setCredenciales({
        nombre: creado.nombre,
        email: creado.email,
        password: creado.password_inicial,
      })
    } catch (error) {
      if (error?.status === 409) {
        try {
          const reactivable = await buscarAlumnoReactivable({
            documento: camposAlumno.documento,
            email: camposAlumno.email,
          })
          if (reactivable !== null && reactivable !== undefined) {
            // Se oculta el formulario sin descartarlo: si el administrador cancela la
            // reactivación, vuelve al alta con lo que ya había cargado.
            setModalAlumnoAbierto(false)
            setAlumnoReactivar(reactivable)
            setFalloAlumno(null)
            return
          }
        } catch {
          // Si la consulta de reactivación falla, se muestra el rechazo original del alta.
        }
      }
      setFalloAlumno(error?.message ?? 'No se pudo guardar el alumno.')
    } finally {
      setGuardandoAlumno(false)
    }
  }

  function cerrarCredenciales() {
    setCredenciales(null)
  }

  function abrirEdicion(alumno) {
    setAlumnoEditando(alumno)
    setCamposEdicion({
      documento: alumno.documento ?? '',
      nombre: alumno.nombre,
      email: alumno.email,
      telefono: alumno.telefono ?? '',
    })
    setErroresEdicion({})
    setFalloEdicion(null)
  }

  function cerrarEdicion() {
    setAlumnoEditando(null)
    setCamposEdicion(CAMPOS_ALUMNO_VACIOS)
    setErroresEdicion({})
    setFalloEdicion(null)
  }

  function cambiarEdicion(campo) {
    return (evento) =>
      setCamposEdicion((anteriores) => ({ ...anteriores, [campo]: evento.target.value }))
  }

  async function guardarEdicion() {
    const encontrados = validarAlumno(camposEdicion)
    setErroresEdicion(encontrados)

    if (Object.keys(encontrados).length > 0) {
      return
    }

    setGuardandoEdicion(true)
    setFalloEdicion(null)
    try {
      const actualizado = await editarAlumno(alumnoEditando.id, {
        documento: camposEdicion.documento,
        nombre: camposEdicion.nombre,
        email: camposEdicion.email,
        telefono: camposEdicion.telefono === '' ? null : camposEdicion.telefono,
      })
      setAlumnos((anteriores) =>
        anteriores.map((fila) =>
          fila.id === actualizado.id
            ? { ...fila, ...actualizado }
            : fila,
        ),
      )
      // La ficha abierta muestra los datos nuevos sin volver a abrirse.
      setAlumnoFicha((actual) =>
        actual !== null && actual.id === actualizado.id ? actualizado : actual,
      )
      cerrarEdicion()
      setMensaje(`Los datos de ${actualizado.nombre} se actualizaron correctamente.`)
    } catch (error) {
      setFalloEdicion(error?.message ?? 'No se pudo guardar la edición.')
    } finally {
      setGuardandoEdicion(false)
    }
  }

  function abrirPassword(alumno) {
    setAlumnoPassword(alumno)
    setNuevaPassword('')
    setConfirmarPassword('')
    setErroresPassword({})
    setFalloPassword(null)
  }

  function cerrarPassword() {
    setAlumnoPassword(null)
    setNuevaPassword('')
    setConfirmarPassword('')
    setErroresPassword({})
    setFalloPassword(null)
  }

  async function guardarPassword() {
    const encontrados = {}
    if (nuevaPassword.length < 8) {
      encontrados.nuevaPassword = 'La contraseña debe tener al menos 8 caracteres.'
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
      await restablecerPasswordAlumno(alumnoPassword.id, nuevaPassword)
      const nombre = alumnoPassword.nombre
      cerrarPassword()
      setMensaje(
        `Contraseña de ${nombre} restablecida. Deberá cambiarla en su próximo ingreso.`,
      )
    } catch (error) {
      setFalloPassword(error?.message ?? 'No se pudo restablecer la contraseña.')
    } finally {
      setGuardandoPassword(false)
    }
  }

  function abrirBaja(alumno) {
    setAlumnoAEliminar(alumno)
    setFalloBaja(null)
  }

  function cerrarBaja() {
    setAlumnoAEliminar(null)
    setFalloBaja(null)
  }

  async function confirmarBaja() {
    setEliminando(true)
    setFalloBaja(null)
    try {
      const nombre = alumnoAEliminar.nombre
      const id = alumnoAEliminar.id
      await eliminarAlumno(id)
      setAlumnos((anteriores) => anteriores.filter((fila) => fila.id !== id))
      // La ficha del alumno dado de baja se cierra: ya no hay fila a la que volver.
      setAlumnoFicha((actual) => (actual !== null && actual.id === id ? null : actual))
      cerrarBaja()
      setMensaje(`Alumno ${nombre} dado de baja correctamente.`)
    } catch (error) {
      setFalloBaja(error?.message ?? 'No se pudo dar de baja al alumno.')
    } finally {
      setEliminando(false)
    }
  }

  function cerrarReactivar({ volverAlFormulario = false } = {}) {
    setAlumnoReactivar(null)
    setFalloReactivar(null)
    if (volverAlFormulario) {
      // El alta quedó oculta pero con sus campos intactos.
      setModalAlumnoAbierto(true)
    }
  }

  function volverDelAvisoDeReactivacion() {
    cerrarReactivar({ volverAlFormulario: true })
  }

  async function confirmarReactivar() {
    setReactivando(true)
    setFalloReactivar(null)
    try {
      const creado = await reactivarAlumno(alumnoReactivar.id, {
        documento: camposAlumno.documento,
        nombre: camposAlumno.nombre,
        email: camposAlumno.email,
        telefono: camposAlumno.telefono === '' ? null : camposAlumno.telefono,
      })
      // La fila vuelve a estar activa; se refresca el padrón para traer comisión, categoría y
      // acceso calculados por la fuente.
      setAlumnos((anteriores) =>
        anteriores.some((fila) => fila.id === creado.id)
          ? anteriores.map((fila) => (fila.id === creado.id ? creado : fila))
          : [...anteriores, creado],
      )
      buscarAlumnos(consulta).then(setAlumnos).catch(() => {})
      cerrarReactivar()
      cerrarModalAlumno()
      setCredenciales({
        nombre: creado.nombre,
        email: creado.email,
        password: creado.password_inicial,
      })
    } catch (error) {
      setFalloReactivar(error?.message ?? 'No se pudo reactivar al alumno.')
    } finally {
      setReactivando(false)
    }
  }

  function cambiarEmpresa(campo) {
    return (evento) =>
      setCamposEmpresa((anteriores) => ({ ...anteriores, [campo]: evento.target.value }))
  }

  function cerrarModalEmpresa() {
    setModalEmpresaAbierto(false)
    setCamposEmpresa(CAMPOS_EMPRESA_VACIOS)
    setErroresEmpresa({})
    setFalloEmpresa(null)
  }

  /**
   * La acción Categoría opera sobre **una inscripción** (HU 64 y 61). La ficha abre el formulario
   * de la pestaña abierta; el padrón ya no ofrece la acción en la fila.
   */
  function abrirFormularioCategoria(inscripcion) {
    setInscripcionCategoria(inscripcion)
  }

  function cerrarModalCategoria() {
    setInscripcionCategoria(null)
  }

  /** El formulario compartido guardó: la ficha se recarga y la pantalla lo anuncia. */
  function categoriaGuardada() {
    const comision = `${inscripcionCategoria.comision.codigo} ${inscripcionCategoria.comision.nombre}`
    cerrarModalCategoria()
    setFichaVersion((version) => version + 1)
    setMensaje(`Categoría actualizada en ${comision}.`)
  }

  /** El lápiz de `Estado de habilitación` abre el modal de esa inscripción (H/U 30). */
  function abrirFormularioHabilitacion(inscripcion) {
    setInscripcionHabilitacion(inscripcion)
  }

  function cerrarModalHabilitacion() {
    setInscripcionHabilitacion(null)
  }

  /** Guardar o quitar el forzado recarga la ficha sin perder la comisión elegida. */
  function habilitacionGuardada(resultado) {
    const comision = `${inscripcionHabilitacion.comision.codigo} ${inscripcionHabilitacion.comision.nombre}`
    cerrarModalHabilitacion()
    setFichaVersion((version) => version + 1)
    setMensaje(
      resultado === 'forzado'
        ? `Estado de habilitación forzado en ${comision}.`
        : `Se quitó el forzado de ${comision}: vuelve a la regla automática.`,
    )
  }

  function validarEmpresa() {
    const encontrados = {}

    if (camposEmpresa.razon_social.trim() === '') {
      encontrados.razon_social = 'La razón social es obligatoria.'
    }
    if (camposEmpresa.cuit.trim() === '') {
      encontrados.cuit = 'El CUIT es obligatorio.'
    }

    return encontrados
  }

  async function guardarEmpresa() {
    const encontrados = validarEmpresa()
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
      cerrarModalEmpresa()
    } catch (error) {
      // Un alta rechazada —duplicado, CUIT con dígito verificador inválido— deja el modal
      // abierto con lo que escribió la secretaría y el motivo tal como lo informa la fuente
      // (D36), que en el duplicado identifica la empresa existente.
      setFalloEmpresa(error?.message ?? 'No se pudo guardar la empresa.')
    } finally {
      setGuardandoEmpresa(false)
    }
  }

  function abrirModalNomina(empresa) {
    setEmpresaNomina(empresa)
    setComisionNomina('')
    setEmpleadosNomina([{ ...EMPLEADO_NOMINA_VACIO }])
    setFalloNomina(null)
    setModalNominaAbierto(true)
  }

  function cerrarModalNomina() {
    setModalNominaAbierto(false)
    setEmpresaNomina(null)
    setComisionNomina('')
    setEmpleadosNomina([{ ...EMPLEADO_NOMINA_VACIO }])
    setFalloNomina(null)
  }

  function cambiarEmpleado(indice, campo, valor) {
    setEmpleadosNomina((anteriores) =>
      anteriores.map((empleado, posicion) =>
        posicion === indice ? { ...empleado, [campo]: valor } : empleado,
      ),
    )
  }

  function validarNomina() {
    const errores = []
    if (!comisionNomina) {
      errores.push('Seleccioná una comisión.')
    }

    const documentos = new Set()
    empleadosNomina.forEach((empleado, indice) => {
      const fila = indice + 1
      const documentoNormalizado = empleado.documento.replace(/[.\s-]/g, '')
      if (!dniConForma(empleado.documento)) {
        errores.push(`Empleado ${fila}: ingresá un DNI válido.`)
      } else if (documentos.has(documentoNormalizado)) {
        errores.push(`Empleado ${fila}: el DNI está repetido en la nómina.`)
      } else {
        documentos.add(documentoNormalizado)
      }
      if (!empleado.nombre.trim()) errores.push(`Empleado ${fila}: ingresá el nombre completo.`)
      if (!emailConForma(empleado.email)) errores.push(`Empleado ${fila}: ingresá un email válido.`)
    })
    return errores
  }

  async function guardarNomina() {
    const errores = validarNomina()
    if (errores.length > 0) {
      setFalloNomina(errores.join(' '))
      return
    }

    const empleados = empleadosNomina.map((empleado) => ({
      documento: empleado.documento,
      nombre: empleado.nombre,
      email: empleado.email,
      telefono: empleado.telefono || null,
    }))

    setGuardandoNomina(true)
    setFalloNomina(null)
    try {
      const resultado = await cargarNominaEmpresa(empresaNomina.id, {
        comision_id: Number(comisionNomina),
        empleados,
      })
      setEmpresas((anteriores) =>
        anteriores.map((empresa) =>
          empresa.id === empresaNomina.id
            ? { ...empresa, nomina_empleados: `${resultado.cantidad} personas cargadas` }
            : empresa,
        ),
      )
      cerrarModalNomina()
      setMensaje(`Nómina cargada: ${resultado.cantidad} empleados inscriptos.`)
    } catch (error) {
      setFalloNomina(error?.message ?? 'No se pudo cargar la nómina.')
    } finally {
      setGuardandoNomina(false)
    }
  }

  // El padrón tiene una sola acción por fila: abrir la ficha (HU 61). Editar, restablecer la
  // contraseña, eliminar y cambiar la categoría viven adentro de la ficha.
  const columnasAlumnos = [
    ...COLUMNAS_ALUMNOS,
    {
      clave: 'acciones',
      titulo: 'ACCIONES',
      render: (fila) => (
        <Button
          variante="enlace"
          tamano="chico"
          onClick={() => setAlumnoFicha(fila)}
        >
          Ver ficha ↗
        </Button>
      ),
    },
  ]

  const columnasEmpresas = [
    ...COLUMNAS_EMPRESAS,
    {
      clave: 'acciones',
      titulo: 'ACCIONES',
      render: (fila) => (
        <Button variante="secundario" tamano="chico" onClick={() => abrirModalNomina(fila)}>
          Cargar nómina
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {mensaje !== null && (
        <p
          role="status"
          className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {mensaje}
        </p>
      )}

      <Card
        titulo="Padrón de Alumnos Regulares"
        acciones={
          <Button variante="secundario" onClick={() => setModalAlumnoAbierto(true)}>
            + Nuevo Alumno
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="max-w-sm flex-1">
            <Input
              id="buscar-alumno"
            etiqueta="Buscar alumno"
            valor={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
            placeholder="Buscar por DNI o Nombre…"
          />
          </div>
        </div>

        <Table
          columnas={columnasAlumnos}
          filas={alumnos}
          vacio={<p className="text-sm text-slate-500">No se encontraron resultados.</p>}
          onFila={setAlumnoFicha}
          etiquetaDeFila={(fila) => `Abrir la ficha de ${fila.nombre}`}
        />
      </Card>

      {alumnoFicha !== null && (
        <FichaAlumnoModal
          key={alumnoFicha.id}
          alumno={alumnoFicha}
          version={fichaVersion}
          onClose={() => setAlumnoFicha(null)}
          onEditar={abrirEdicion}
          onRestablecerPassword={abrirPassword}
          onEliminar={abrirBaja}
          onCambiarCategoria={abrirFormularioCategoria}
          onEditarHabilitacion={abrirFormularioHabilitacion}
        />
      )}

      <Modal
        abierto={credenciales !== null}
        titulo="Credenciales del alumno"
        onClose={cerrarCredenciales}
        pie={<Button onClick={cerrarCredenciales}>Entendido</Button>}
      >
        {credenciales !== null && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Alumno <span className="font-medium">{credenciales.nombre}</span> dado de alta.
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
          </div>
        )}
      </Modal>

      <Modal
        abierto={modalAlumnoAbierto}
        titulo="Nuevo Alumno"
        onClose={cerrarModalAlumno}
        pie={
          <>
            <Button variante="secundario" onClick={cerrarModalAlumno}>
              Cancelar
            </Button>
            <Button onClick={guardarAlumno} disabled={guardandoAlumno}>
              {guardandoAlumno ? 'Guardando…' : 'Guardar Alumno'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="alumno-dni"
            etiqueta="DNI"
            valor={camposAlumno.documento}
            onChange={cambiarAlumno('documento')}
            obligatorio
            error={erroresAlumno.documento ?? null}
          />
          <Input
            id="alumno-nombre"
            etiqueta="Nombre"
            valor={camposAlumno.nombre}
            onChange={cambiarAlumno('nombre')}
            obligatorio
            error={erroresAlumno.nombre ?? null}
          />
          <Input
            id="alumno-email"
            etiqueta="Email"
            type="email"
            valor={camposAlumno.email}
            onChange={cambiarAlumno('email')}
            obligatorio
            error={erroresAlumno.email ?? null}
          />
          <CampoTelefono
            id="alumno-telefono"
            etiqueta="Teléfono"
            valor={camposAlumno.telefono}
            onChange={(valor) =>
              setCamposAlumno((anteriores) => ({ ...anteriores, telefono: valor }))
            }
            error={erroresAlumno.telefono ?? null}
          />
        </div>

        {falloAlumno !== null && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {falloAlumno}
          </p>
        )}

        <p className="mt-4 text-xs text-slate-500">
          El alumno se crea con una cuenta de acceso para ese email y una contraseña inicial
          generada con su nombre y su DNI. La vas a ver al confirmar el alta: no se envía ningún
          correo y el alumno deberá cambiarla en su primer ingreso.
        </p>
      </Modal>

      <Card
        titulo="Cuentas Corporativas Vinculadas"
        acciones={
          <Button variante="secundario" onClick={() => setModalEmpresaAbierto(true)}>
            + Nueva Empresa
          </Button>
        }
      >
        {/* El alta de cuenta corporativa vive en esta misma pantalla, no en una pantalla
            separada de empresas: es lo que dice el spec y evita un ítem de más. */}
        <Table
          columnas={columnasEmpresas}
          filas={empresas}
          vacio={<p className="text-sm text-slate-500">No hay cuentas corporativas registradas.</p>}
        />
      </Card>

      <Modal
        abierto={modalEmpresaAbierto}
        titulo="Nueva Empresa"
        onClose={cerrarModalEmpresa}
        pie={
          <>
            <Button variante="secundario" onClick={cerrarModalEmpresa}>
              Cancelar
            </Button>
            <Button onClick={guardarEmpresa} disabled={guardandoEmpresa}>
              {guardandoEmpresa ? 'Guardando…' : 'Guardar Empresa'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Input
            id="empresa-razon-social"
            etiqueta="Razón Social"
            valor={camposEmpresa.razon_social}
            onChange={cambiarEmpresa('razon_social')}
            obligatorio
            error={erroresEmpresa.razon_social ?? null}
          />
          <Input
            id="empresa-cuit"
            etiqueta="CUIT"
            valor={camposEmpresa.cuit}
            onChange={cambiarEmpresa('cuit')}
            obligatorio
            error={erroresEmpresa.cuit ?? null}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              id="empresa-factura-a"
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
        </div>

        {falloEmpresa !== null && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {falloEmpresa}
          </p>
        )}
      </Modal>

      <Modal
        abierto={modalNominaAbierto}
        titulo={`Cargar nómina · ${empresaNomina?.razon_social ?? ''}`}
        onClose={cerrarModalNomina}
        pie={
          <>
            <Button variante="secundario" onClick={cerrarModalNomina}>
              Cancelar
            </Button>
            <Button onClick={guardarNomina} disabled={guardandoNomina}>
              {guardandoNomina ? 'Guardando…' : 'Guardar nómina'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <label className="text-sm text-slate-700">
            Comisión de curso formal
            <select
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={comisionNomina}
              onChange={(evento) => setComisionNomina(evento.target.value)}
            >
              <option value="">Seleccionar…</option>
              {comisiones.map((comision) => (
                <option key={comision.id} value={String(comision.id)}>
                  {comision.codigo} · {comision.curso?.nombre ?? comision.nombre_curso}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Empleados a inscribir</h3>
                <p className="mt-1 text-xs text-slate-500">
                  La empresa cubre la inscripción. Cargá los datos de cada persona; los campos
                  marcados con * son obligatorios.
                </p>
              </div>
              <Button
                variante="secundario"
                tamano="chico"
                onClick={() =>
                  setEmpleadosNomina((anteriores) => [
                    ...anteriores,
                    { ...EMPLEADO_NOMINA_VACIO },
                  ])
                }
              >
                + Agregar empleado
              </Button>
            </div>

            <div className="space-y-3">
              {empleadosNomina.map((empleado, indice) => (
                <div
                  key={indice}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Empleado {indice + 1}
                    </p>
                    {empleadosNomina.length > 1 && (
                      <Button
                        variante="secundario"
                        tamano="chico"
                        onClick={() =>
                          setEmpleadosNomina((anteriores) =>
                            anteriores.filter((_, posicion) => posicion !== indice),
                          )
                        }
                      >
                        Quitar
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      id={`nomina-documento-${indice}`}
                      etiqueta="DNI *"
                      valor={empleado.documento}
                      onChange={(evento) =>
                        cambiarEmpleado(indice, 'documento', evento.target.value)
                      }
                    />
                    <Input
                      id={`nomina-nombre-${indice}`}
                      etiqueta="Nombre completo *"
                      valor={empleado.nombre}
                      onChange={(evento) =>
                        cambiarEmpleado(indice, 'nombre', evento.target.value)
                      }
                    />
                    <Input
                      id={`nomina-email-${indice}`}
                      etiqueta="Email *"
                      type="email"
                      valor={empleado.email}
                      onChange={(evento) => cambiarEmpleado(indice, 'email', evento.target.value)}
                    />
                    <Input
                      id={`nomina-telefono-${indice}`}
                      etiqueta="Teléfono"
                      type="tel"
                      valor={empleado.telefono}
                      onChange={(evento) =>
                        cambiarEmpleado(indice, 'telefono', evento.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {falloNomina !== null && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {falloNomina}
            </p>
          )}
        </div>
      </Modal>

      {inscripcionCategoria !== null && (
        <CategoriaInscripcionModal
          inscripcion={inscripcionCategoria}
          empresas={empresas}
          onClose={cerrarModalCategoria}
          onGuardado={categoriaGuardada}
        />
      )}

      {inscripcionHabilitacion !== null && (
        <HabilitacionInscripcionModal
          alumno={alumnoFicha}
          inscripcion={inscripcionHabilitacion}
          onClose={cerrarModalHabilitacion}
          onGuardado={habilitacionGuardada}
        />
      )}

      <Modal
        abierto={alumnoEditando !== null}
        titulo="Editar Alumno"
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="editar-alumno-dni"
            etiqueta="DNI"
            valor={camposEdicion.documento}
            onChange={cambiarEdicion('documento')}
            obligatorio
            error={erroresEdicion.documento ?? null}
          />
          <Input
            id="editar-alumno-nombre"
            etiqueta="Nombre"
            valor={camposEdicion.nombre}
            onChange={cambiarEdicion('nombre')}
            obligatorio
            error={erroresEdicion.nombre ?? null}
          />
          <Input
            id="editar-alumno-email"
            etiqueta="Email"
            type="email"
            valor={camposEdicion.email}
            onChange={cambiarEdicion('email')}
            obligatorio
            error={erroresEdicion.email ?? null}
          />
          <CampoTelefono
            id="editar-alumno-telefono"
            etiqueta="Teléfono"
            valor={camposEdicion.telefono}
            onChange={(valor) =>
              setCamposEdicion((anteriores) => ({ ...anteriores, telefono: valor }))
            }
            error={erroresEdicion.telefono ?? null}
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
          El alumno conserva su legajo, sus inscripciones y su historial de pagos.
        </p>
      </Modal>

      <Modal
        abierto={alumnoPassword !== null}
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
        {alumnoPassword !== null && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Nueva contraseña para <span className="font-medium">{alumnoPassword.nombre}</span>.
              La anterior dejará de ser válida y deberá cambiarla en su próximo ingreso.
            </p>
            <Input
              id="alumno-nueva-password"
              etiqueta="Nueva contraseña"
              type="password"
              valor={nuevaPassword}
              onChange={(evento) => setNuevaPassword(evento.target.value)}
              obligatorio
              error={erroresPassword.nuevaPassword ?? null}
            />
            <Input
              id="alumno-confirmar-password"
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

      <Modal
        abierto={alumnoAEliminar !== null}
        titulo="Eliminar Alumno"
        onClose={cerrarBaja}
        pie={
          <>
            <Button variante="secundario" onClick={cerrarBaja}>
              Cancelar
            </Button>
            <Button variante="peligro" onClick={confirmarBaja} disabled={eliminando}>
              {eliminando ? 'Eliminando…' : 'Confirmar baja'}
            </Button>
          </>
        }
      >
        {alumnoAEliminar !== null && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              ¿Confirmás la baja de{' '}
              <span className="font-medium">{alumnoAEliminar.nombre}</span>? Dejará de aparecer en
              el padrón y no podrá iniciar sesión.
            </p>

            {falloBaja !== null && (
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {falloBaja}
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        abierto={alumnoReactivar !== null}
        titulo="Reactivar alumno"
        onClose={volverDelAvisoDeReactivacion}
        pie={
          <>
            <Button variante="secundario" onClick={volverDelAvisoDeReactivacion}>
              Cancelar
            </Button>
            <Button onClick={confirmarReactivar} disabled={reactivando}>
              {reactivando ? 'Reactivando…' : 'Reactivar alumno'}
            </Button>
          </>
        }
      >
        {alumnoReactivar !== null && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              El alumno{' '}
              <span className="font-medium">{alumnoReactivar.nombre}</span> fue dado de baja
              anteriormente. Podés reactivar el mismo registro: conservará su legajo,
              inscripciones, pagos e historial, y recibirá una nueva contraseña inicial.
            </p>

            {falloReactivar !== null && (
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {falloReactivar}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
