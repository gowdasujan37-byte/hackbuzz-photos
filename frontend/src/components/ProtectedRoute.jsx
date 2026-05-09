import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || ''

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'ok' | 'denied'

  useEffect(() => {
    axios.get(`${API}/api/auth/me`, { withCredentials: true })
      .then(() => setStatus('ok'))
      .catch(() => setStatus('denied'))
  }, [])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-ink-600 border-t-volt rounded-full animate-spin" />
      </div>
    )
  }

  if (status === 'denied') {
    return <Navigate to="/login" replace />
  }

  return children
}