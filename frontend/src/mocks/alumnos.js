import { CATEGORIA_INSCRIPCION, ESTADO_HABILITACION, TIPO_DOCUMENTO } from '../domain/enums'
import { markAsExample } from './placeholderNotice'

/**
 * Padrón de alumnos (datos de ejemplo, D22).
 *
 * El acceso a la plataforma va como `acceso: { estado, causa }` y no como una columna: D9 saca la
 * columna de estado de habilitación de la inscripción, porque lo que se guarda es la situación
 * arancelaria y, cuando hay, el override. Lo que la pantalla muestra es el resultado derivado con
 * la causa al lado cuando está bloqueado, que es justo lo que el prototipo nunca muestra.
 *
 * Las dos categorías BECADO PARCIAL llevan `porcentaje_beca: 50`: es el porcentaje de descuento que
 * el cliente registra, y ese campo existe solo para esa categoría (CHECK
 * `porcentaje_beca_solo_para_becado_parcial`).
 *
 * `CUR-102` y `CUR-106` aparecen como comisión de alumnos pero no están en `comisiones.js`: el
 * spec obliga a mostrar cinco comisiones y son un subconjunto de las diez del cliente. La
 * referencia va desnormalizada a propósito, como la devolvería el padrón.
 */
export const ALUMNOS = markAsExample([
  {
    id: 1,
    nombre: 'Juan Ignacio Pérez',
    documento: '38.456.789',
    tipo_documento: TIPO_DOCUMENTO.DNI,
    email: 'juan.perez@gmail.com',
    comision: { codigo: 'CUR-101', nombre: 'Python Inicial' },
    categoria: CATEGORIA_INSCRIPCION.PARTICULAR,
    porcentaje_beca: null,
    acceso: { estado: ESTADO_HABILITACION.HABILITADO, causa: null },
  },
  {
    id: 2,
    nombre: 'Camila Rodríguez',
    documento: '40.112.233',
    tipo_documento: TIPO_DOCUMENTO.DNI,
    email: 'cami_rod@hotmail.com',
    // Es la única alumna con teléfono, y es a propósito: el perfil del alumno muestra `Email` y
    // `Teléfono` como los dos campos editables, y la planilla del cliente solo tiene el teléfono de
    // ella. Para los demás no se inventa uno.
    telefono: '011 4788-1122',
    comision: { codigo: 'CUR-102', nombre: 'Desarrollo Web Full Stack' },
    categoria: CATEGORIA_INSCRIPCION.BECADO_PARCIAL,
    porcentaje_beca: 50,
    acceso: { estado: ESTADO_HABILITACION.HABILITADO, causa: null },
  },
  {
    id: 3,
    nombre: 'Matías Fernández',
    documento: '39.887.665',
    tipo_documento: TIPO_DOCUMENTO.DNI,
    email: 'mati.fdez@yahoo.com.ar',
    comision: { codigo: 'CUR-104', nombre: 'Diseño UX/UI Avanzado' },
    categoria: CATEGORIA_INSCRIPCION.PARTICULAR,
    porcentaje_beca: null,
    acceso: { estado: ESTADO_HABILITACION.HABILITADO, causa: null },
  },
  {
    // D30: el alumno del exterior entra sin documento. El padrón no lo obliga —el CHECK
    // `documento_y_tipo_juntos` admite los dos nulos—, así que acá va nulo y la pantalla muestra
    // el texto que el cliente escribe en la planilla en lugar de inventar un número.
    id: 4,
    nombre: 'Nicolás Castro',
    documento: null,
    tipo_documento: null,
    email: 'nicocastro_uy@gmail.com',
    comision: { codigo: 'CUR-106', nombre: 'Machine Learning Aplicado' },
    categoria: CATEGORIA_INSCRIPCION.PARTICULAR,
    porcentaje_beca: null,
    acceso: { estado: ESTADO_HABILITACION.HABILITADO, causa: null },
  },
  {
    // La celda vacía de la planilla. El estado guardado decía "no pagó"; el motivo real es que
    // mandó un comprobante borroso que no se lee. Queda bloqueado con la causa, no sin ella.
    id: 5,
    nombre: 'Agustina Benítez',
    documento: '41.332.114',
    tipo_documento: TIPO_DOCUMENTO.DNI,
    email: 'agus.benitez@gmail.com',
    comision: { codigo: 'CUR-101', nombre: 'Python Inicial' },
    categoria: CATEGORIA_INSCRIPCION.BECADO_PARCIAL,
    porcentaje_beca: 50,
    acceso: { estado: ESTADO_HABILITACION.BLOQUEADO, causa: 'comprobante ilegible' },
  },
  {
    // Dejó una seña de $26.000 sobre un arancel de $52.000: debe la mitad.
    id: 6,
    nombre: 'Valeria Rossi',
    documento: '36.778.990',
    tipo_documento: TIPO_DOCUMENTO.DNI,
    email: 'valerossi@gmail.com',
    comision: { codigo: 'CUR-104', nombre: 'Diseño UX/UI Avanzado' },
    categoria: CATEGORIA_INSCRIPCION.PARTICULAR,
    porcentaje_beca: null,
    acceso: { estado: ESTADO_HABILITACION.BLOQUEADO, causa: 'debe saldo' },
  },
])
