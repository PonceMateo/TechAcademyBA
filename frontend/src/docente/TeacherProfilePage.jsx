import { useEffect, useState } from 'react'
import { useSession } from '../auth/SessionContext'
import { Avatar, Badge, Button, CampoTelefono, Card, Input, Table } from '../components/ui'
import { TONO } from '../components/ui/paleta'
import { emailConForma, formatearCuil } from '../domain/validacion'
import { actualizarPerfilDocente, obtenerPerfilDocente } from '../services/dataService'
import { formatDocumento, inicialesDe } from '../utils/formato'

/**
 * Perfil del docente (10.5 y HU 90).
 *
 * **La identidad no se edita y se ve así en pantalla.** `Nombre`, `Apellido`, `DNI` y `CUIL` están
 * deshabilitados, con el fondo gris del control, y el contrato del guardado (`extra="forbid"`) los
 * rechaza con 422: la pantalla no podría cambiarlos ni queriendo. Los cambios administrativos
 * siguen pidiéndose a Secretaría.
 *
 * **`Email` y `Teléfono` son los dos campos editables, y son los únicos.** El guardado es real: con
 * éxito se muestran los valores que devolvió la API y la sesión refleja el email nuevo; con un
 * email que ya pertenece a otra persona se informa el conflicto y **lo ingresado no se borra**,
 * para que se pueda corregir sin volver a escribir todo.
 *
 * **La tarjeta de seguridad reutiliza `SessionContext.changePassword`** (la misma llamada de
 * `ChangePasswordPage`) y se queda en la pantalla para informar el resultado. El cambio obligatorio
 * del primer ingreso (HU 66) sigue redirigiendo; este no.
 */
const COLUMNAS = [
  {
    clave: 'codigo',
    titulo: 'CÓDIGO',
    render: (fila) => <span className="font-medium">{fila.codigo}</span>,
  },
  { clave: 'curso', titulo: 'CURSO', render: (fila) => fila.nombre_curso },
  { clave: 'horario', titulo: 'HORARIO', render: (fila) => fila.horario },
  {
    clave: 'estado',
    titulo: 'ESTADO',
    render: (fila) => (
      <Badge tono={fila.estado === 'Activa' ? TONO.VERDE : TONO.GRIS}>{fila.estado}</Badge>
    ),
  },
]

const NOTA_PERMISOS = 'Los cambios administrativos deben solicitarse a Secretaría BA.'

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

export function TeacherProfilePage() {
  const { session, changePassword, updateSession } = useSession()
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
    obtenerPerfilDocente()
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
        <p className="text-sm text-slate-500">No hay ningún docente para mostrar.</p>
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
      const guardado = await actualizarPerfilDocente({
        email: email.trim(),
        telefono: telefono === '' ? null : telefono,
      })
      setPerfil(guardado)
      setEmail(guardado.email)
      setTelefono(guardado.telefono ?? '')
      updateSession({ email: guardado.email })
      setAviso({ tipo: 'ok', texto: AVISO_GUARDADO })
    } catch (error) {
      // Lo ingresado se conserva: el rechazo puede ser por un email ocupado y hay que poder
      // corregirlo sin volver a escribir el formulario.
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
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600">{NOTA_PERMISOS}</p>
      </Card>

      <Card titulo="Datos personales">
        <form onSubmit={guardarCambios} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="nombre"
              etiqueta="Nombre"
              valor={perfil.nombre}
              disabled
              onChange={() => {}}
            />

            <Input
              id="apellido"
              etiqueta="Apellido"
              valor={perfil.apellido}
              disabled
              onChange={() => {}}
            />

            <Input
              id="dni"
              etiqueta="DNI"
              valor={formatDocumento(perfil.dni)}
              disabled
              onChange={() => {}}
            />

            <Input
              id="cuil"
              etiqueta="CUIL"
              valor={perfil.cuil === null ? '' : formatearCuil(perfil.cuil)}
              disabled
              onChange={() => {}}
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

      <Card titulo="Comisiones asignadas">
        <Table
          columnas={COLUMNAS}
          filas={perfil.comisiones}
          claveDeFila={(fila) => fila.codigo}
          vacio={
            <p className="text-sm text-slate-500">
              No tenés comisiones asignadas en este período lectivo.
            </p>
          }
        />
      </Card>
    </div>
  )
}
