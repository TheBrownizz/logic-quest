import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { captureRedirect } from './cloud/auth'
import { App } from './ui/App'
// Self-hosted fonts (bundled by Vite): no runtime request leaves the origin.
import '@fontsource/rubik/400.css'
import '@fontsource/rubik/500.css'
import '@fontsource/rubik/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'

// Finish an OAuth return before the router reads the address (restores the hash, drops ?code=).
captureRedirect()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
