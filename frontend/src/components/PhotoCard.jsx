import { Download, ImageOff, ZoomIn, X } from 'lucide-react'
import { useState, useMemo, memo, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'

// Fullscreen Modal Component
function PhotoModal({ photo, isOpen, onClose }) {
  const closeRef = useRef(onClose)

  // Update ref whenever onClose changes
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeRef.current?.()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  if (!isOpen) return null

  const handleDownload = async (e) => {
    e.preventDefault()
    try {
      const url = optimizeCloudinaryUrl(photo.cloudinary_url, { w: 1600 })
      const response = await fetch(url)
      const blob = await response.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = photo.original_filename || 'photo.jpg'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
      toast.success('Download started')
    } catch (err) {
      console.error('Download failed:', err)
      toast.error('Download failed')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      {/* Modal Container */}
      <div className="relative max-w-4xl w-full max-h-[90vh] rounded-2xl overflow-hidden bg-ink-900 border border-ink-700/50 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-ink-800/80 hover:bg-ink-700 text-ink-300 hover:text-white transition-all duration-200 backdrop-blur-md hover:shadow-lg hover:shadow-volt/20"
          title="Close (ESC)"
        >
          <X size={20} />
        </button>

        {/* Image */}
        <img
          src={optimizeCloudinaryUrl(photo.cloudinary_url, { w: 1600 })}
          alt={photo.original_filename}
          className="w-full h-full object-contain"
        />

        {/* Info Footer */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink-950 via-ink-950/50 to-transparent p-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-volt font-semibold mb-1">{photo.event_name}</p>
              <p className="text-xs text-ink-400">{photo.original_filename}</p>
              <p className="text-xs text-ink-500 mt-1">
                {photo.face_count > 0 ? `${photo.face_count} face${photo.face_count !== 1 ? 's' : ''} detected` : 'No faces detected'}
              </p>
            </div>
            <button
              onClick={handleDownload}
              className="p-3 bg-volt/90 hover:bg-volt text-ink rounded-xl transition-all duration-200 shadow-lg hover:shadow-volt/50"
              title="Download full resolution"
            >
              <Download size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Cloudinary URL Optimizer
function optimizeCloudinaryUrl(url, options = {}) {
  if (!url || !url.includes('cloudinary.com')) return url

  const { w = 400, h = 400, q = 'auto', f = 'auto', c = 'fill' } = options
  
  // Parse the URL and inject optimization parameters
  const parts = url.split('/upload/')
  if (parts.length !== 2) return url
  
  const transformations = `c_${c},f_${f},q_${q},w_${w}`
  return `${parts[0]}/upload/${transformations}/${parts[1]}`
}

// PhotoCard Component with memo optimization
const PhotoCard = memo(({ photo, onDownload, onImageError }) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [isImageLoading, setIsImageLoading] = useState(true)

  // Memoize optimized URLs
  const optimizedUrls = useMemo(() => ({
    thumbnail: optimizeCloudinaryUrl(photo.cloudinary_url, { w: 400, h: 400, q: 'auto', f: 'auto' }),
    full: optimizeCloudinaryUrl(photo.cloudinary_url, { w: 1200, q: 'auto', f: 'auto' })
  }), [photo.cloudinary_url])

  const handleImageLoad = () => {
    setImageLoaded(true)
    setIsImageLoading(false)
  }

  const handleImageError = (error) => {
    console.error(`Failed to load image: ${photo.cloudinary_url}`, error)
    setImageError(true)
    setIsImageLoading(false)
    onImageError?.(photo.id, photo.cloudinary_url)
  }

  const handleDownload = async (e) => {
    e.stopPropagation()
    try {
      if (onDownload) {
        onDownload(photo)
      } else {
        // Direct blob download for reliable one-click downloads
        const response = await fetch(optimizedUrls.full)
        const blob = await response.blob()
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = photo.original_filename || 'photo.jpg'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(link.href)
      }
      toast.success('Download started')
    } catch (err) {
      console.error('Download failed:', err)
      toast.error('Download failed')
    }
  }

  const handleImageClick = () => {
    if (!imageError) {
      setShowModal(true)
    }
  }

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return 'Unknown'
    }
  }

  return (
    <>
      <div
        onClick={handleImageClick}
        className="group relative overflow-hidden rounded-2xl bg-ink-800/50 border border-ink-700/30 hover:border-volt/40 transition-all duration-300 cursor-pointer shadow-md hover:shadow-lg hover:shadow-volt/10"
      >
        {/* Image Container with proper aspect ratio */}
        <div className="relative w-full pt-[100%] overflow-hidden bg-ink-900">
          {/* Skeleton Loading */}
          {isImageLoading && !imageError && (
            <div className="absolute inset-0 bg-gradient-to-r from-ink-800 via-ink-700 to-ink-800 animate-pulse" />
          )}

          {/* Fallback placeholder (blur-up effect) */}
          {!imageError && (
            <div
              className="absolute inset-0 bg-cover bg-center blur-md opacity-50"
              style={{
                backgroundImage: `url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"%3E%3Crect fill="%23262626" width="400" height="400"/%3E%3C/svg%3E')`
              }}
            />
          )}

          {/* Actual Image */}
          {!imageError ? (
            <img
              src={optimizedUrls.thumbnail}
              alt={photo.original_filename}
              onLoad={handleImageLoad}
              onError={handleImageError}
              loading="lazy"
              className={`absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-900/80 backdrop-blur-sm">
              <div className="text-center">
                <ImageOff size={40} className="text-ink-600 mx-auto mb-2" />
                <p className="text-xs text-ink-500">Image unavailable</p>
              </div>
            </div>
          )}

          {/* Dark Overlay with gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Action Buttons Container */}
          {!imageError && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowModal(true)
                }}
                className="p-3 mr-3 rounded-xl bg-volt/90 hover:bg-volt text-ink transition-all duration-200 shadow-lg hover:shadow-volt/50 backdrop-blur-md transform hover:scale-110"
                title="View fullscreen"
              >
                <ZoomIn size={20} strokeWidth={2.5} />
              </button>
              <button
                onClick={handleDownload}
                className="p-3 rounded-xl bg-ink-800/70 hover:bg-ink-800 text-volt transition-all duration-200 shadow-lg hover:shadow-volt/30 backdrop-blur-md transform hover:scale-110"
                title="Download photo"
              >
                <Download size={20} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="p-3.5">
          <p className="text-xs font-semibold text-volt/80 uppercase tracking-wide mb-1.5 truncate">
            {photo.event_name || 'Event'}
          </p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-ink-400 truncate">
              {photo.face_count > 0 ? `${photo.face_count} face${photo.face_count !== 1 ? 's' : ''}` : 'No faces'}
            </p>
            <p className="text-xs text-ink-500 whitespace-nowrap">{formatDate(photo.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Modal */}
      <PhotoModal photo={photo} isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for memo - return true if props are same (skip re-render)
  return prevProps.photo.id === nextProps.photo.id &&
         prevProps.photo.cloudinary_url === nextProps.photo.cloudinary_url
})

PhotoCard.displayName = 'PhotoCard'

export default PhotoCard
