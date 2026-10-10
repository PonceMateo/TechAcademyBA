/**
 * Colores de los estados y las categorías (D20 y el spec de `admin-shell`).
 *
 * **Viven acá y no en el modelo.** El enum del dominio dice qué estados existen; el color con el
 * que se muestran es cosa de la interfaz. Si estuvieran juntos, cambiar un color parecería un
 * cambio de dominio, y nadie lo aprobaría como tal.
 *
 * Los nombres de tono son los que el spec nombra: verde, rojo, ámbar, gris, violeta, magenta y
 * celeste. Cada componente traduce el tono a clases de Tailwind en un solo lugar, así agregar un
 * estado es agregar una entrada y no buscar colores sueltos por los archivos.
 */
export const TONO = Object.freeze({
  VERDE: 'verde',
  ROJO: 'rojo',
  AMBAR: 'ambar',
  GRIS: 'gris',
  VIOLETA: 'violeta',
  MAGENTA: 'magenta',
  CELESTE: 'celeste',
  // El acento del shell de Docente. Los specs lo llaman `verde` (change
  // `ui-figma-dashboards`, D40): es el verde de Figma `#26836b`, que en la paleta de Tailwind
  // cae en `emerald`. El nombre del tono es el del spec, no el de la clase.
  ESMERALDA: 'esmeralda',
  // El acento del shell de Alumno. El spec lo llama `dorado` y es el dorado de Figma
  // `#d0a52c`, que en Tailwind cae en `yellow`. Reemplaza al terracota de la versión anterior
  // del diseño.
  DORADO: 'dorado',
})

export const CLASES_BADGE = Object.freeze({
  [TONO.VERDE]: 'bg-green-100 text-green-800 ring-green-600/20',
  [TONO.ROJO]: 'bg-red-100 text-red-800 ring-red-600/20',
  [TONO.AMBAR]: 'bg-amber-100 text-amber-900 ring-amber-600/20',
  [TONO.GRIS]: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  [TONO.VIOLETA]: 'bg-violet-100 text-violet-800 ring-violet-600/20',
  [TONO.MAGENTA]: 'bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-600/20',
  [TONO.CELESTE]: 'bg-sky-100 text-sky-800 ring-sky-600/20',
  [TONO.ESMERALDA]: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  // El dorado sobre blanco necesita la variante oscura del texto para pasar el contraste
  // (D6): `yellow-900` sobre `yellow-100` está por encima de 4.5:1.
  [TONO.DORADO]: 'bg-yellow-100 text-yellow-900 ring-yellow-600/25',
})

/**
 * Marca de componente compartido. Va en la raíz de cada componente de `src/components/ui/` para
 * que la prueba de los tres shells (9.8) pueda afirmar que las tres secciones dibujan con los
 * mismos componentes y no con tablas o insignias escritas a mano en cada pantalla.
 *
 * Es un atributo de un carácter de costo y es lo único en estos archivos que existe por una
 * prueba. La alternativa —inferirlo del DOM— es imposible: un `<table>` escrito a mano es
 * indistinguible de uno que viene de `Table`.
 */
export const MARCA_UI = 'data-ui'
