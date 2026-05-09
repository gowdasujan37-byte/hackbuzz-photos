import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowUp, ImageOff } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import PhotoCard from '../components/PhotoCard'

const API = import.meta.env.VITE_API_URL || ''

export default function HomePage() {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [failedImages, setFailedImages] = useState(new Set())
  const observerTarget = useRef(null)
  const loadingRef = useRef(false)

  // Fetch photos without dependency issues
  const fetchPhotos = useCallback(async (currentOffset) => {
    if (loadingRef.current || !hasMore) return
    
    loadingRef.current = true
    setLoading(true)
    try {
      console.log(`Fetching photos with offset=${currentOffset}`)
      const url = `${API}/api/upload/public/photos?limit=30&offset=${currentOffset}`
      console.log(`API URL: ${url}`)
      
      const res = await axios.get(url)
      console.log('API Response:', res.data)
      
      setPhotos(prev => [...prev, ...(res.data.photos || [])])
      setHasMore(res.data.has_more)
      setOffset(currentOffset + 30)
      
      // Preload next batch of images
      if (res.data.photos && res.data.photos.length > 0) {
        preloadImages(res.data.photos.slice(0, 6))
      }
    } catch (e) {
      console.error('Failed to fetch photos:', e.response?.status, e.message)
      toast.error(`Failed to load photos: ${e.message}`)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [hasMore])

  // Preload images for better performance
  const preloadImages = (imagesToPreload) => {
    imagesToPreload.forEach(photo => {
      if (!photo.cloudinary_url) return
      
      // Optimize URL for preload
      const url = photo.cloudinary_url.includes('upload/')
        ? photo.cloudinary_url.replace('/upload/', '/upload/q_auto,f_auto,w_400/')
        : photo.cloudinary_url
      
      const img = new Image()
      img.src = url
      img.onload = () => console.log(`Preloaded: ${photo.id}`)
      img.onerror = () => console.warn(`Failed to preload: ${photo.id}`)
    })
  }

  // Handle image load errors
  const handleImageError = (photoId, url) => {
    console.error(`Image failed to load - Photo ID: ${photoId}, URL: ${url}`)
    setFailedImages(prev => new Set([...prev, photoId]))
  }

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          fetchPhotos(offset)
        }
      },
      { threshold: 0.1 }
    )
    if (observerTarget.current) observer.observe(observerTarget.current)
    return () => observer.disconnect()
  }, [offset, hasMore, fetchPhotos])

  // Initial fetch
  useEffect(() => {
    console.log('HomePage mounted, fetching initial photos')
    fetchPhotos(0)
  }, [])

  // Scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Keyboard shortcut: ESC to hide scroll-top button
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showScrollTop) {
        setShowScrollTop(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showScrollTop])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDownload = async (photo) => {
    try {
      // Direct blob download for reliable one-click downloads
      const url = photo.cloudinary_url.includes('upload/')
        ? photo.cloudinary_url.replace('/upload/', '/upload/q_auto,f_auto/')
        : photo.cloudinary_url
      
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
    <div className="min-h-screen bg-ink">
      {/* Background Effects - Animated */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-volt/5 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-azure/5 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '8s', animationDelay: '1s' }} />
      </div>

      {/* Gallery Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white tracking-tight mb-2">
            Event Gallery
          </h1>
          <p className="text-ink-300 text-sm sm:text-base">
            {photos.length > 0 
              ? `Discover ${photos.length}+ event photos${failedImages.size > 0 ? ` (${failedImages.size} unavailable)` : ''}`
              : 'Loading your gallery...'
            }
          </p>
        </div>

        {/* Empty State */}
        {photos.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="mb-4 p-4 rounded-2xl bg-ink-800/50 border border-ink-700/30">
              <ImageOff size={48} className="text-ink-600 mx-auto" />
            </div>
            <h2 className="text-xl font-display font-semibold text-white mb-2">No photos yet</h2>
            <p className="text-ink-400 max-w-sm">
              Photos will appear here once photographers upload and process event images.
            </p>
          </div>
        ) : (
          <>
            {/* Responsive Masonry Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {photos.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  onDownload={handleDownload}
                  onImageError={handleImageError}
                />
              ))}
            </div>

            {/* Loading Skeleton */}
            {loading && (
              <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div 
                    key={i} 
                    className="rounded-2xl overflow-hidden bg-ink-800/50 border border-ink-700/30 shadow-md"
                    style={{ aspectRatio: '1' }}
                  >
                    <div className="w-full h-full bg-gradient-to-r from-ink-800 via-ink-700 to-ink-800 animate-pulse" />
                  </div>
                ))}
              </div>
            )}

            {/* Infinite Scroll Trigger */}
            {hasMore && (
              <div ref={observerTarget} className="text-center py-12 mt-8">
                {loading ? (
                  <div className="inline-flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-volt rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-volt rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-volt rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-ink-400 text-sm ml-2">Loading more photos</span>
                  </div>
                ) : (
                  <p className="text-ink-500 text-sm">Scroll to load more</p>
                )}
              </div>
            )}

            {/* End of Gallery Message */}
            {!hasMore && photos.length > 0 && (
              <div className="text-center py-12 mt-8">
                <p className="text-ink-500 text-sm">
                  You've reached the end • {photos.length} photos total
                </p>
              </div>
            )}
          </>
        )}
      </section>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-40 p-3 rounded-full bg-volt/90 hover:bg-volt text-ink transition-all duration-300 shadow-lg hover:shadow-volt/50 transform hover:scale-110 animate-in fade-in slide-in-from-bottom-4"
          title="Scroll to top (ESC)"
          aria-label="Scroll to top"
        >
          <ArrowUp size={20} strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}
