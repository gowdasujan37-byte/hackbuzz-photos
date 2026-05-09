import { useState, useEffect } from 'react'
import { LayoutDashboard, Image, Users, Scan, Trash2, RefreshCw, Calendar, Eye, EyeOff } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL || ''

export default function AdminPage() {
  const [stats, setStats] = useState(null)
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [statsRes, photosRes] = await Promise.all([
        axios.get(`${API}/api/admin/stats`),
        axios.get(`${API}/api/admin/photos?limit=30&offset=${page * 30}`)
      ])
      setStats(statsRes.data)
      setPhotos(photosRes.data.photos || [])
    } catch (e) {
      toast.error('Failed to load admin data. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page])

  const deletePhoto = async (id, publicId) => {
    if (!confirm('Delete this photo and all its face data?')) return
    try {
      await axios.delete(`${API}/api/admin/photo/${id}?public_id=${encodeURIComponent(publicId)}`)
      toast.success('Photo deleted')
      fetchData()
    } catch (e) {
      toast.error('Failed to delete photo')
    }
  }

  const toggleVisibility = async (id, currentHidden) => {
    try {
      await axios.put(`${API}/api/admin/photo/${id}/visibility`, {}, { withCredentials: true })
      toast.success(currentHidden ? 'Photo made visible' : 'Photo hidden from gallery')
      fetchData()
    } catch (e) {
      toast.error('Failed to toggle visibility')
    }
  }

  const statCards = stats ? [
    { label: 'Total Photos', value: stats.total_photos, icon: Image, color: 'text-volt', bg: 'bg-volt/10 border-volt/20' },
    { label: 'Processed', value: stats.processed_photos, icon: Scan, color: 'text-azure', bg: 'bg-azure/10 border-azure/20' },
    { label: 'Faces Indexed', value: stats.total_faces, icon: Users, color: 'text-coral', bg: 'bg-coral/10 border-coral/20' },
    { label: 'Events', value: stats.total_events, icon: Calendar, color: 'text-ink-200', bg: 'bg-ink-700/50 border-ink-600/50' },
  ] : []

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-10">
        <div>
          <p className="label mb-2">System Overview</p>
          <h1 className="text-4xl font-display font-semibold text-white">Admin Dashboard</h1>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 btn-outline"
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      {loading && !stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="w-8 h-8 bg-ink-700 rounded-lg mb-3" />
              <div className="w-16 h-7 bg-ink-700 rounded mb-2" />
              <div className="w-20 h-3 bg-ink-700/50 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {statCards.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`card p-5 border ${bg}`}>
              <div className={`w-9 h-9 rounded-xl ${bg} border flex items-center justify-center mb-3`}>
                <Icon size={18} className={color} />
              </div>
              <div className={`text-3xl font-display font-semibold ${color} mb-1`}>
                {value?.toLocaleString() ?? '—'}
              </div>
              <div className="label text-ink-400">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Processing note */}
      {stats && stats.total_photos > stats.processed_photos && (
        <div className="card p-4 mb-8 border-azure/20 bg-azure/5 flex items-center gap-3">
          <div className="w-2 h-2 bg-azure rounded-full animate-pulse" />
          <p className="text-sm text-ink-200">
            <span className="text-azure font-semibold">{stats.total_photos - stats.processed_photos}</span> photo(s) are still being processed in the background. Face indexing may take a few minutes.
          </p>
        </div>
      )}

      {/* Photos table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-ink-700/50">
          <h2 className="font-display font-semibold text-white flex items-center gap-2">
            <LayoutDashboard size={16} className="text-volt" />
            All Photos
          </h2>
          <span className="label text-ink-500">{photos.length} shown</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-700/50">
                <th className="text-left px-5 py-3 label text-ink-500">Preview</th>
                <th className="text-left px-5 py-3 label text-ink-500">File</th>
                <th className="text-left px-5 py-3 label text-ink-500">Event</th>
                <th className="text-left px-5 py-3 label text-ink-500">Faces</th>
                <th className="text-left px-5 py-3 label text-ink-500">Status</th>
                <th className="text-left px-5 py-3 label text-ink-500">Visibility</th>
                <th className="text-left px-5 py-3 label text-ink-500">Uploaded</th>
                <th className="text-right px-5 py-3 label text-ink-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {photos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-ink-500">
                    <Image size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No photos uploaded yet</p>
                  </td>
                </tr>
              ) : (
                photos.map(photo => (
                  <tr key={photo.id} className="border-b border-ink-700/30 hover:bg-ink-700/20 transition-colors">
                    <td className="px-5 py-3">
                      <img
                        src={photo.cloudinary_url}
                        alt={photo.original_filename}
                        className="w-12 h-12 object-cover rounded-lg border border-ink-600/30"
                        loading="lazy"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-white truncate max-w-[150px]">{photo.original_filename}</p>
                      <p className="text-xs text-ink-500 truncate max-w-[150px] mt-0.5">{photo.cloudinary_public_id}</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-ink-300">{photo.event_name}</td>
                    <td className="px-5 py-3">
                      <span className={`font-mono text-sm ${photo.face_count > 0 ? 'text-volt' : 'text-ink-500'}`}>
                        {photo.face_count}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        photo.processed
                          ? 'bg-volt/10 text-volt border border-volt/20'
                          : 'bg-azure/10 text-azure border border-azure/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${photo.processed ? 'bg-volt' : 'bg-azure animate-pulse'}`} />
                        {photo.processed ? 'Processed' : 'Processing'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        photo.is_hidden
                          ? 'bg-coral/10 text-coral border border-coral/20'
                          : 'bg-volt/10 text-volt border border-volt/20'
                      }`}>
                        {photo.is_hidden ? 'Hidden' : 'Visible'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-ink-500">
                      {new Date(photo.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right flex justify-end gap-2">
                      <button
                        onClick={() => toggleVisibility(photo.id, photo.is_hidden)}
                        className={`p-2 rounded-lg transition-all ${
                          photo.is_hidden
                            ? 'text-ink-500 hover:text-volt hover:bg-volt/10'
                            : 'text-ink-500 hover:text-coral hover:bg-coral/10'
                        }`}
                        title={photo.is_hidden ? 'Unhide photo' : 'Hide photo'}
                      >
                        {photo.is_hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => deletePhoto(photo.id, photo.cloudinary_public_id)}
                        className="p-2 rounded-lg text-ink-500 hover:text-coral hover:bg-coral/10 transition-all"
                        title="Delete photo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {photos.length === 30 && (
          <div className="p-4 flex justify-between border-t border-ink-700/50">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-outline py-2 px-4 text-xs disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="label text-ink-500 self-center">Page {page + 1}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              className="btn-outline py-2 px-4 text-xs"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
