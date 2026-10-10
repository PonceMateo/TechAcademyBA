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
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th
                key={columna.clave}
                scope="col"
                className={`px-4 py-3 text-left text-[11px] font-semibold tracking-wide text-slate-500 uppercase ${columna.ancho ?? ''}`}
              >
                {columna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {filas.map((fila) => (
            <tr key={claveDeFila(fila)} className="align-top transition hover:bg-slate-50/70">
              {columnas.map((columna) => (
                <td key={columna.clave} className="px-4 py-3 text-slate-700 tabular-nums">
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
