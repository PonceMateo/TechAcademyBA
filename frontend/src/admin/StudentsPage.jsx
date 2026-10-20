import { useEffect, useState } from 'react'
import { Badge, Button, Card, Input, Modal, StatusIndicator, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { CATEGORIA_INSCRIPCION, TIPO_FACTURA } from '../domain/enums'
import { crearAlumno, listarAlumnos, listarEmpresas } from '../services/dataService'

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
 * nada. Al confirmar, el aviso aclara que la cuenta se creó pero las credenciales no se enviaron.
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
    render: (fila) => (
      <Badge tono={TONO.CELESTE}>{fila.preferencia_factura === TIPO_FACTURA.A ? 'A' : 'B'}</Badge>
    ),
  },
  { clave: 'nomina', titulo: 'NÓMINA DE EMPLEADOS', render: (fila) => fila.nomina_empleados },
]

const CAMPOS_VACIOS = { documento: '', nombre: '', email: '', telefono: '' }

export function StudentsPage() {
  const [alumnos, setAlumnos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [modalAbierto, setModalAbierto] = useState(false)
  const [campos, setCampos] = useState(CAMPOS_VACIOS)
  const [errores, setErrores] = useState({})
  const [aviso, setAviso] = useState(null)
  const [fallo, setFallo] = useState(null)
  const [guardando, setGuardando] = useState(false)

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
    const documento = campos.documento.trim()
    const digitos = documento.replace(/\D/g, '')

    if (documento === '') {
      encontrados.documento = 'El DNI es obligatorio.'
    } else if (!DNI_CON_SEPARADORES.test(documento) || ![7, 8].includes(digitos.length)) {
      encontrados.documento = 'El DNI debe tener 7 u 8 dígitos.'
    }
    if (campos.nombre.trim() === '') {
      encontrados.nombre = 'El nombre es obligatorio.'
    }
    if (campos.email.trim() === '') {
      encontrados.email = 'El email es obligatorio.'
    } else if (!emailConForma(campos.email.trim())) {
      encontrados.email = 'El email no tiene un formato válido.'
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
      // Sin `tipo_documento`: el contrato no lo admite (D44).
      const creado = await crearAlumno({
        documento: campos.documento,
        nombre: campos.nombre,
        email: campos.email,
        telefono: campos.telefono === '' ? null : campos.telefono,
      })
      setAlumnos((anteriores) => [...anteriores, creado])
      cerrarModal()
      setAviso(
        `Alumno ${creado.nombre} dado de alta. La cuenta se creó, pero no se enviaron las credenciales.`,
      )
    } catch (error) {
      setFallo(error?.message ?? 'No se pudo guardar el alumno.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card
        titulo="Padrón de Alumnos Regulares"
        acciones={
          <Button variante="secundario" onClick={() => setModalAbierto(true)}>
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
        titulo="Nuevo Alumno"
        onClose={cerrarModal}
        pie={
          <>
            <Button variante="secundario" onClick={cerrarModal}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar Alumno'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="alumno-dni"
            etiqueta="DNI"
            valor={campos.documento}
            onChange={cambiar('documento')}
            obligatorio
            error={errores.documento ?? null}
          />
          <Input
            id="alumno-nombre"
            etiqueta="Nombre"
            valor={campos.nombre}
            onChange={cambiar('nombre')}
            obligatorio
            error={errores.nombre ?? null}
          />
          <Input
            id="alumno-email"
            etiqueta="Email"
            type="email"
            valor={campos.email}
            onChange={cambiar('email')}
            obligatorio
            error={errores.email ?? null}
          />
          <Input
            id="alumno-telefono"
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
          El alumno se crea con una cuenta de acceso para ese email. Las credenciales no se envían
          todavía.
        </p>
      </Modal>

      <Card titulo="Cuentas Corporativas Vinculadas">
        {/* El alta de cuenta corporativa vive en esta misma pantalla, no en una pantalla
            separada de empresas: es lo que dice el spec y evita un ítem de más. */}
        <Table columnas={COLUMNAS_EMPRESAS} filas={empresas} />
      </Card>
    </div>
  )
}
