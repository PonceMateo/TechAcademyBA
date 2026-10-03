import { defineConfig } from 'eslint/config'
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

/**
 * ESLint plano (flat config). Reglas de JavaScript, reglas de React, y al final Prettier,
 * que apaga las reglas de formato de ESLint para que las dos herramientas no discutan.
 *
 * `js.configs.recommended` se abre en vez de usar `extends: ['js/recommended']`: la forma
 * corta resuelve el plugin por nombre dentro del mismo objeto, y `@eslint/js` no es un
 * plugin con `rules` en la raíz, así que esa forma no lo encuentra.
 */
export default defineConfig([
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      js,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs['recommended-latest'].rules,
    },
  },
  {
    // Solo el módulo de entrada monta React en el DOM: el resto son componentes y los
    // recarga Vite. La regla evita que ese módulo se importe desde cualquier otro lado.
    //
    // `useSession` y `SESSION_STATUS` quedan exceptuados: el contexto, su provider, su
    // hook y sus estados son la misma unidad, y separarlos en tres archivos no le compra
    // nada a quien lea el código. Lo que la regla protege —que HMR no se rompa— se pierde
    // acá, y es un costo de vuelve rápido, no de corrección.
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactRefresh.configs.vite.rules,
      'react-refresh/only-export-components': [
        'error',
        { allowExportNames: ['useSession', 'SESSION_STATUS'] },
      ],
    },
  },
  {
    // Los archivos de configuración y los tests corren en Node, no en el navegador.
    files: ['*.config.js', 'src/test/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // `src/test/` no se recarga en caliente: sus archivos son utilidades, no la
      // aplicación.
      'react-refresh/only-export-components': 'off',
    },
  },
  prettier,
])
