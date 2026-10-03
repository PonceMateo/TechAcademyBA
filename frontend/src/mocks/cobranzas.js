import { ESTADO_COBRANZA, MEDIO_PAGO, TIPO_FACTURA } from '../domain/enums'
import { markAsExample } from './placeholderNotice'

/**
 * Historial de cobranzas (datos de ejemplo, D22).
 *
 * **El estado es el del dominio, no el texto de la planilla** (D23): la columna se llama
 * `ESTADO GESTIÓN` y sus valores son `ACREDITADO`, `OBSERVADO` y `RECHAZADO`. "Pendiente de
 * acreditación" y "En duda" de la planilla mapean a `OBSERVADO`.
 *
 * **La causa va cuando el comprobante no está acreditado** (D28) y es obligatoria en el modelo
 * con el CHECK `causa_obligatoria_si_no_acreditado`. Las tres filas observadas de abajo son los
 * casos que el cliente tiene sin resolver y el maquetado los muestra sin limpiarlos.
 *
 * `imputacion` es de destino único (D7) y puede no existir: el cheque de Banco Federal sigue
 * pendiente de acreditación y todavía no tiene a quién imputarse. Lleva el nombre ya resuelto
 * porque es lo que la columna muestra y porque la lectura del historial devuelve la fila armada,
 * no un id que la pantalla tenga que cruzar con otro listado.
 *
 * `importe` de la fila del 19/05/2026 es `null`: el comprobante llegó ilegible y el número nunca
 * pudo leerse. El modelo exige `importe > 0` para una cobranza registrada, así que el día que la
 * pantalla registre comprobantes de verdad esa fila no se puede crear: hay que leer el importe
 * primero. Es una decisión pendiente, anotada en `docs/decisions.md`.
 */
export const COBRANZAS = markAsExample([
  {
    id: 1,
    fecha: '2026-05-10',
    pagador: { id: 1, nombre: 'Juan Ignacio Pérez' },
    medio: MEDIO_PAGO.TRANSFERENCIA,
    factura: TIPO_FACTURA.B,
    importe: 45000,
    estado: ESTADO_COBRANZA.ACREDITADO,
    causa: null,
    imputacion: { destino: 'ALUMNO', id: 1, nombre: 'Juan Ignacio Pérez' },
  },
  {
    // El pago dividido: es becada parcial 50% y abona la mitad del arancel, y aun así queda
    // acreditado.
    id: 2,
    fecha: '2026-05-11',
    pagador: { id: 2, nombre: 'Camila Rodríguez' },
    medio: MEDIO_PAGO.TRANSFERENCIA,
    factura: TIPO_FACTURA.B,
    importe: 31000,
    estado: ESTADO_COBRANZA.ACREDITADO,
    causa: null,
    imputacion: { destino: 'ALUMNO', id: 2, nombre: 'Camila Rodríguez' },
  },
  {
    // La empresa que paga: el comprobante va a nombre de la empresa y la imputación cae sobre el
    // contrato, no sobre un alumno. La pantalla lo muestra en la misma columna y por eso queda
    // claro que el beneficiario no es un alumno del padrón.
    id: 3,
    fecha: '2026-05-12',
    pagador: { id: 3, nombre: 'Tech Solutions S.A.' },
    medio: MEDIO_PAGO.TRANSFERENCIA,
    factura: TIPO_FACTURA.A,
    importe: 240000,
    estado: ESTADO_COBRANZA.ACREDITADO,
    causa: null,
    imputacion: { destino: 'EMPRESA', id: 1, nombre: 'Tech Solutions S.A.' },
  },
  {
    // El cheque que no acreditó, y además la empresa todavía no mandó la nómina de sus empleados.
    id: 4,
    fecha: '2026-05-16',
    pagador: { id: 4, nombre: 'Banco Federal' },
    medio: MEDIO_PAGO.CHEQUE,
    factura: TIPO_FACTURA.A,
    importe: 390000,
    estado: ESTADO_COBRANZA.OBSERVADO,
    causa: 'cheque pendiente de acreditación',
    imputacion: null,
  },
  {
    // El pagador que no es el alumno: el comprobante lo envió un familiar de Agustina Benítez y
    // llegó ilegible, así que el titular es un tercero, el alumno imputado es Agustina y el
    // importe no se pudo leer.
    id: 5,
    fecha: '2026-05-19',
    pagador: { id: 5, nombre: 'Familiar de Agustina Benítez' },
    medio: MEDIO_PAGO.TRANSFERENCIA,
    factura: TIPO_FACTURA.B,
    importe: null,
    estado: ESTADO_COBRANZA.OBSERVADO,
    causa: 'comprobante ilegible',
    imputacion: { destino: 'ALUMNO', id: 5, nombre: 'Agustina Benítez' },
  },
  {
    // La seña: debe la mitad del arancel.
    id: 6,
    fecha: '2026-05-21',
    pagador: { id: 6, nombre: 'Valeria Rossi' },
    medio: MEDIO_PAGO.EFECTIVO,
    factura: TIPO_FACTURA.B,
    importe: 26000,
    estado: ESTADO_COBRANZA.OBSERVADO,
    causa: 'debe saldo',
    imputacion: { destino: 'ALUMNO', id: 6, nombre: 'Valeria Rossi' },
  },
])

/** Destinos posibles de una imputación (D7: destino único, y puede no haber imputación). */
export const DESTINO_IMPUTACION = Object.freeze({
  ALUMNO: 'ALUMNO',
  EMPRESA: 'EMPRESA',
})
