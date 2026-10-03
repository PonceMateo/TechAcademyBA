import { describe, expect, it, vi } from 'vitest'
import { CONNECTION_ERROR_MESSAGE, fetchCurrentSession, login } from './authClient'

/**
 * El cliente habla con el backend real, así que se prueba contra sus formas exactas: el
 * cuerpo que manda y el cuerpo que recibe. Un contrato que se aparta de estos dos es un
 * bug que aparece recién en el navegador.
 */

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('login', () => {
  it('manda email y password y devuelve lo que responde el backend', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        access_token: 'token-ADMIN',
        token_type: 'bearer',
        user_id: 1,
        rol: 'ADMIN',
        must_change_password: false,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await login({ email: 'admin@techacademy.invalid', password: 'Demo2026!' })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/login')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({
      email: 'admin@techacademy.invalid',
      password: 'Demo2026!',
    })
    expect(result).toEqual({
      access_token: 'token-ADMIN',
      token_type: 'bearer',
      user_id: 1,
      rol: 'ADMIN',
      must_change_password: false,
    })
  })

  it('propaga el mensaje genérico del backend cuando las credenciales no sirven', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(401, { detail: 'Credenciales inválidas.' })),
    )

    await expect(
      login({ email: 'nadie@techacademy.invalid', password: 'Demo2026!' }),
    ).rejects.toMatchObject({ message: 'Credenciales inválidas.', status: 401 })
  })

  it('distingue "el backend no contestó" de "el backend dijo que no"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    const error = await login({ email: 'admin@techacademy.invalid', password: 'Demo2026!' }).catch(
      (thrown) => thrown,
    )

    expect(error.name).toBe('AuthError')
    expect(error.message).toBe(CONNECTION_ERROR_MESSAGE)
    expect(error.status).toBe(0)
  })
})

describe('fetchCurrentSession', () => {
  it('manda el token como Bearer y devuelve la identidad', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        id: 1,
        email: 'admin@techacademy.invalid',
        rol: 'ADMIN',
        nombre: 'Secretaria BA',
        must_change_password: false,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchCurrentSession('token-ADMIN')

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/me')
    expect(options.headers.Authorization).toBe('Bearer token-ADMIN')
    expect(result).toEqual({
      id: 1,
      email: 'admin@techacademy.invalid',
      rol: 'ADMIN',
      nombre: 'Secretaria BA',
      must_change_password: false,
    })
  })

  it('rechaza un token que el backend no acepta', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(401, { detail: 'Token inválido o ausente.' })),
    )

    await expect(fetchCurrentSession('token-vencido')).rejects.toMatchObject({
      message: 'Token inválido o ausente.',
      status: 401,
    })
  })
})
