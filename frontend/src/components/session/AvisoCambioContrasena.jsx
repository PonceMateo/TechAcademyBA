/**
 * Aviso de contraseña pendiente (compartido por los tres shells).
 *
 * **Vive acá y no en cada shell** porque el aviso es del requisito de `auth-and-roles`: cuando
 * `must_change_password` está en `true`, cualquier sección tiene que avisar. Con el aviso
 * duplicado en tres pantallas, la primera que se actualice deja a las otras dos diciendo que el
 * flujo de cambio existe.
 *
 * El flujo de cambio no existe todavía, así que el aviso dice eso mismo en lugar de llevar a una
 * pantalla que no hay (D18). Con las cuentas de demostración no aparece: el seed las deja en
 * `false`.
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
      Tu cuenta tiene pendiente el cambio de contraseña. El flujo de cambio todavía no está
      disponible: avisale a la secretaría para que te mande una clave nueva.
    </p>
  )
}
