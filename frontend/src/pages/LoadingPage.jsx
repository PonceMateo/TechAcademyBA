/**
 * Pantalla de carga. Existe para que la respuesta a "todavía no sé quién sos" no sea un
 * vacío: aparece mientras `GET /auth/me` resuelve la identidad de una sesión guardada.
 */
export function LoadingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <p role="status" className="text-sm text-slate-600">
        Cargando…
      </p>
    </main>
  )
}
