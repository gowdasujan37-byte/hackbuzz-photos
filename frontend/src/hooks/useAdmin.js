import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || ''

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(null) // null = loading
  const navigate = useNavigate()

  useEffect(() => {
    axios.get(`${API}/api/auth/me`, { withCredentials: true })
      .then(() => setIsAdmin(true))
      .catch(() => { setIsAdmin(false); navigate('/login') })
  }, [])

  return isAdmin
}