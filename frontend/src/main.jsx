import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Les CSS de librairies d'abord : ainsi tes styles (importés via App) passent après Bootstrap
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '@fontsource/nova-round'
import '@fontsource/dosis'
import '@fontsource/josefin-sans'
import '@fontsource/inter'

import App from './App.jsx'
import { ThemeProvider } from './contexts/DarkContext'
import { LanguageProvider } from './contexts/LanguageContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </LanguageProvider>
  </StrictMode>,
)