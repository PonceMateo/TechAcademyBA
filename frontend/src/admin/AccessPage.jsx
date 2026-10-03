import { useState } from 'react'
import { useSession } from '../auth/SessionContext'
import { Badge, Button, Card, Input, StatusIndicator } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import {
  buscarHabilitacion,
  forzarBloqueoManual,
  listarCobranzas,
  listarEmailsHabilitados,
} from '../services/dataService'
import { formatFechaCorta, formatMoneda } from '../utils/formato'

/**
 * Habilitación de accesos (9.7).
 *
 * **El motivo del forzado es obligatorio y el error va pegado a su campo.** La historia #27 pide
 * motivo, usuario y fecha de la operación; el prototipo ofrece el botón y ningún campo. Con el
 * motivo vacío no se confirma nada y se dice cuál es el campo que falta.
 *
 * **El estado forzado queda a la vista con el usuario y la fecha.** Forzar un bloqueo es dejar un
 * registro; un cartel de "listo" que desaparece al segundo no dice quién lo forzó ni cuándo.
 *
 * **La copia de correos filtra por acceso, no por categoría.** Copia los correos de los alumnos
 * habilitados de la comisión indicada y, cuando no hay ninguno, informa que no hay nada para
 * copiar en lugar de copiar una lista vacía. Agustina Benítez es becada parcial y está
 * bloqueada: su correo no va en la lista de CUR-101.
 */

const AYUDA_BUSQUEDA =
  'Buscá por DNI de alumno, Email institucional, CUIT de empresa o Razón Social.'

const TEXTO_HABILITADO = 'El alumno cumple con la condición arancelaria.'

const COMISION_DE_LA_COPIA = 'CUR-101'

/** Campos de la ficha resumen, en el orden del spec. */
const CAMPOS_FICHA = [
  { clave: 'documento', etiqueta: 'DNI / Documento' },
  { clave: 'nombre_completo', etiqueta: 'Nombre Completo' },
  { clave: 'email_registrado', etiqueta: 'Email Registrado' },
  { clave: 'curso_inscrito', etiqueta: 'Curso Inscrito' },
  { clave: 'categoria_arancelaria', etiqueta: 'Categoría Arancelaria' },
  { clave: 'ultimo_pago_imputado', etiqueta: 'Último Pago Imputado' },
]

const SIN_DOCUMENTO = 'Sin DNI (alumno exterior)'

function etiquetaCategoria(categoria, porcentajeBeca) {
  const nombres = {
    PARTICULAR: 'Particular',
    BECADO_PARCIAL: `Becado parcial ${porcentajeBeca}%`,
    BECADO_TOTAL: 'Becado total',
    CORPORATIVO: 'Corporativo',
  }

  return nombres[categoria] ?? categoria
}

