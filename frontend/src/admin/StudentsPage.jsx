import { useEffect, useState } from 'react'
import { Badge, Card, Input, StatusIndicator, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { CATEGORIA_INSCRIPCION, TIPO_FACTURA } from '../domain/enums'
import { buscarAlumnos, listarEmpresas } from '../services/dataService'

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
    render: (fila) => (
      <Badge tono={TONO.CELESTE}>{fila.preferencia_factura === TIPO_FACTURA.A ? 'A' : 'B'}</Badge>
    ),
  },
  { clave: 'nomina', titulo: 'NÓMINA DE EMPLEADOS', render: (fila) => fila.nomina_empleados },
]

export function StudentsPage() {
  const [alumnos, setAlumnos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [consulta, setConsulta] = useState('')

  useEffect(() => {
    // El filtro va al servicio, no sobre el arreglo ya cargado: el mismo criterio tiene que
    // servir cuando los datos vengan de la API y la consulta llegue al servidor.
    buscarAlumnos(consulta).then(setAlumnos)
  }, [consulta])

  useEffect(() => {
    listarEmpresas().then(setEmpresas)
  }, [])

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

      <Card titulo="Cuentas Corporativas Vinculadas">
        {/* El alta de cuenta corporativa vive en esta misma pantalla, no en una pantalla
            separada de empresas: es lo que dice el spec y evita un ítem de más. */}
        <Table columnas={COLUMNAS_EMPRESAS} filas={empresas} />
      </Card>
    </div>
  )
}
