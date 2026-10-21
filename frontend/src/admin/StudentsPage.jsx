import { useEffect, useState } from 'react'
import { Badge, Button, Card, Input, Modal, StatusIndicator, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { CATEGORIA_INSCRIPCION } from '../domain/enums'
import { crearAlumno, crearEmpresa, listarAlumnos, listarEmpresas } from '../services/dataService'

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
 * (D44)— y valida en el cliente lo mismo que valida el backend antes de enviar. Un rechazo de la
 * fuente deja el modal abierto con lo cargado y muestra el motivo; un fallo de red no confirma
 * nada. Al confirmar, un modal superpuesto muestra **usuario y contraseña inicial** para que el
 * administrador se los entregue al alumno: no se envía ningún correo y el alumno deberá cambiarla
 * en su primer ingreso (D45).
 *
 * **El buscador está deshabilitado con `Próximamente`.** La búsqueda por DNI o email es la
 * historia #16 y no se adelanta con un filtro local que daría una falsa sensación de búsqueda.
 */

/** Las cuatro categorías del enum con el color que las distingue en pantalla. */
const CATEGORIAS = new Map([
  [CATEGORIA_INSCRIPCION.PARTICULAR, { etiqueta: 'PARTICULAR', tono: TONO.GRIS }],
  [CATEGORIA_INSCRIPCION.BECADO_PARCIAL, { etiqueta: 'BECADO PARCIAL', tono: TONO.VIOLETA }],
  [CATEGORIA_INSCRIPCION.BECADO_TOTAL, { etiqueta: 'BECADO TOTAL', tono: TONO.MAGENTA }],
  [CATEGORIA_INSCRIPCION.CORPORATIVO, { etiqueta: 'CORPORATIVO', tono: TONO.CELESTE }],
])

/** Lo que el cliente escribe en la planilla cuando el alumno no tiene documento (D30). */
const SIN_DOCUMENTO = 'Sin DNI (alumno exterior)'

/** Lo que la fila muestra cuando el alumno todavía no tiene inscripción (D43). */
const SIN_COMISION = 'Sin comisión'
const SIN_DATO = '—'

/** Lo único que puede aparecer en un DNI además de sus dígitos: puntos, espacios y guiones. */
const DNI_CON_SEPARADORES = /^[0-9.\s-]+$/

/**
 * La misma regla mínima de email que valida el backend (`app/schemas/validators.py`): algo antes
 * de la primera arroba y un dominio con punto que no termina en punto. Una pantalla que calculara
 * distinto del servidor rechazaría un formulario que la base acepta, o al revés.
 */
function emailConForma(valor) {
  const arroba = valor.indexOf('@')
  if (arroba === -1) {
    return false
  }
  const local = valor.slice(0, arroba)
  const dominio = valor.slice(arroba + 1)
  return local !== '' && dominio !== '' && dominio.includes('.') && !dominio.endsWith('.')
}

function columnaCategoria(categoria, porcentajeBeca) {
  const definicion = CATEGORIAS.get(categoria)

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tono={definicion?.tono ?? TONO.GRIS}>{definicion?.etiqueta ?? categoria}</Badge>
      {definicion?.etiqueta === 'BECADO PARCIAL' && (
        <span className="text-xs text-violet-800">{porcentajeBeca}% de descuento</span>
      )}
    </span>
  )
}

