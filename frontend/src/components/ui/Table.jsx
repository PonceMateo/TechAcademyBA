import { Fragment } from 'react'
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
 *
 * `detalle` es opcional y agrega una fila debajo de la que corresponde, con el ancho completo.
 * La usa el historial de cobranzas para desplegar las imputaciones sin salir de la tabla.
 */
export function Table({
  columnas,
  filas,
  claveDeFila = (fila) => fila.id,
  vacio = null,
  detalle = null,
}) {
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
          {filas.map((fila) => {
            const contenido = detalle === null ? null : detalle(fila)
            return (
              <Fragment key={claveDeFila(fila)}>
                <tr className="align-top transition hover:bg-slate-50/70">
                  {columnas.map((columna) => (
                    <td key={columna.clave} className="px-4 py-3 text-slate-700 tabular-nums">
                      {columna.render(fila)}
                    </td>
                  ))}
                </tr>
                {contenido != null && (
                  <tr className="bg-slate-50/80">
                    <td colSpan={columnas.length} className="px-4 py-3">
                      {contenido}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
