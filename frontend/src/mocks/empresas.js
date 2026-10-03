import { TIPO_FACTURA } from '../domain/enums'
import { markAsExample } from './placeholderNotice'

/**
 * Cuentas corporativas (datos de ejemplo, D22).
 *
 * `nomina_empleados` es texto y no una lista: el maquetado necesita mostrar lo que el cliente
 * escribió —"falta enviar la nómina", "segunda tanda de empleados"— y una lista de empleados
 * obligaría a inventar nombres. Cuando la historia #19 se implemente, la nómina pasa a ser la
 * tabla `nomina_empleado` con su contrato (D26) y esta columna se queda con el resumen.
 *
 * El CUIT va con guiones porque así lo registra la planilla; el modelo guarda además el
 * normalizado a once dígitos en `cuit_norm`, que es el que tiene el índice único (D6).
 */
export const EMPRESAS = markAsExample([
  {
    id: 1,
    razon_social: 'Tech Solutions S.A.',
    cuit: '30-71665544-9',
    cuit_norm: '30716655449',
    preferencia_factura: TIPO_FACTURA.A,
    requiere_factura_a: true,
    nomina_empleados:
      'Grupo 5 (Data Analytics) y Grupo 2 (Python Inicial), segunda tanda de empleados',
  },
  {
    id: 2,
    razon_social: 'Banco Federal (Capacitaciones)',
    cuit: '30-50001234-4',
    cuit_norm: '30500012344',
    preferencia_factura: TIPO_FACTURA.A,
    requiere_factura_a: true,
    nomina_empleados: '10 personas, falta enviar la nómina',
  },
])