const COLUMNAS_ALUMNOS = [
  {
    clave: 'documento',
    titulo: 'DNI',
    render: (fila) => fila.documento ?? SIN_DOCUMENTO,
  },
  {
    clave: 'nombre',
    titulo: 'NOMBRE',
    render: (fila) => <span className="font-medium">{fila.nombre}</span>,
  },
  { clave: 'email', titulo: 'EMAIL', render: (fila) => fila.email },
  {
    clave: 'comision',
    titulo: 'COMISIÓN ASIGNADA',
    render: (fila) =>
      fila.comision === null || fila.comision === undefined ? (
        <span className="text-slate-500">{SIN_COMISION}</span>
      ) : (
        <span>
          <span className="font-medium">{fila.comision.codigo}</span>{' '}
          <span className="text-slate-500">{fila.comision.nombre}</span>
        </span>
      ),
  },
  {
    clave: 'categoria',
    titulo: 'CATEGORÍA ARANCELARIA',
    render: (fila) =>
      fila.categoria === null || fila.categoria === undefined
        ? SIN_DATO
        : columnaCategoria(fila.categoria, fila.porcentaje_beca),
  },
  {
    clave: 'acceso',
    titulo: 'ACCESO PLATAFORMA',
    render: (fila) =>
      fila.acceso === null || fila.acceso === undefined ? (
        SIN_DATO
      ) : (
        <StatusIndicator estado={fila.acceso.estado} causa={fila.acceso.causa} />
      ),
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

export function StudentsPage() {
  const [alumnos, setAlumnos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [modalAlumnoAbierto, setModalAlumnoAbierto] = useState(false)
  const [camposAlumno, setCamposAlumno] = useState(CAMPOS_ALUMNO_VACIOS)
  const [erroresAlumno, setErroresAlumno] = useState({})
  const [credenciales, setCredenciales] = useState(null)
  const [falloAlumno, setFalloAlumno] = useState(null)
  const [guardandoAlumno, setGuardandoAlumno] = useState(false)

  const [modalEmpresaAbierto, setModalEmpresaAbierto] = useState(false)
  const [camposEmpresa, setCamposEmpresa] = useState(CAMPOS_EMPRESA_VACIOS)
  const [erroresEmpresa, setErroresEmpresa] = useState({})
  const [falloEmpresa, setFalloEmpresa] = useState(null)
  const [guardandoEmpresa, setGuardandoEmpresa] = useState(false)

  useEffect(() => {
    // El padrón se carga una vez. La búsqueda es la historia #16: filtrar en memoria lo ya
    // traído daría una búsqueda que no cubre el padrón completo y habría que reescribirla.
    listarAlumnos()
      .then(setAlumnos)
      .catch(() => setAlumnos([]))
  }, [])

  useEffect(() => {
    listarEmpresas()
      .then(setEmpresas)
      .catch(() => setEmpresas([]))
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

  function validarAlumno() {
    const encontrados = {}
    const documento = camposAlumno.documento.trim()
    const digitos = documento.replace(/\D/g, '')

    if (documento === '') {
      encontrados.documento = 'El DNI es obligatorio.'
    } else if (!DNI_CON_SEPARADORES.test(documento) || ![7, 8].includes(digitos.length)) {
      encontrados.documento = 'El DNI debe tener 7 u 8 dígitos.'
    }
    if (camposAlumno.nombre.trim() === '') {
      encontrados.nombre = 'El nombre es obligatorio.'
    }
    if (camposAlumno.email.trim() === '') {
      encontrados.email = 'El email es obligatorio.'
    } else if (!emailConForma(camposAlumno.email.trim())) {
      encontrados.email = 'El email no tiene un formato válido.'
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
      setFalloAlumno(error?.message ?? 'No se pudo guardar el alumno.')
    } finally {
      setGuardandoAlumno(false)
    }
  }

  function cerrarCredenciales() {
    setCredenciales(null)
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

  return (
    <div className="space-y-4">
      <Card
        titulo="Padrón de Alumnos Regulares"
        acciones={
          <Button variante="secundario" onClick={() => setModalAlumnoAbierto(true)}>
            + Nuevo Alumno
          </Button>
        }
      >
        <div className="mb-4 max-w-sm">
          <Input
            id="buscar-alumno"
            etiqueta="Buscar alumno"
            valor=""
            readOnly
            disabled
            leyenda="Próximamente"
            placeholder="Buscar por DNI o Nombre…"
          />
        </div>

        <Table
          columnas={COLUMNAS_ALUMNOS}
          filas={alumnos}
          vacio={<p className="text-sm text-slate-500">No se encontraron resultados.</p>}
        />
      </Card>

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
          <Input
            id="alumno-telefono"
            etiqueta="Teléfono"
            valor={camposAlumno.telefono}
            onChange={cambiarAlumno('telefono')}
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
          columnas={COLUMNAS_EMPRESAS}
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
    </div>
  )
}
