import { useEffect, useState } from 'react'
import { useSession } from '../auth/SessionContext'
import { Avatar, Badge, Button, CampoTelefono, Card, Input } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { emailConForma } from '../domain/validacion'
import { actualizarPerfilAlumno, obtenerPerfilAlumno } from '../services/dataService'
import { formatDocumento, inicialesDe } from '../utils/formato'

/**
 * Perfil del alumno (11.5 y HU 43).
 *
 * **`DNI` y `Nombre` están deshabilitados con la leyenda `solo lectura`, y no es una etiqueta
 * puesta encima.** Un campo que se ve igual que los editables pero que no acepta el foco hace que
 * la persona lo intente y descubra que no funciona; deshabilitado con la leyenda al lado dice la
 * regla sin obligar a probarla. Además el contrato del guardado (`extra="forbid"`) rechaza con 422
 * cualquier cuerpo que los incluya: la pantalla no podría guardarlos ni queriendo.
 *
 * **`Email` y `Teléfono` son los dos campos editables, y son los únicos.** La nota de la tarjeta de
 * identidad lo dice con palabras para que quede claro antes de que alguien busque un campo más.
 *
 * **El guardado es real y puede fallar.** Con éxito se muestran los valores que devolvió la API; con
 * un email que ya pertenece a otra cuenta se informa el conflicto y los campos vuelven a lo que
 * había; con una forma inválida se marca el campo. Mientras guarda, el botón queda deshabilitado
 * para no mandar dos veces.
 *
 * **La tarjeta de seguridad reutiliza `SessionContext.changePassword`** (la misma llamada de
 * `ChangePasswordPage`) y se queda en la pantalla para poder informar el resultado: el cambio
 * obligatorio del primer ingreso sigue redirigiendo, el cambio voluntario no.
 */

const CHIP_PERMISOS = 'ALUMNO · PERMISOS MÍNIMOS'
const NOTA_PERMISOS = 'Solo podés editar tus datos de contacto.'
const LEYENDO_SOLO_LECTURA = 'solo lectura'

const AVISO_GUARDADO = 'Datos de contacto actualizados.'
const AVISO_CONTRASENA = 'Contraseña actualizada.'
const ERROR_TELEFONO = 'El teléfono debe tener el formato internacional, por ejemplo +5491112345678.'
const ERROR_CONTRASENA_CORTA = 'La contraseña nueva tiene que tener al menos 8 caracteres.'
const ERROR_CONTRASENA_DISTINTA = 'La confirmación no coincide con la contraseña nueva.'

/** El mensaje del error tal como lo devuelve la fuente, sin inventar uno propio. */
function mensajeDe(error, respaldo) {
  return error instanceof Error && error.message ? error.message : respaldo
}

/** El teléfono guardado es E.164 o no está: la misma regla que el padrón (D57). */
function telefonoConForma(valor) {
  return valor === '' || /^\+\d{7,15}$/.test(valor)
}

