import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `VITE_API_PROXY_TARGET` lo declara docker-compose.yml y lo documenta `.env.example`.
// El prefijo `VITE_` hace que `loadEnv` lo encuentre tanto en el archivo como en el
// entorno del contenedor; el valor por defecto es el que corresponde al nombre del
// servicio de Compose adentro de la red de Docker.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://backend:8000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // El puerto está publicado en docker-compose.yml: si Vite elige otro, el mapeo
      // apunta a un puerto donde nadie escucha. Prefiere fallar a desviarse en silencio.
      strictPort: true,
      // D14: el navegador habla con `/api` y el servidor de desarrollo reenvía al
      // backend. El backend no publica prefijo, así que `/api` se saca del camino.
      // Gracias a esto, el día que las pantallas dejen de usar datos de ejemplo no hay
      // que cambiar el origen desde el que se llama al backend.
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      // Los tests no verifican estilos: no se procesa CSS y por lo tanto no se corre la
      // transformación de Tailwind en cada archivo.
      css: false,
      restoreMocks: true,
    },
  }
})
