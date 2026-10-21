/**
 * Aviso de contraseña pendiente (compartido por los tres shells).
 *
 * **Vive acá y no en cada shell** porque el aviso es del requisito de `auth-and-roles`: cuando
 * `must_change_password` está en `true`, cualquier sección tiene que avisar. Con el aviso
 * duplicado en tres pantallas, la primera que se actualice deja a las otras dos diciendo algo
 * distinto.
 *
 * Desde D45 el flujo de cambio existe y la ruta protegida redirige a `/cambiar-contrasena`, así
 * que en la práctica este aviso no llega a verse con una cuenta pendiente. Se conserva como
 * respaldo para cualquier shell que se monte sin ese guard.
 */
export function AvisoCambioContrasena({ pendiente }) {
  if (!pendiente) {
    return null
  }

  return (
    <p
      role="alert"
      className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      Tu cuenta tiene pendiente el cambio de contraseña. Cambiala antes de usar el sistema.
    </p>
  )
}