/** Fecha de hoy en formato ISO, en hora local: es la fecha de la operación del override. */
function hoy() {
  const ahora = new Date()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${ahora.getFullYear()}-${mes}-${dia}`
}

export function AccessPage() {
  const { session } = useSession()
  const [consulta, setConsulta] = useState('')
  const [resultado, setResultado] = useState(null)
  const [ultimoPago, setUltimoPago] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [errorMotivo, setErrorMotivo] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [copiados, setCopiados] = useState(null)

  /**
   * El último pago imputado no está en el padrón (D10 lo deriva), así que se arma con el
   * historial: la ficha muestra lo que el modelo puede saber, que es el pago acreditado más
   * reciente de ese alumno.
   */
  async function ultimoPagoAcreditado(alumno) {
    const cobranzas = await listarCobranzas()
    const acreditado = cobranzas.find(
      (fila) =>
        fila.imputacion?.nombre === alumno.nombre && fila.estado === 'ACREDITADO' && fila.importe,
    )

    return acreditado === undefined
      ? 'Sin pagos acreditados'
      : `${formatFechaCorta(acreditado.fecha)} · ${formatMoneda(acreditado.importe)}`
  }

  async function consultar() {
    setAviso(null)
    setCopiados(null)
    setErrorMotivo(null)
    setMotivo('')

    const encontrado = await buscarHabilitacion(consulta)
    setResultado(encontrado)
    setUltimoPago(
      encontrado?.tipo === 'ALUMNO' ? await ultimoPagoAcreditado(encontrado.registro) : null,
    )
  }

  async function forzar() {
    if (resultado?.tipo !== 'ALUMNO') {
      setAviso('Primero consultá a un alumno: el forzado manual es sobre un alumno del padrón.')
      return
    }

    if (motivo.trim() === '') {
      setErrorMotivo('El motivo es obligatorio.')
      return
    }

    setErrorMotivo(null)
    const actualizado = await forzarBloqueoManual({
      alumnoId: resultado.registro.id,
      motivo,
      usuario: session.nombre,
      fechaOperacion: hoy(),
    })

    setResultado({ tipo: 'ALUMNO', registro: actualizado })
    setMotivo('')
    setAviso('Bloqueo forzado. Queda registrado con el usuario y la fecha de la operación.')
  }

  async function copiar() {
    const correos = await listarEmailsHabilitados(COMISION_DE_LA_COPIA)

    if (correos.length === 0) {
      setCopiados(null)
      setAviso(`No hay correos para copiar: ${COMISION_DE_LA_COPIA} no tiene alumnos habilitados.`)
      return
    }

    setCopiados(correos)
    setAviso(
      `Se copiaron los correos de los alumnos habilitados de ${COMISION_DE_LA_COPIA}. Los bloqueados no van en la lista.`,
    )

    // El portapapeles del navegador es un permiso que puede estar denegado. La lista queda
    // escrita en pantalla igual, así que la acción sirve aunque la copia no ocurra.
    try {
      await globalThis.navigator?.clipboard?.writeText(correos.join(', '))
    } catch {
      // Sin portapapeles no hay nada que avisar: el resultado ya está a la vista.
    }
  }

  const ficha = fichaDe(resultado, ultimoPago)

  return (
    <div className="space-y-4">
      <Card titulo="Buscador de Alumnos y Cuentas Corporativas">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-sm">
            <Input
              id="consulta-habilitacion"
              etiqueta="Buscar alumno o cuenta corporativa"
              valor={consulta}
              onChange={(evento) => setConsulta(evento.target.value)}
              placeholder="DNI, Email institucional, CUIT o Razón Social"
            />
          </div>
          <Button onClick={consultar}>Consultar Habilitación</Button>
        </div>

        <p className="mt-3 text-xs text-slate-500">{AYUDA_BUSQUEDA}</p>
      </Card>

      <Card titulo="Ficha Resumen del Alumno">
        {ficha === null ? (
          <p className="text-sm text-slate-500">
            Todavía no consultaste a nadie. Escribí un dato arriba y pulsá Consultar Habilitación.
          </p>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            {CAMPOS_FICHA.map((campo) => (
              <div key={campo.clave}>
                <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  {campo.etiqueta}
                </dt>
                <dd className="text-sm text-slate-800">{ficha[campo.clave]}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <Card titulo="Estado del Acceso">
        {resultado === null ? (
          <p className="text-sm text-slate-500">Sin consulta, no hay estado que mostrar.</p>
        ) : resultado.tipo === 'EMPRESA' ? (
          <p className="text-sm text-slate-600">
            La habilitación de una cuenta corporativa se deriva de sus cobranzas acreditadas y se
            revisa en la pantalla de cobranzas.
          </p>
        ) : (
          <StatusIndicator
            estado={resultado.registro.acceso.estado}
            causa={resultado.registro.acceso.causa}
            habilitadoTexto={TEXTO_HABILITADO}
          />
        )}

        {resultado?.registro?.acceso?.forzado !== undefined && (
          <p className="mt-3 text-xs text-slate-600">
            {`Bloqueo forzado por ${resultado.registro.acceso.forzado.usuario} el ${formatFechaCorta(resultado.registro.acceso.forzado.fecha_operacion)}. Motivo: ${resultado.registro.acceso.forzado.motivo}`}
          </p>
        )}
      </Card>

      <Card titulo="ACCIONES EXCEPCIONALES">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-md">
            <Input
              id="motivo"
              etiqueta="Motivo"
              valor={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              obligatorio
              error={errorMotivo}
            />
          </div>
          <Button variante="peligro" onClick={forzar}>
            Forzar Bloqueo Manual
          </Button>
          <Button variante="secundario" onClick={copiar}>
            {`Copiar emails habilitados de ${COMISION_DE_LA_COPIA}`}
          </Button>
        </div>

        {aviso !== null && (
          <p role="status" className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {aviso}
          </p>
        )}

        {copiados !== null && (
          <ul
            aria-label="Correos copiados"
            className="mt-3 space-y-1 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            {copiados.map((correo) => (
              <li key={correo}>{correo}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card titulo="Emisión de Certificados">
        {/* Fuera del alcance mínimo: se muestra el hueco, sin pantalla detrás (D20). */}
        <div className="flex items-center gap-2">
          <Button variante="secundario" disabled>
            Emitir certificados
          </Button>
          <Badge tono={TONO.GRIS}>Próximamente</Badge>
        </div>
      </Card>
    </div>
  )
}

function fichaDe(resultado, ultimoPago) {
  if (resultado === null) {
    return null
  }

  if (resultado.tipo === 'EMPRESA') {
    const empresa = resultado.registro

    return {
      documento: empresa.cuit,
      nombre_completo: empresa.razon_social,
      email_registrado: 'Sin email en el padrón de alumnos',
      curso_inscrito: 'Contrato corporativo',
      categoria_arancelaria: 'Corporativo',
      ultimo_pago_imputado: 'Ver historial de cobranzas',
    }
  }

  const alumno = resultado.registro

  return {
    documento: alumno.documento ?? SIN_DOCUMENTO,
    nombre_completo: alumno.nombre,
    email_registrado: alumno.email,
    curso_inscrito: `${alumno.comision.codigo} ${alumno.comision.nombre}`,
    categoria_arancelaria: etiquetaCategoria(alumno.categoria, alumno.porcentaje_beca),
    ultimo_pago_imputado: ultimoPago ?? 'Sin pagos acreditados',
  }
}
