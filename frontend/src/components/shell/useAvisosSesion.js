import { useEffect, useState } from 'react'
import { useSession } from '../../auth/SessionContext'
import {
  ESTADO_COMISION,
  ESTADO_COMPROBANTE_ALUMNO,
  ESTADO_HABILITACION,
} from '../../domain/enums'
import {
  listarComprobantesAlumno,
  listarInscripcionesAlumno,
  obtenerComisionesAsignadas,
  obtenerDashboardAdmin,
} from '../../services/dataService'

/**
 * Avisos de la campana del armazón, derivados de la misma fuente que los tableros.
 *
 * **La campana vive en el shell y no en cada pantalla.** Así el aviso no desaparece al cambiar de
 * sección y el mismo dato no se dibuja dos veces. El punto solo aparece cuando hay al menos un
 * aviso: una campana vacía no tiene por qué llamar la atención.
 */
function avisosDeAdmin(datos) {
  const indicadores = datos?.indicadores
  const avisos = []

  if ((indicadores?.comprobantes_pendientes ?? 0) > 0) {
    avisos.push({
      texto: 'Comprobantes sin revisar',
      detalle: 'Esperan la revisión de Secretaría.',
      cantidad: indicadores.comprobantes_pendientes,
      ruta: '/admin/cobranzas',
    })
  }

  if ((indicadores?.cobranzas_observadas ?? 0) > 0) {
    avisos.push({
      texto: 'Cobranzas observadas',
      detalle: 'Tienen una causa pendiente de resolver.',
      cantidad: indicadores.cobranzas_observadas,
      ruta: '/admin/cobranzas',
    })
  }

  return avisos
}

function avisosDeDocente(comisiones) {
  const bloqueados = comisiones
    .filter((comision) => comision.estado !== ESTADO_COMISION.FINALIZADA)
    .reduce((total, comision) => total + comision.bloqueados, 0)
  const avisos = []

  if (bloqueados > 0) {
    avisos.push({
      texto: 'Alumnos bloqueados',
      detalle: 'Revisá el acceso en el padrón de tus comisiones.',
      cantidad: bloqueados,
      ruta: '/docente/alumnos',
    })
  }

  return avisos
}

async function avisosDeAlumno() {
  const [inscripciones, comprobantes] = await Promise.all([
    listarInscripcionesAlumno(),
    listarComprobantesAlumno(),
  ])
  const bloqueada = inscripciones.find(
    (inscripcion) => inscripcion.acceso.estado === ESTADO_HABILITACION.BLOQUEADO,
  )
  const observados = comprobantes.filter(
    (comprobante) => comprobante.estado === ESTADO_COMPROBANTE_ALUMNO.OBSERVADO,
  )
  const avisos = []

  if (bloqueada !== undefined) {
    avisos.push({
      texto: 'Tu acceso está bloqueado',
      detalle: `Causa: ${bloqueada.acceso.causa}`,
      cantidad: 1,
      ruta: '/alumno/pagos',
    })
  }

  if (observados.length > 0) {
    avisos.push({
      texto: 'Tenés un comprobante observado',
      detalle: 'Revisá el motivo y reenviá el comprobante desde Mis Pagos.',
      cantidad: observados.length,
      ruta: '/alumno/pagos',
    })
  }

  return avisos
}

async function cargarAvisos(rol) {
  if (rol === 'ADMIN') {
    return avisosDeAdmin(await obtenerDashboardAdmin())
  }
  if (rol === 'DOCENTE') {
    return avisosDeDocente(await obtenerComisionesAsignadas())
  }
  if (rol === 'ALUMNO') {
    return avisosDeAlumno()
  }
  return []
}

export function useAvisosSesion() {
  const { session } = useSession()
  const rol = session?.rol
  const [estado, setEstado] = useState({
    rol,
    avisos: [],
    cargando: true,
    fallo: false,
  })

  useEffect(() => {
    let vigente = true

    cargarAvisos(rol)
      .then((avisos) => {
        if (vigente) {
          setEstado({ rol, avisos, cargando: false, fallo: false })
        }
      })
      .catch(() => {
        if (vigente) {
          setEstado({ rol, avisos: [], cargando: false, fallo: true })
        }
      })

    return () => {
      vigente = false
    }
  }, [rol])

  return estado.rol === rol ? estado : { avisos: [], cargando: true, fallo: false }
}
