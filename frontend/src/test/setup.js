import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest corre sin globals, así que React Testing Library no puede registrar su limpieza
// automática: se hace acá a mano para que cada test arranque sin el árbol del anterior.
afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
})
