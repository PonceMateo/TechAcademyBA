import { useEffect } from 'react'
import PhoneInput, { parsePhoneNumber } from 'react-phone-number-input'
import etiquetas from 'react-phone-number-input/locale/es.json'
import 'react-phone-number-input/style.css'
import { Button } from './Button'
import { MARCA_UI } from './paleta'

/**
 * Teléfono con selector de país (D57).
 *
 * **El valor que sale de acá es E.164 o vacío**, nunca texto libre: el formulario traduce el
 * vacío a `null` y la API rechaza lo que no empiece con `+`. El selector arranca en Argentina y
 * ofrece todos los países, porque el instituto inscribe alumnos del exterior.
 *
 * **Un valor guardado que no se puede interpretar no se pierde de la vista.** El control tiene dos
 * modos: si el valor es E.164 o está vacío se usa el selector de países; si es un texto que la
 * librería no puede parsear —`particular`, `000`— se muestra un input de texto con el valor crudo,
 * **sin aviso al cargar**, y una acción para pasar al selector. Guardar sin reingresarlo lo rechaza
 * la validación del formulario, que es lo que pide el spec. La alternativa de pasarle el string
 * crudo al selector no sirve: la librería lo trata como "sin valor" y el dato desaparecería de la
 * pantalla.
 *
 * **Un valor legacy que sí se puede interpretar se normaliza al abrirlo.** El efecto de abajo
 * reemplaza `+54 11 4000-0001` por `+541140000001` en el estado del formulario, así guardar sin
 * tocar el campo manda E.164 en vez del texto viejo.
 */
export function CampoTelefono({
  id,
  etiqueta,
  valor,
  onChange,
  error = null,
  obligatorio = false,
}) {
  const crudo = valor ?? ''
  const numero = parsePhoneNumber(crudo)
  const normalizado = numero?.number ?? null
  const enModoLegacy = crudo !== '' && normalizado === null

  useEffect(() => {
    if (normalizado !== null && normalizado !== crudo) {
      onChange(normalizado)
    }
  }, [crudo, normalizado, onChange])

  const describedBy = error ? `${id}-error` : undefined
  const clasesError = error ? 'border-red-500' : 'border-slate-300'

  return (
    <div className="space-y-1" {...{ [MARCA_UI]: 'campo-telefono' }}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {etiqueta}
        {obligatorio && (
          <span className="ml-1 text-red-700" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {enModoLegacy ? (
        <div className="space-y-1">
          <input
            id={id}
            type="tel"
            value={crudo}
            onChange={(evento) => onChange(evento.target.value)}
            aria-describedby={describedBy}
            aria-invalid={error ? 'true' : undefined}
            className={`foco-acento w-full rounded-lg border ${clasesError} bg-white px-3 py-2 text-sm text-slate-900`}
          />
          <Button variante="secundario" tamano="chico" onClick={() => onChange('')}>
            Usar el selector de países
          </Button>
        </div>
      ) : (
        <PhoneInput
          id={id}
          value={normalizado ?? undefined}
          onChange={(nuevo) => onChange(nuevo ?? '')}
          defaultCountry="AR"
          labels={etiquetas}
          placeholder="+54 9 11 1234-5678"
          aria-describedby={describedBy}
          aria-invalid={error ? 'true' : undefined}
          className="campo-telefono flex items-center gap-2"
          numberInputProps={{
            className: `foco-acento w-full rounded-lg border ${clasesError} bg-white px-3 py-2 text-sm text-slate-900`,
          }}
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
