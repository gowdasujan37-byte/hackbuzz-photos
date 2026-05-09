import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#141430',
            color: '#F0F0F5',
            border: '1px solid rgba(196, 241, 53, 0.2)',
            fontFamily: 'Satoshi, sans-serif',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#C4F135', secondary: '#0A0A0F' },
          },
          error: {
            iconTheme: { primary: '#FF6B6B', secondary: '#0A0A0F' },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
)
