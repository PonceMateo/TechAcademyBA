import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { vi } from 'vitest'
import { AppRoutes } from '../App'
import { SessionProvider } from '../auth/SessionContext'
import { TOKEN_STORAGE_KEY } from '../auth/tokenStorage'
import { API_MODE, configurarFuenteDeDatos, createDataSource } from '../services/dataSourceFactory'

/**
 * Devuelve la frontera de datos a su estado de ejemplo.
 *
 * **Hace falta porque los datos de ejemplo son estado, no constantes.** Registrar una cobranza o
 * forzar un bloqueo los escribe en la fuente en memoria, y sin este reset un test que modifica un
 * alumno deja modificado el alumno del test siguiente. Es la misma razón por la que el store vive
 * en la fuente y no en el módulo de datos: cada pantalla tiene su sesión de ejemplo.
 */
export function resetDataSource() {
  configurarFuenteDeDatos(createDataSource({ modo: API_MODE.MOCK }))
}

/**
 * Deja la fuente de datos de ejemplo con algunas funciones reemplazadas.
 *
 * **Para los estados que el ejemplo no tiene, y no para probar la frontera.** Hay estados que el
 * cliente no registró y que el spec nonetheless exige ver: un alumno sin inscripciones, un
 * comprobante pagado por un tercero, una comisión con cuatro bloqueados. Agregar filas de ejemplo
 * para cada uno sería inventar datos de negocio para poder mirarlos; acá se cambia quién responde
 * una función, que es exactamente lo que la frontera permite (D13).
 *
 * Lo que se reemplaza es puntual: el resto sigue viniendo del ejemplo, así que la pantalla dibuja
 * los datos reales del maqueteado y solo el estado que el test necesita.
 */
export function stubDataSource(overrides) {
  const base = createDataSource({ modo: API_MODE.MOCK })

  return configurarFuenteDeDatos({ ...base, ...overrides })
}

/**
 * Arranque de la aplicación para los tests: el mismo árbol que monta `main.jsx`, pero con
 * `MemoryRouter` y una ruta inicial explícita, para poder empezar en `/admin` sin que haya
 * que navegar hasta ahí.
 *
 * `SessionProvider` va **adentro** del router porque el contexto navega al entrar y al
 * salir (7.3); por eso los tests no pueden usar `App` tal cual.
 */

/** Contraseña de las tres cuentas de demostración, la misma del seed del backend. */
export const DEMO_PASSWORD = 'Demo2026!'

/**
 * Las tres cuentas de demostración con la forma exacta que devuelve `GET /auth/me`
 * (`id`, `email`, `rol`, `nombre`, `must_change_password`).
 */
export const DEMO_ACCOUNTS = [
  {
    id: 1,
    email: 'admin@techacademy.invalid',
    rol: 'ADMIN',
    nombre: 'Secretaria BA',
    must_change_password: false,
  },
  {
    id: 2,
    email: 'rita.molina@techacademy.invalid',
    rol: 'DOCENTE',
    nombre: 'Rita Molina',
    must_change_password: false,
  },
  {
    id: 3,
    email: 'agustina.benitez@techacademy.invalid',
    rol: 'ALUMNO',
    nombre: 'Agustina Benítez',
    must_change_password: false,
  },
]

/** El token es estable por rol, así un test puede sembrar una sesión sin pasar por el login. */
export function tokenForRole(role) {
  return `token-${role}`
}

export function accountForRole(role, overrides = {}) {
  const account = DEMO_ACCOUNTS.find((candidate) => candidate.rol === role)
  if (!account) {
    throw new Error(`No hay cuenta de demostración para el rol ${role}.`)
  }
  return { ...account, ...overrides }
}

/** Deja el token en el navegador antes de montar, que es lo que hay al recargar. */
export function seedStoredToken(role) {
  window.sessionStorage.setItem(TOKEN_STORAGE_KEY, tokenForRole(role))
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Backend falso con las dos rutas reales y las mismas respuestas: 401 genérico por
 * credenciales malas, token por credenciales buenas, y `GET /auth/me` que resuelve el token.
 *
 * Si el test pide una ruta que no existe, revienta con un mensaje explícito en vez de
 * devolver un 404 mudo: un backend falso que responde cualquier cosa esconde el error más
 * interesante, que es que el frontend llamó a un endpoint que no existe.
 */
export function stubBackend(accounts = DEMO_ACCOUNTS) {
  const byEmail = new Map(accounts.map((account) => [account.email, account]))
  const byToken = new Map(accounts.map((account) => [tokenForRole(account.rol), account]))

  const fetchMock = vi.fn(async (url, options = {}) => {
    const method = options.method ?? 'GET'
    const headers = options.headers ?? {}

    if (method === 'POST' && url.endsWith('/auth/login')) {
      const { email, password } = JSON.parse(options.body)
      const account = byEmail.get(email)
      if (account === undefined || password !== DEMO_PASSWORD) {
        // El mismo mensaje para un correo que no existe y para una contraseña que no
        // coincide: es lo que exige 5.5.
        return jsonResponse(401, { detail: 'Credenciales inválidas.' })
      }
      return jsonResponse(200, {
        access_token: tokenForRole(account.rol),
        token_type: 'bearer',
        user_id: account.id,
        rol: account.rol,
        must_change_password: account.must_change_password,
      })
    }

    if (method === 'GET' && url.endsWith('/auth/me')) {
      const token = String(headers.Authorization ?? '').replace('Bearer ', '')
      const account = byToken.get(token)
      if (account === undefined) {
        return jsonResponse(401, { detail: 'Token inválido o ausente.' })
      }
      return jsonResponse(200, account)
    }

    throw new Error(`El backend falso no implementa ${method} ${url}.`)
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="current-path">{location.pathname}</span>
}

export function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SessionProvider>
        <LocationProbe />
        <AppRoutes />
      </SessionProvider>
    </MemoryRouter>,
  )
}

export function currentPath() {
  return screen.getByTestId('current-path').textContent
}

/** Escribe el login en la pantalla y espera a que la aplicación redirija. */
export async function fillLoginForm(account, { password = DEMO_PASSWORD } = {}) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Correo electrónico'), account.email)
  await user.type(screen.getByLabelText('Contraseña'), password)
  await user.click(screen.getByRole('button', { name: 'Ingresar' }))
  return user
}

/** Atajo: deja una sesión lista sin pasar por el formulario. */
export function renderAppAs(role, initialPath = '/') {
  seedStoredToken(role)
  return renderApp(initialPath)
}
