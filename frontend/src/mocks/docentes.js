import { markAsExample } from './placeholderNotice'

/**
 * Padrón de docentes (datos de ejemplo, D22).
 *
 * **El CUIL va porque la columna existe** (D27 la agregó, D33 la volvió opcional): sin CUIL un
 * docente no se puede liquidar, así que el modelo la conserva aunque la planilla del cliente no
 * la tenga. El ejemplo la carga en las cinco filas para que la columna no se vea siempre vacía; el
 * alta real no lo pide. El dígito verificador no se valida en el modelo todavía (decisión
 * pendiente P7), así que estos valores son de ejemplo y no tienen por qué pasar esa validación.
 *
 * `comisiones_asignadas` es el conteo que el cliente registra, no un cálculo sobre las comisiones
 * del maquetado: el padrón del cliente cubre diez comisiones y `comisiones.js` muestra cinco, así
 * que derivarlo de esas cinco daría un número distinto al que el cliente reconoce.
 *
 * El estado va como `activo` y no como texto: el modelo hace baja lógica con un booleano y no
 * tiene columna de estado de docente. La columna `ESTADO` de la pantalla muestra el literal
 * `Activa` cuando `activo` es verdadero.
 */
export const DOCENTES = markAsExample([
  {
    id: 1,
    nombre: 'Profe Martín',
    dni: '28.114.402',
    cuil: '20-28114402-4',
    email: 'profe.martin@techacademy.invalid',
    telefono: '+54 11 4455-1020',
    catedra: 'Programación',
    comisiones_asignadas: 1,
    activo: true,
  },
  {
    id: 2,
    nombre: 'Lic. Laura Benítez',
    dni: '31.902.118',
    cuil: '27-31902118-6',
    email: 'laura.benitez@techacademy.invalid',
    telefono: '+54 11 5566-2310',
    catedra: 'Desarrollo Web',
    comisiones_asignadas: 1,
    activo: true,
  },
  {
    id: 3,
    nombre: 'Santi Ads',
    dni: '33.450.771',
    cuil: '20-33450771-8',
    email: 'santi.ads@techacademy.invalid',
    telefono: '+54 11 6677-8890',
    catedra: 'Marketing',
    comisiones_asignadas: 2,
    activo: true,
  },
  {
    id: 4,
    nombre: 'Dr. Marcelo Ríos',
    dni: '26.771.905',
    cuil: '23-26771905-5',
    email: 'marcelo.rios@techacademy.invalid',
    telefono: '+54 11 3322-7745',
    catedra: 'Datos',
    comisiones_asignadas: 1,
    activo: true,
  },
  {
    id: 5,
    nombre: 'Ing. González',
    dni: '30.665.330',
    cuil: '20-30665330-2',
    email: 'gonzalez@techacademy.invalid',
    telefono: '+54 11 7788-1120',
    catedra: 'Programación',
    comisiones_asignadas: 1,
    activo: true,
  },
])
