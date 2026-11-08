import { ready } from './fireweave/start'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './posthog.ts'
import App from './App.tsx'

ready.then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
