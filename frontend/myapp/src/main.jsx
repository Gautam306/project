import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { SocketProvider } from './ContextApi/SocketProvider';
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SocketProvider>
    <App />
    </SocketProvider>
  </StrictMode>,
)