export function StudentProfilePage() {
  const { session, changePassword } = useSession()
  const [perfil, setPerfil] = useState(null)
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [errores, setErrores] = useState({})

  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [cambiando, setCambiando] = useState(false)
  const [avisoContrasena, setAvisoContrasena] = useState(null)

  useEffect(() => {
    obtenerPerfilAlumno()
      .then((resultado) => {
        setPerfil(resultado)
        setEmail(resultado?.email ?? '')
        setTelefono(resultado?.telefono ?? '')
      })
      .catch(() => {})
  }, [])

  if (perfil === null) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Mi Perfil</h2>
        <Card>
          <p className="text-sm text-slate-500">No hay ningún alumno para mostrar.</p>
        </Card>
      </div>
    )
  }

  async function guardarCambios(evento) {
    evento.preventDefault()
    if (guardando) {
      return
    }

    const encontrados = {}
    if (!emailConForma(email)) {
      encontrados.email = 'El email no tiene un formato válido.'
    }
    if (!telefonoConForma(telefono)) {
      encontrados.telefono = ERROR_TELEFONO
    }
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) {
      setAviso(null)
      return
    }

    setGuardando(true)
    setAviso(null)
    try {
      const guardado = await actualizarPerfilAlumno({
        email: email.trim(),
        telefono: telefono === '' ? null : telefono,
      })
      setPerfil(guardado)
      setEmail(guardado.email)
      setTelefono(guardado.telefono ?? '')
      setAviso({ tipo: 'ok', texto: AVISO_GUARDADO })
    } catch (error) {
      // Los campos vuelven a lo guardado: un email rechazado no puede quedar en pantalla como si
      // fuera el dato vigente.
      setEmail(perfil.email)
      setTelefono(perfil.telefono ?? '')
      setAviso({ tipo: 'error', texto: mensajeDe(error, 'No pudimos guardar los cambios.') })
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarContrasena(evento) {
    evento.preventDefault()
    if (cambiando) {
      return
    }

    if (nueva.length < 8) {
      setAvisoContrasena({ tipo: 'error', texto: ERROR_CONTRASENA_CORTA })
      return
    }
    if (nueva !== confirmacion) {
      setAvisoContrasena({ tipo: 'error', texto: ERROR_CONTRASENA_DISTINTA })
      return
    }

    setCambiando(true)
    setAvisoContrasena(null)
    try {
      // `redirigir: false` porque el cambio voluntario se informa acá: el cambio obligatorio del
      // primer ingreso sí vuelve al inicio de la sección.
      await changePassword({ currentPassword: actual, newPassword: nueva, redirigir: false })
      setActual('')
      setNueva('')
      setConfirmacion('')
      setAvisoContrasena({ tipo: 'ok', texto: AVISO_CONTRASENA })
    } catch (error) {
      setAvisoContrasena({
        tipo: 'error',
        texto: mensajeDe(error, 'No pudimos cambiar la contraseña.'),
      })
    } finally {
      setCambiando(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Mi Perfil</h2>

      <Card titulo="Identidad">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar iniciales={inicialesDe(session.nombre)} tamano="grande" />

          <div>
            <p className="text-lg font-semibold text-slate-900">{session.nombre}</p>
            <div className="mt-2">
              <Badge tono={TONO.DORADO}>{CHIP_PERMISOS}</Badge>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600">{NOTA_PERMISOS}</p>
      </Card>

      <Card titulo="Datos personales">
        <form onSubmit={guardarCambios} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="dni"
              etiqueta="DNI"
              valor={formatDocumento(perfil.documento)}
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
              error={errores.email ?? null}
            />

            <CampoTelefono
              id="telefono"
              etiqueta="Teléfono"
              valor={telefono}
              onChange={setTelefono}
              error={errores.telefono ?? null}
            />
          </div>

          <div className="mt-4">
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>

          {aviso !== null && (
            <p
              role={aviso.tipo === 'ok' ? 'status' : 'alert'}
              className={`mt-3 rounded-md px-3 py-2 text-sm ${
                aviso.tipo === 'ok' ? 'bg-slate-50 text-slate-700' : 'bg-red-50 text-red-800'
              }`}
            >
              {aviso.texto}
            </p>
          )}
        </form>
      </Card>

      <Card
        titulo="Seguridad"
        descripcion="Cambiá tu contraseña cuando quieras: la anterior deja de funcionar."
      >
        <form onSubmit={cambiarContrasena} noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              id="password-actual"
              etiqueta="Contraseña actual"
              type="password"
              autoComplete="current-password"
              valor={actual}
              onChange={(evento) => setActual(evento.target.value)}
            />
            <Input
              id="password-nueva"
              etiqueta="Contraseña nueva"
              type="password"
              autoComplete="new-password"
              valor={nueva}
              onChange={(evento) => setNueva(evento.target.value)}
            />
            <Input
              id="password-confirmacion"
              etiqueta="Repetí la nueva"
              type="password"
              autoComplete="new-password"
              valor={confirmacion}
              onChange={(evento) => setConfirmacion(evento.target.value)}
            />
          </div>

          <div className="mt-4">
            <Button type="submit" variante="secundario" disabled={cambiando}>
              {cambiando ? 'Cambiando…' : 'Cambiar contraseña'}
            </Button>
          </div>

          {avisoContrasena !== null && (
            <p
              role={avisoContrasena.tipo === 'ok' ? 'status' : 'alert'}
              className={`mt-3 rounded-md px-3 py-2 text-sm ${
                avisoContrasena.tipo === 'ok'
                  ? 'bg-slate-50 text-slate-700'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              {avisoContrasena.texto}
            </p>
          )}
        </form>
      </Card>
    </div>
  )
}
