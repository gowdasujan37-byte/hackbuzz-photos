import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Lock } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await axios.post(`${API}/api/auth/login`, form, { withCredentials: true })
      toast.success('Welcome, Admin!')
      navigate('/upload')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card p-8 w-full max-w-sm border-ink-700/50">
        <div className="w-12 h-12 bg-volt/10 border border-volt/20 rounded-xl flex items-center justify-center mx-auto mb-6">
          <Lock size={22} className="text-volt" />
        </div>
        <h1 className="text-2xl font-display font-semibold text-white text-center mb-1">Admin Login</h1>
        <p className="text-ink-400 text-sm text-center mb-8">Photographers only</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="label mb-1.5 block">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              className="w-full bg-ink-700/50 border border-ink-600/50 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-volt/50"
              placeholder="admin"
              required
            />
          </div>
          <div>
            <label className="label mb-1.5 block">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full bg-ink-700/50 border border-ink-600/50 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-volt/50"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <div className="w-4 h-4 border-2 border-ink/30 border-t-ink rounded-full animate-spin" /> : null}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}