import {
  ALUMNOS,
  CATALOGO_TOTAL_COMISIONES,
  COBRANZAS,
  COMISIONES,
  DESTINO_IMPUTACION,
  DOCENTES,
  EMPRESAS,
  SEDES,
} from '../mocks'
import { normalizeCode, normalizeCuit, normalizeDocumento } from '../domain/normalize'

/**
 * Implementación de ejemplo de la frontera de datos (D13).
 *
 * **Vive detrás del servicio, nunca al lado de la pantalla.** Los componentes no la importan: la
 * fábrica la elige y la expone por las mismas funciones asíncronas que va a exponer la
 * implementación real. Eso es lo que permite que cambiar de implementación no obligue a tocar ni
 * un componente.
 *
 * **Los datos salen de `src/mocks/` y no al revés.** El store se arma una vez por instancia desde
 * las colecciones congeladas de ejemplo y después se copia: registrar una cobranza agrega una fila
 * a la pantalla sin tocar el módulo de datos de ejemplo, que es lo único que no debería ensuciarse
 * con lo que hace un usuario.
 *
 * **Ninguna función calcula un agregado de negocio.** Filtra, ordena y devuelve. Las vacantes
 * vienen calculadas en el mock (D10) y el estado de habilitación viene por registro (D9).
 */

function copiar(registros) {
  return registros.map((registro) => ({ ...registro }))
}

function buscarPorTexto(registros, texto, campos) {
  const aguja = texto.trim().toLowerCase()

  if (aguja === '') {
    return registros
  }

  return registros.filter((registro) =>
    campos.some((campo) =>
      String(registro[campo] ?? '')
        .toLowerCase()
        .includes(aguja),
    ),
  )
}

export function createMockDataSource() {
  const store = {
    comisiones: copiar(COMISIONES),
    docentes: copiar(DOCENTES),
    alumnos: copiar(ALUMNOS),
    empresas: copiar(EMPRESAS),
    sedes: copiar(SEDES),
    cobranzas: copiar(COBRANZAS),
  }

  return {
    modo: 'mock',

    async listarComisiones() {
      return copiar(store.comisiones)
    },

    /**
     * Totales del catálogo del cliente. El chip `10 en el catálogo` y el indicador `COMISIONES`
     * del tablero muestran el mismo número, así que sale de acá y no de cada pantalla: si uno
     * midiera las cinco filas de ejemplo y el otro el total, se contradirían.
     */
    async obtenerResumenCatalogo() {
      return { total_comisiones: CATALOGO_TOTAL_COMISIONES }
    },

    async listarDocentes() {
      return copiar(store.docentes)
    },

    /** Búsqueda por nombre, apellido, DNI o email: lo que el buscador de la pantalla promete. */
    async buscarDocentes(texto) {
      return buscarPorTexto(store.docentes, texto, ['nombre', 'dni', 'email'])
    },

    async listarAlumnos() {
      return copiar(store.alumnos)
    },

    /** Búsqueda por DNI o nombre: es lo que promete el placeholder del buscador. */
    async buscarAlumnos(texto) {
      return buscarPorTexto(store.alumnos, texto, ['nombre', 'documento'])
    },

    async listarEmpresas() {
      return copiar(store.empresas)
    },

    async listarSedes() {
      return copiar(store.sedes)
    },

    async listarCobranzas() {
      return copiar(store.cobranzas)
    },

    /**
     * Consulta de habilitación: por DNI, email de alumno, CUIT o razón social. Es la búsqueda del
     * bloque `Buscador de Alumnos y Cuentas Corporativas`.
     *
     * Documento, email y CUIT se comparan enteros y el nombre o la razón social por fragmento: la
     * ayuda de la pantalla promete `Buscá por DNI de alumno, Email institucional, CUIT de empresa
     * o Razón Social.`, y `Banco Federal` tiene que encontrar a `Banco Federal (Capacitaciones)`
     * sin que quien busca tenga que escribir el paréntesis.
     */
    async buscarHabilitacion(consulta) {
      const aguja = String(consulta ?? '').trim()
      if (aguja === '') {
        return null
      }

      const documento = normalizeDocumento(aguja)
      const cuit = normalizeCuit(aguja)
      const codigo = normalizeCode(aguja)

      const alumno = store.alumnos.find(
        (candidato) =>
          normalizeDocumento(candidato.documento) === documento ||
          candidato.email.toLowerCase() === aguja.toLowerCase() ||
          normalizeCode(candidato.nombre).includes(codigo),
      )
      if (alumno) {
        return { tipo: 'ALUMNO', registro: { ...alumno } }
      }

      const empresa = store.empresas.find(
        (candidato) =>
          normalizeCuit(candidato.cuit) === cuit ||
          normalizeCode(candidato.razon_social).includes(codigo),
      )
      if (empresa) {
        return { tipo: 'EMPRESA', registro: { ...empresa } }
      }

      return null
    },

    /**
     * Alta manual de cobranza (historias #21 y #22). El pagador no se deduplica contra el padrón de
     * alumnos: puede ser un tercero o una empresa, y por eso `pagador` se lleva el nombre tal
     * cual vino. La imputación es de destino único (D7) y sale del alumno elegido.
     */
    async registrarCobranza(datos) {
      const id = store.cobranzas.length + 1
      const cobranza = {
        id,
        fecha: datos.fecha,
        pagador: { id, nombre: datos.titular },
        medio: datos.medio,
        factura: datos.facturaTipo,
        importe: Number(datos.importe),
        estado: datos.estado,
        causa: datos.estado === 'ACREDITADO' ? null : (datos.causa ?? ''),
        imputacion: datos.alumnoId
          ? {
              destino: DESTINO_IMPUTACION.ALUMNO,
              id: datos.alumnoId,
              nombre: store.alumnos.find((alumno) => alumno.id === datos.alumnoId)?.nombre ?? '',
            }
          : null,
        _ejemplo: true,
      }
      store.cobranzas.unshift(cobranza)
      return { ...cobranza }
    },

    /**
     * Forzado de bloqueo (historia #27): guarda el motivo con el usuario y la fecha de la
     * operación. El modelo no tiene columna de estado en la inscripción (D9): lo que se guarda es
     * el override, y el estado vuelve a derivarse.
     */
    async forzarBloqueoManual({ alumnoId, motivo, usuario, fechaOperacion }) {
      const alumno = store.alumnos.find((candidato) => candidato.id === alumnoId)
      if (alumno === undefined) {
        throw new Error('No hay un alumno con ese identificador en los datos de ejemplo.')
      }
      if (String(motivo ?? '').trim() === '') {
        throw new Error('El motivo es obligatorio.')
      }

      alumno.acceso = {
        estado: 'BLOQUEADO',
        causa: motivo.trim(),
        forzado: { usuario, fecha_operacion: fechaOperacion, motivo: motivo.trim() },
      }
      return { ...alumno }
    },

    /**
     * Correos de los alumnos habilitados de una comisión (acción `Copiar emails habilitados de
     * CUR-101`). Filtra por acceso y no por categoría: la regla es "habilitados", y un becado
     * bloqueado no entra.
     */
    async listarEmailsHabilitados(comisionCodigo) {
      const codigo = normalizeCode(comisionCodigo)

      return store.alumnos
        .filter(
          (alumno) =>
            normalizeCode(alumno.comision.codigo) === codigo &&
            alumno.acceso.estado === 'HABILITADO',
        )
        .map((alumno) => alumno.email)
    },
  }
}
