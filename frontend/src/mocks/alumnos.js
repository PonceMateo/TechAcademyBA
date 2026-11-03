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
 * referencia va desnormalizada a propósito, como la devolvería el padrón. Por eso cada alumno lleva
 * también el `arancel` de su inscripción: la ficha de la HU 61 deriva el saldo de la inscripción con
 * ese arancel, y el catálogo de ejemplo no tiene esas dos comisiones para consultarlo.
 */
export const ALUMNOS = markAsExample([
  {
    id: 1,
    nombre: 'Juan Ignacio Pérez',
    documento: '38.456.789',
    tipo_documento: TIPO_DOCUMENTO.DNI,
    email: 'juan.perez@gmail.com',
    comision: { codigo: 'CUR-101', nombre: 'Python Inicial' },
    arancel: 45000,
    categoria: CATEGORIA_INSCRIPCION.PARTICULAR,
    porcentaje_beca: null,
    acceso: { estado: ESTADO_HABILITACION.HABILITADO, causa: null },
    // HU 64: el mismo alumno está cubierto por el paquete de una empresa en un curso y cursa otro
    // por su cuenta. La categoría, la beca y el acceso son de cada inscripción, no del alumno; los
    // campos de arriba describen la inscripción principal para las pantallas que ya la mostraban.
    inscripciones: [
      {
        id: 11,
        estado: 'ACTIVA',
        comision: { codigo: 'CUR-101', nombre: 'Python Inicial' },
        arancel: 45000,
        importe_arancel: 40000,
        categoria: CATEGORIA_INSCRIPCION.PARTICULAR,
        porcentaje_beca: null,
        empresa: null,
        acceso: { estado: ESTADO_HABILITACION.HABILITADO, causa: null },
      },
      {
        id: 12,
        estado: 'ACTIVA',
        comision: { codigo: 'CUR-106', nombre: 'Machine Learning Aplicado' },
        arancel: 52000,
        categoria: CATEGORIA_INSCRIPCION.CORPORATIVO,
        porcentaje_beca: null,
        empresa: { id: 1, razon_social: 'Tech Solutions S.A.' },
        acceso: { estado: ESTADO_HABILITACION.HABILITADO, causa: null },
      },
    ],
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
    arancel: 52000,
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
    arancel: 52000,
    // Matías cubre el caso de la beca total: la comisión tiene arancel, pero la inscripción está
    // exenta y no debe saldo.
    categoria: CATEGORIA_INSCRIPCION.BECADO_TOTAL,
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
    arancel: 52000,
    categoria: CATEGORIA_INSCRIPCION.PARTICULAR,
    porcentaje_beca: null,
    acceso: { estado: ESTADO_HABILITACION.HABILITADO, causa: null },
    // HU 64: cursada terminada, sin inscripción activa. La consulta de accesos no tiene nada que
    // habilitar y lo dice; el detalle del alumno la conserva con su estado.
    inscripciones: [
      {
        id: 41,
        estado: 'FINALIZADA',
        comision: { codigo: 'CUR-106', nombre: 'Machine Learning Aplicado' },
        arancel: 52000,
        categoria: CATEGORIA_INSCRIPCION.PARTICULAR,
        porcentaje_beca: null,
        empresa: null,
        acceso: null,
      },
    ],
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
    arancel: 45000,
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
    arancel: 52000,
    categoria: CATEGORIA_INSCRIPCION.PARTICULAR,
    porcentaje_beca: null,
    acceso: { estado: ESTADO_HABILITACION.BLOQUEADO, causa: 'debe saldo' },
  },
])
