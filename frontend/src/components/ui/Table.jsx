import { MARCA_UI } from './paleta'

/**
 * Tabla de la interfaz (8.3).
 *
 * **Recibe las columnas ya calculadas** en vez de los datos: el encabezado, las celdas y el
 * formato de cada columna son cosas de la pantalla, y meterlos adentro convertiría a la tabla en
 * un segundo lenguaje de maquetado. Acá hay estructura y nada de contenido.
 *
 * `filas` acepta `null` para dejar la celda vacía. Es lo que necesitan el comprobante ilegible —
 * el importe nunca pudo leerse— y el cheque que todavía no tiene a quién imputarse: la
 * ausencia se muestra como ausencia y no como un `—` inventado.
 */
export function Table({ columnas, filas, claveDeFila = (fila) => fila.id, vacio = null }) {
  if (filas.length === 0) {
    return vacio
  }

  return (
    <div className="overflow-x-auto">
      <table {...{ [MARCA_UI]: 'table' }} className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columnas.map((columna) => (
              <th
                key={columna.clave}
                scope="col"
                className={`px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-600 ${columna.ancho ?? ''}`}
              >
                {columna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {filas.map((fila) => (
            <tr key={claveDeFila(fila)} className="align-top">
              {columnas.map((columna) => (
                <td key={columna.clave} className="px-3 py-2 text-slate-700">
                  {columna.render(fila)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
