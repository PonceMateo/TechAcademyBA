import { describe, expect, it } from 'vitest'
import {
  CATEGORIA_INSCRIPCION,
  ESTADO_COBRANZA,
  ESTADO_HABILITACION,
  MEDIO_PAGO,
  TIPO_FACTURA,
} from '../domain/enums'
import { normalizeCode, normalizeCuit, normalizeDocumento } from '../domain/normalize'
import {
  ALUMNOS,
  CATALOGO_TOTAL_COMISIONES,
  COBRANZAS,
  COMISIONES,
  DOCENTES,
  EMPRESAS,
  IS_PLACEHOLDER_DATA,
  PLACEHOLDER_DATA_NOTICE,
  SEDES,
} from './index'

/**
 * Datos de ejemplo (8.1).
 *
 * Lo que se verifica acá no es que los datos sean lindos, sino tres cosas que se rompen solas:
 * que estén marcados como ejemplo (D22), que el catálogo no tenga dos filas que la base real no
 * aceptaría por código normalizado (D6), y que los estados y categorías sean los del enum del
 * dominio y no rótulos de la planilla del cliente (D23).
 */

const TODAS_LAS_COLECCIONES = { COMISIONES, DOCENTES, ALUMNOS, EMPRESAS, COBRANZAS, SEDES }

describe('marcado como dato de ejemplo', () => {
  it('declara que el módulo es de datos de ejemplo y lo dice', () => {
    expect(IS_PLACEHOLDER_DATA).toBe(true)
    expect(PLACEHOLDER_DATA_NOTICE).toContain('Datos de ejemplo')
    expect(PLACEHOLDER_DATA_NOTICE).toContain('No son datos reales')
  })

  it('sella cada registro de cada colección con el sello de ejemplo', () => {
    for (const [nombre, registros] of Object.entries(TODAS_LAS_COLECCIONES)) {
      expect(registros.length, `${nombre} no tiene registros`).toBeGreaterThan(0)
      for (const registro of registros) {
        expect(registro._ejemplo, `${nombre} tiene un registro sin sello`).toBe(true)
      }
    }
  })

  it('no deja registros mutables a mano: el ejemplo se cambia en un solo lugar', () => {
    for (const registros of Object.values(TODAS_LAS_COLECCIONES)) {
      expect(Object.isFrozen(registros)).toBe(true)
      for (const registro of registros) {
        expect(Object.isFrozen(registro)).toBe(true)
      }
    }
  })
})

describe('catálogo de comisiones', () => {
  it('no repite ninguna fila por código normalizado', () => {
    const normalizados = COMISIONES.map((comision) => normalizeCode(comision.codigo))

    expect(new Set(normalizados).size).toBe(normalizados.length)
  })

  /**
   * El chip `10 en el catálogo` muestra el total del cliente, no la cantidad de filas del
   * maquetado: las cinco filas son un subconjunto y completar el catálogo está prohibido.
   */
  it('deja el total del catálogo del cliente aparte de las filas de ejemplo', () => {
    expect(CATALOGO_TOTAL_COMISIONES).toBe(10)
    expect(COMISIONES).toHaveLength(5)
    expect(CATALOGO_TOTAL_COMISIONES).toBeGreaterThan(COMISIONES.length)
  })

  it('no repite curso por nombre normalizado', () => {
    const nombres = COMISIONES.map((comision) => normalizeCode(comision.curso.nombre))

    expect(new Set(nombres).size).toBe(nombres.length)
  })

  it('no repite documento, CUIL ni email entre docentes', () => {
    expect(new Set(DOCENTES.map((d) => normalizeDocumento(d.dni))).size).toBe(DOCENTES.length)
    expect(new Set(DOCENTES.map((d) => normalizeCuit(d.cuil))).size).toBe(DOCENTES.length)
    expect(new Set(DOCENTES.map((d) => d.email)).size).toBe(DOCENTES.length)
  })

  it('tiene a todos los docentes con CUIL, aunque el modelo ya no lo exige (D33)', () => {
    for (const docente of DOCENTES) {
      expect(docente.cuil).toBeTruthy()
      expect(docente.dni).toBeTruthy()
      expect(docente.email).toBeTruthy()
      expect(docente.telefono).toBeTruthy()
    }
  })

  it('no repite documento entre los alumnos que tienen documento', () => {
    const conDocumento = ALUMNOS.filter((alumno) => alumno.documento !== null)

    expect(conDocumento.length).toBeGreaterThan(0)
    const normalizados = conDocumento.map((alumno) => normalizeDocumento(alumno.documento))
    expect(new Set(normalizados).size).toBe(normalizados.length)
  })

  it('no repite CUIT entre empresas', () => {
    const normalizados = EMPRESAS.map((empresa) => normalizeCuit(empresa.cuit))

    expect(new Set(normalizados).size).toBe(normalizados.length)
    for (const empresa of EMPRESAS) {
      expect(normalizados).toContain(empresa.cuit_norm)
    }
  })

  /**
   * El `27%` del tablero es texto fijo, pero tiene que ser coherente con el catálogo: 160
   * lugares, 43 ocupados, 117 vacantes. Si alguien cambia una fila del ejemplo y el tablero
   * queda diciendo otra cosa, este test lo dice.
   */
  it('sostiene los números fijos del tablero', () => {
    const cupoTotal = COMISIONES.reduce((total, c) => total + c.cupo_maximo, 0)
    const ocupados = COMISIONES.reduce((total, c) => total + c.inscriptos, 0)
    const vacantes = COMISIONES.reduce((total, c) => total + c.vacantes, 0)

    expect(cupoTotal).toBe(160)
    expect(ocupados).toBe(43)
    expect(vacantes).toBe(117)
    expect(Math.round((ocupados / cupoTotal) * 100)).toBe(27)
  })

  it('deja la sola comisión cerrada por cupo como la que no tiene vacantes', () => {
    const cerradas = COMISIONES.filter((comision) => comision.vacantes === 0)

    expect(cerradas.map((comision) => comision.codigo)).toEqual(['CUR-104'])
    expect(cerradas[0].cerrada_por_cupo).toBe(true)
  })

  it('deja la vacantes como el cupo menos los inscriptos, nunca una columna guardada', () => {
    for (const comision of COMISIONES) {
      expect(comision.vacantes).toBe(comision.cupo_maximo - comision.inscriptos)
      expect(comision).not.toHaveProperty('estado')
    }
  })

  it('deja toda comisión presencial con sede, como la exige el CHECK del modelo', () => {
    for (const comision of COMISIONES) {
      if (comision.modalidad !== 'VIRTUAL') {
        expect(comision.sede_id).not.toBeNull()
        expect(SEDES.some((sede) => sede.id === comision.sede_id)).toBe(true)
      }
    }
  })
})

