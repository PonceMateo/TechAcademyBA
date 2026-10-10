import { useEffect, useState } from 'react'
import { Avatar, Badge, Button, Card, Input } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { obtenerPerfilAlumno } from '../services/dataService'

/**
 * Perfil del alumno (11.5).
 *
 * **`DNI` y `Nombre` están deshabilitados con la leyenda `solo lectura`, y no es una etiqueta
 * puesta encima.** Un campo que se ve igual que los editables pero que no acepta el foco hace que
 * la persona lo intente y descubra que no funciona; deshabilitado con la leyenda al lado dice la
 * regla sin obligar a probarla. El DNI y el identificador que asigna el sistema no se cambian desde
 * acá: los cambia la secretaría.
 *
 * **`Email` y `Teléfono` son los dos campos editables, y son los únicos.** La nota de la tarjeta de
 * identidad lo dice con palabras —`Solo podés editar tus datos de contacto.`— para que quede claro
 * antes de que alguien busque un campo más.
 *
 * **La edición es local y lo dice.** No hay endpoint para actualizar el contacto (M17) y la pantalla
 * muestra la confirmación y el valor nuevo en el campo, que es lo que el maqueteado promete.
 *
 * **El avatar y el nombre de la tarjeta son del maquetado, no de la sesión.** Son los mismos
 * placeholders del cliente que ya mostraba el pie del armazón; desde el change
 * `ui-figma-dashboards` el pie muestra el tagline y el período lectivo, así que estos dos literales
 * son contenido de esta tarjeta y viven acá.
 */
const PIE_AVATAR = 'CR'
const PIE_NOMBRE = 'Camila Rodríguez'

const CHIP_PERMISOS = 'ALUMNO · PERMISOS MÍNIMOS'
const NOTA_PERMISOS = 'Solo podés editar tus datos de contacto.'
const LEYENDO_SOLO_LECTURA = 'solo lectura'

const AVISO_GUARDADO = 'Datos de contacto actualizados.'

export function StudentProfilePage() {
  const [perfil, setPerfil] = useState(null)
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    obtenerPerfilAlumno().then((resultado) => {
      setPerfil(resultado)
      setEmail(resultado?.email ?? '')
      setTelefono(resultado?.telefono ?? '')
    })
  }, [])

  if (perfil === null) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Mi Perfil</h2>
        <p className="text-sm text-slate-500">No hay ningún alumno para mostrar.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Mi Perfil</h2>

      <Card titulo="Identidad">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar iniciales={PIE_AVATAR} tamano="grande" />

          <div>
            <p className="text-lg font-semibold text-slate-900">{PIE_NOMBRE}</p>
            <div className="mt-2">
              <Badge tono={TONO.DORADO}>{CHIP_PERMISOS}</Badge>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600">{NOTA_PERMISOS}</p>
      </Card>

      <Card titulo="Datos personales">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="dni"
            etiqueta="DNI"
            valor={perfil.documento}
            disabled
            onChange={() => {}}
            leyenda={LEYENDO_SOLO_LECTURA}
          />

          <Input
            id="nombre"
            etiqueta="Nombre"
            valor={perfil.nombre}
            disabled
            onChange={() => {}}
            leyenda={LEYENDO_SOLO_LECTURA}
          />

          <Input
            id="email"
            etiqueta="Email"
            type="email"
            valor={email}
            onChange={(evento) => setEmail(evento.target.value)}
          />

          <Input
            id="telefono"
            etiqueta="Teléfono"
            valor={telefono}
            onChange={(evento) => setTelefono(evento.target.value)}
          />
        </div>

        <div className="mt-4">
          <Button
            onClick={() => {
              setAviso(AVISO_GUARDADO)
            }}
          >
            Guardar cambios
          </Button>
        </div>

        {aviso !== null && (
          <p role="status" className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {aviso}
          </p>
        )}
      </Card>
    </div>
  )
}
