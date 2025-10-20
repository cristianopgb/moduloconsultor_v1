// /src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

try {
  const rootElement = document.getElementById('root')
  if (!rootElement) {
    throw new Error('Root element not found')
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
} catch (error) {
  console.error('Failed to render app:', error)
  document.body.innerHTML = `
    <div style="
      min-height: 100vh; 
      background: #111827; 
      display: flex; 
      align-items: center; 
      justify-content: center;
      color: white;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial;
      margin:0;
    ">
      <div style="text-align: center; max-width: 620px; padding: 0 16px;">
        <h1 style="margin: 0 0 8px; font-size: 24px;">Erro ao carregar aplicação</h1>
        <p style="color: #9CA3AF; margin: 16px 0;">Verifique o console para mais detalhes</p>
        <button onclick="window.location.reload()" style="
          background: #2563EB; 
          color: white; 
          border: none; 
          padding: 8px 16px; 
          border-radius: 8px; 
          cursor: pointer;
        ">
          Recarregar Página
        </button>
      </div>
    </div>
  `
}