describe('categorías arancelarias y estado de acceso', () => {
  it('usa solo categorías del enum del dominio', () => {
    const permitidas = new Set(Object.values(CATEGORIA_INSCRIPCION))

    for (const alumno of ALUMNOS) {
      expect(permitidas).toContain(alumno.categoria)
    }
  })

  it('deja el porcentaje de beca solo en la categoría que lo tiene', () => {
    for (const alumno of ALUMNOS) {
      if (alumno.categoria === CATEGORIA_INSCRIPCION.BECADO_PARCIAL) {
        expect(alumno.porcentaje_beca).toBeGreaterThan(0)
        expect(alumno.porcentaje_beca).toBeLessThan(100)
      } else {
        expect(alumno.porcentaje_beca).toBeNull()
      }
    }
  })

  it('deja el acceso con estado y, cuando está bloqueado, con causa', () => {
    for (const alumno of ALUMNOS) {
      expect(Object.values(ESTADO_HABILITACION)).toContain(alumno.acceso.estado)
      if (alumno.acceso.estado === ESTADO_HABILITACION.BLOQUEADO) {
        expect(alumno.acceso.causa).toBeTruthy()
      } else {
        expect(alumno.acceso.causa).toBeNull()
      }
    }
  })
})

describe('cobranzas', () => {
  it('usa el estado de cobranza del dominio y no el texto de la planilla', () => {
    const permitidos = new Set(Object.values(ESTADO_COBRANZA))

    for (const cobranza of COBRANZAS) {
      expect(permitidos).toContain(cobranza.estado)
    }
  })

  it('deja la causa obligatoria cuando el comprobante no está acreditado', () => {
    for (const cobranza of COBRANZAS) {
      if (cobranza.estado !== ESTADO_COBRANZA.ACREDITADO) {
        expect(cobranza.causa).toBeTruthy()
      } else {
        expect(cobranza.causa).toBeNull()
      }
    }
  })

  it('usa el enum de medio de pago y el de tipo de factura', () => {
    const medios = new Set(Object.values(MEDIO_PAGO))
    const facturas = new Set(Object.values(TIPO_FACTURA))

    for (const cobranza of COBRANZAS) {
      expect(medios).toContain(cobranza.medio)
      expect(facturas).toContain(cobranza.factura)
    }
  })

  it('deja una sola imputación por cobranza, y la puede no tener', () => {
    const conImputacion = COBRANZAS.filter((cobranza) => cobranza.imputacion !== null)

    expect(conImputacion.length).toBeGreaterThan(0)
    for (const cobranza of conImputacion) {
      expect(['ALUMNO', 'EMPRESA']).toContain(cobranza.imputacion.destino)
    }
  })

  it('deja el caso del pagador distinto del alumno imputado', () => {
    const cobranza = COBRANZAS.find((c) => c.id === 5)

    expect(cobranza.pagador.nombre).not.toBe(cobranza.imputacion.nombre)
    expect(cobranza.imputacion.nombre).toBe('Agustina Benítez')
    expect(cobranza.importe).toBeNull()
    expect(cobranza.estado).toBe(ESTADO_COBRANZA.OBSERVADO)
  })

  it('deja el cheque pendiente de acreditación sin alumno imputado', () => {
    const cobranza = COBRANZAS.find((c) => c.id === 4)

    expect(cobranza.imputacion).toBeNull()
    expect(cobranza.estado).toBe(ESTADO_COBRANZA.OBSERVADO)
  })
})
