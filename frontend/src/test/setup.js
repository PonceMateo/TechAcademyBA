import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { API_MODE, configurarFuenteDeDatos, createDataSource } from '../services/dataSourceFactory'

/**
 * Cada test arranca con la fuente de ejemplo.
 *
 * **Este es el default del suite, no el de producción.** En producción el modo por omisión es `api`
 * (D36), pero un test que llega a una pantalla sin fijar la fuente usa la real, y su rechazo queda
 * flotando: el test pasa y Vitest cuenta un error sin dueño. Fijarla una sola vez acá evita que
 *Depender de que cada archivo se acuerde, y los tests que sí quieren la fuente real la
 * configuran en su propio cuerpo, que corre después de este `beforeEach`.
 */
beforeEach(() => {
  configurarFuenteDeDatos(createDataSource({ modo: API_MODE.MOCK }))
})

// Vitest corre sin globals, así que React Testing Library no puede registrar su limpieza
// automática: se hace acá a mano para que cada test arranque sin el árbol del anterior.
afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
})