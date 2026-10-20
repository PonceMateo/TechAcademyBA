import { useEffect, useState } from 'react'
import { Badge, Button, Card, Input, Modal, StatusIndicator, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { CATEGORIA_INSCRIPCION } from '../domain/enums'
import { buscarAlumnos, crearEmpresa, listarEmpresas } from '../services/dataService'

/**
 * Alumnos e inscripciones (9.5).
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
    render: (fila) => (
      <span>
        <span className="font-medium">{fila.comision.codigo}</span>{' '}
        <span className="text-slate-500">{fila.comision.nombre}</span>
      </span>
    ),
  },
  {
    clave: 'categoria',
    titulo: 'CATEGORÍA ARANCELARIA',
    render: (fila) => columnaCategoria(fila.categoria, fila.porcentaje_beca),
  },
  {
    clave: 'acceso',
    titulo: 'ACCESO PLATAFORMA',
    render: (fila) => <StatusIndicator estado={fila.acceso.estado} causa={fila.acceso.causa} />,
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

const EMPRESA_VACIA = { razon_social: '', cuit: '', requiere_factura_a: false }

export function StudentsPage() {
  const [alumnos, setAlumnos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [consulta, setConsulta] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [campos, setCampos] = useState(EMPRESA_VACIA)
  const [errores, setErrores] = useState({})
  const [fallo, setFallo] = useState(null)
  const [guardando, setGuardando] = useState(false)

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

  function cambiar(campo) {
    return (evento) =>
      setCampos((anteriores) => ({ ...anteriores, [campo]: evento.target.value }))
  }

  function cerrarModal() {
    setModalAbierto(false)
    setCampos(EMPRESA_VACIA)
    setErrores({})
    setFallo(null)
  }

  function validar() {
    const encontrados = {}

    if (campos.razon_social.trim() === '') {
      encontrados.razon_social = 'La razón social es obligatoria.'
    }
    if (campos.cuit.trim() === '') {
      encontrados.cuit = 'El CUIT es obligatorio.'
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
      const creada = await crearEmpresa({
        razon_social: campos.razon_social,
        cuit: campos.cuit,
        requiere_factura_a: campos.requiere_factura_a,
      })
      setEmpresas((anteriores) => [...anteriores, creada])
      cerrarModal()
    } catch (error) {
      // Un alta rechazada —duplicado, CUIT con dígito verificador inválido— deja el modal
      // abierto con lo que escribió la secretaría y el motivo tal como lo informa la fuente
      // (D36), que en el duplicado identifica la empresa existente.
      setFallo(error?.message ?? 'No se pudo guardar la empresa.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card titulo="Padrón de Alumnos Regulares">
        <div className="mb-4 max-w-sm">
          <Input
            id="buscar-alumno"
            etiqueta="Buscar alumno"
            valor={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
            placeholder="Buscar por DNI o Nombre…"
          />
        </div>

        <Table
          columnas={COLUMNAS_ALUMNOS}
          filas={alumnos}
          vacio={<p className="text-sm text-slate-500">No se encontraron resultados.</p>}
        />
      </Card>

      <Card
        titulo="Cuentas Corporativas Vinculadas"
        acciones={
          <Button variante="secundario" onClick={() => setModalAbierto(true)}>
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
        abierto={modalAbierto}
        titulo="Nueva Empresa"
        onClose={cerrarModal}
        pie={
          <>
            <Button variante="secundario" onClick={cerrarModal}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar Empresa'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Input
            id="empresa-razon-social"
            etiqueta="Razón Social"
            valor={campos.razon_social}
            onChange={cambiar('razon_social')}
            obligatorio
            error={errores.razon_social ?? null}
          />
          <Input
            id="empresa-cuit"
            etiqueta="CUIT"
            valor={campos.cuit}
            onChange={cambiar('cuit')}
            obligatorio
            error={errores.cuit ?? null}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              id="empresa-factura-a"
              type="checkbox"
              checked={campos.requiere_factura_a}
              onChange={(evento) =>
                setCampos((anteriores) => ({
                  ...anteriores,
                  requiere_factura_a: evento.target.checked,
                }))
              }
            />
            Requiere Factura A
          </label>
        </div>

        {fallo !== null && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {fallo}
          </p>
        )}
      </Modal>
    </div>
  )
}
