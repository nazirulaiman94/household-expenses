import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app.css'
import ArtifactApp from './ArtifactApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ArtifactApp />
  </StrictMode>,
)
