import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// El CSS del selector de hora viene con la librería (historia #48) y va antes del propio para que
// los estilos de la aplicación puedan ajustarlo.
import 'react-datepicker/dist/react-datepicker.css'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
