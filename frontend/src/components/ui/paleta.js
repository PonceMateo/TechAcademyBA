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
  // El acento del shell de Docente. El spec lo llama `verde azulado`, que es el nombre de
  // Tailwind para ese color: el nombre del tono y el de la clase coinciden a propósito, para
  // que quien busque el color en el proyecto encuentre las dos cosas juntas.
  VERDE_AZULADO: 'verde azulado',
  // El acento del shell de Alumno. El spec lo llama `terracota` y Tailwind no tiene ese color:
  // el naranja quemado es el tono más cercano de la paleta, y el nombre del tono sigue siendo el
  // que dice el spec para que el código no invente un cuarto nombre para el mismo color.
  TERRACOTA: 'terracota',
})

export const CLASES_BADGE = Object.freeze({
  [TONO.VERDE]: 'bg-green-100 text-green-800 ring-green-600/20',
  [TONO.ROJO]: 'bg-red-100 text-red-800 ring-red-600/20',
  [TONO.AMBAR]: 'bg-amber-100 text-amber-900 ring-amber-600/20',
  [TONO.GRIS]: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  [TONO.VIOLETA]: 'bg-violet-100 text-violet-800 ring-violet-600/20',
  [TONO.MAGENTA]: 'bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-600/20',
  [TONO.CELESTE]: 'bg-sky-100 text-sky-800 ring-sky-600/20',
  [TONO.VERDE_AZULADO]: 'bg-teal-100 text-teal-800 ring-teal-600/20',
  [TONO.TERRACOTA]: 'bg-orange-100 text-orange-900 ring-orange-700/25',
})

/**
 * Marca de componente compartido. Va en la raíz de cada componente de `src/components/ui/` para
 * que la prueba de los tres shells (9.8) pueda afirmar que las tres secciones dibujan con los
 * mismos componentes y no con tablas o insignias escritas a mano en cada pantalla.
 *
 * Es un atributo de un carácter de costo y es lo único en estos siete archivos que existe por una
 * prueba. La alternativa —inferirlo del DOM— es imposible: un `<table>` escrito a mano es
 * indistinguible de uno que viene de `Table`.
 */
export const MARCA_UI = 'data-ui'
