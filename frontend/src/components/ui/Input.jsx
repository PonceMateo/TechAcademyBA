import { MARCA_UI } from './paleta'

/**
 * Campo de formulario (8.3).
 *
 * **La etiqueta, el control y el error salen juntos** porque en el maquete hay un caso donde eso
 * importa: la `Sede` es obligatoria solo para modalidad `Presencial` o `Híbrido` (historia #8), y
 * el error tiene que aparecer pegado al campo que lo produjo, no al pie del formulario.
 *
 * Un `Input` es un campo con etiqueta. La casilla de la factura tipo A y los selectores multiples
 * de la pantalla de cobranzas no son esto: son `Campo` con su propio control adentro, y por eso
 * el componente acepta `children` para el control cuando hace falta algo que no sea un input.
 */
export function Input({
  etiqueta,
  id,
  type = 'text',
  valor,
  onChange,
  placeholder,
  error = null,
  obligatorio = false,
  requerido = false,
  autoComplete,
  className = '',
  children,
  ...resto
}) {
  const describedBy = error ? `${id}-error` : undefined

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {etiqueta}
        {obligatorio && (
          <span className="ml-1 text-red-700" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children ?? (
        <input
          {...{ [MARCA_UI]: 'input' }}
          id={id}
          type={type}
          value={valor}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-required={requerido || obligatorio || undefined}
          aria-describedby={describedBy}
          aria-invalid={error ? 'true' : undefined}
          className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 ${className}`}
          {...resto}
        />
      )}

      {error !== null && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Campo de formulario con un control propio adentro.
 *
 * Existe porque hay controles que no son un `input` y siguen siendo un campo con etiqueta: el
 * selector de modalidad, el de medio de pago, la casilla de la factura. Es el mismo `Input` con el
 * control dado por la pantalla.
 */
export function Campo({ etiqueta, id, obligatorio = false, error = null, children }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {etiqueta}
        {obligatorio && (
          <span className="ml-1 text-red-700" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error !== null && (
        <p role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
