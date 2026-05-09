import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Camera, Upload, Search, LayoutDashboard, LogOut, LogIn } from 'lucide-react'
import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL || ''

const publicLinks = [
  { to: '/', label: 'Home', icon: Camera },
  { to: '/search', label: 'Find Me', icon: Search },
]

const adminLinks = [
  { to: '/upload', label: 'Upload', icon: Upload },
  { to: '/admin', label: 'Admin', icon: LayoutDashboard },
]

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    axios.get(`${API}/api/auth/me`, { withCredentials: true })
      .then(() => setIsAdmin(true))
      .catch(() => setIsAdmin(false))
  }, [location.pathname]) // re-check on route change (handles login/logout)

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/api/auth/logout`, {}, { withCredentials: true })
      setIsAdmin(false)
      toast.success('Logged out')
      navigate('/')
    } catch {
      toast.error('Logout failed')
    }
  }

  const visibleLinks = isAdmin ? [...publicLinks, ...adminLinks] : publicLinks

  return (
    <nav className="sticky top-0 z-50 border-b border-ink-700/50 bg-ink/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-volt rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
              <Camera size={16} className="text-ink" strokeWidth={2.5} />
            </div>
            <span className="font-display font-semibold text-lg tracking-tight">
              Fac<span className="text-volt">Event</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {visibleLinks.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-volt/10 text-volt border border-volt/20'
                      : 'text-ink-200 hover:text-white hover:bg-ink-700/50'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </Link>
              )
            })}

            {/* Auth button */}
            {isAdmin ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-ink-300 hover:text-coral hover:bg-coral/10 transition-all duration-200 ml-1"
              >
                <LogOut size={14} />
                Logout
              </button>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-ink-300 hover:text-white hover:bg-ink-700/50 transition-all duration-200 ml-1"
              >
                <LogIn size={14} />
                Admin
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-ink-300 hover:text-white hover:bg-ink-700/50 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <div className="w-5 h-4 flex flex-col justify-between">
              <span className={`block h-0.5 bg-current transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
              <span className={`block h-0.5 bg-current transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`} />
              <span className={`block h-0.5 bg-current transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </div>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 pt-2 border-t border-ink-700/50 mt-2">
            {visibleLinks.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium mb-1 transition-all ${
                    active
                      ? 'bg-volt/10 text-volt'
                      : 'text-ink-200 hover:text-white hover:bg-ink-700/50'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              )
            })}

            {isAdmin ? (
              <button
                onClick={() => { setMobileOpen(false); handleLogout() }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-ink-300 hover:text-coral hover:bg-coral/10 transition-all w-full"
              >
                <LogOut size={16} />
                Logout
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-ink-300 hover:text-white hover:bg-ink-700/50 transition-all"
              >
                <LogIn size={16} />
                Admin Login
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}