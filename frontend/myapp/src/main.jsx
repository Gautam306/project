import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { SocketProvider } from './ContextApi/SocketProvider';
import { VideoProvider } from './ContextApi/VideoControl.jsx';
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  // <StrictMode>
  <SocketProvider>
    <VideoProvider>
      <App />
    </VideoProvider>
  </SocketProvider>
  //  </StrictMode> 
  ,
)
