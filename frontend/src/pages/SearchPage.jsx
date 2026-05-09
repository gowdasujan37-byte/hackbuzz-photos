import { useState, useRef, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Camera, Upload, Search, X, Download, ExternalLink, ZoomIn, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || ''

export default function SearchPage() {
  const [selfie, setSelfie] = useState(null) // { file, preview }
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState(null)
  const [viewMode, setViewMode] = useState('upload') // 'upload' | 'camera'
  const [lightboxImg, setLightboxImg] = useState(null)
  const [tolerance, setTolerance] = useState(0.5)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)

  const onDrop = useCallback((accepted) => {
    if (!accepted.length) return
    const file = accepted[0]
    setSelfie({ file, preview: URL.createObjectURL(file) })
    setResults(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  })

  const startCamera = async () => {
    setViewMode('camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (e) {
      toast.error('Could not access camera. Please upload a photo instead.')
      setViewMode('upload')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setViewMode('upload')
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' })
      setSelfie({ file, preview: URL.createObjectURL(blob) })
      setResults(null)
      stopCamera()
    }, 'image/jpeg', 0.9)
  }

  const handleSearch = async () => {
    if (!selfie) return toast.error('Please upload or capture your selfie first')
    setSearching(true)
    setResults(null)

    const formData = new FormData()
    formData.append('file', selfie.file)

    try {
      const res = await axios.post(`${API}/api/search/face?tolerance=${tolerance}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResults(res.data)
      if (res.data.total === 0) {
        toast('No photos found. Try adjusting the sensitivity or check if event photos are uploaded.', { icon: '🔍' })
      } else {
        toast.success(`Found ${res.data.total} photo${res.data.total !== 1 ? 's' : ''} with your face!`)
      }
    } catch (e) {
      const detail = e.response?.data?.detail || 'Search failed. Please try again.'
      toast.error(detail)
    } finally {
      setSearching(false)
    }
  }

  const downloadAll = async () => {
    if (!results?.matches) return
    
    for (let i = 0; i < results.matches.length; i++) {
      const m = results.matches[i]
      setTimeout(async () => {
        try {
          // Direct blob download for reliable downloads
          const response = await fetch(m.cloudinary_url)
          const blob = await response.blob()
          const link = document.createElement('a')
          link.href = URL.createObjectURL(blob)
          link.download = m.original_filename || `event-photo-${i + 1}.jpg`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(link.href)
        } catch (err) {
          console.error(`Failed to download photo ${i + 1}:`, err)
        }
      }, i * 300)
    }
    toast.success(`Downloading ${results.matches.length} photo${results.matches.length !== 1 ? 's' : ''}...`)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <p className="label mb-2">Student Portal</p>
        <h1 className="text-4xl font-display font-semibold text-white mb-3">Find Your Photos</h1>
        <p className="text-ink-300">Upload your selfie or use your camera. We'll find all your event photos instantly.</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Left: selfie input */}
        <div className="lg:col-span-2 space-y-5">
          {/* Mode tabs */}
          <div className="flex rounded-xl bg-ink-800/50 border border-ink-700/50 p-1 gap-1">
            <button
              onClick={() => { stopCamera(); setViewMode('upload') }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                viewMode === 'upload'
                  ? 'bg-ink-600 text-white'
                  : 'text-ink-400 hover:text-white'
              }`}
            >
              <Upload size={14} /> Upload
            </button>
            <button
              onClick={startCamera}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                viewMode === 'camera'
                  ? 'bg-ink-600 text-white'
                  : 'text-ink-400 hover:text-white'
              }`}
            >
              <Camera size={14} /> Camera
            </button>
          </div>

          {/* Camera view */}
          {viewMode === 'camera' && (
            <div className="card overflow-hidden">
              <div className="relative bg-ink-900 aspect-square">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* Face guide overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-volt/60 rounded-full relative">
                    <div className="absolute inset-0 rounded-full overflow-hidden">
                      <div className="scan-line absolute w-full h-1 bg-gradient-to-b from-transparent via-volt/40 to-transparent" />
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                  <button
                    onClick={capturePhoto}
                    className="w-14 h-14 bg-volt rounded-full flex items-center justify-center hover:bg-volt-400 transition-colors shadow-lg"
                  >
                    <Camera size={22} className="text-ink" />
                  </button>
                  <button
                    onClick={stopCamera}
                    className="w-10 h-10 bg-ink-700 rounded-full flex items-center justify-center hover:bg-ink-600 transition-colors self-center"
                  >
                    <X size={16} className="text-white" />
                  </button>
                </div>
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <p className="text-center text-xs text-ink-400 py-3">Position your face in the circle</p>
            </div>
          )}

          {/* Upload dropzone */}
          {viewMode === 'upload' && (
            <div
              {...getRootProps()}
              className={`card border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-300 ${
                isDragActive ? 'border-volt/60 bg-volt/5' : 'border-ink-600/40 hover:border-volt/30'
              }`}
            >
              <input {...getInputProps()} />
              {selfie ? (
                <div className="relative">
                  <img
                    src={selfie.preview}
                    alt="Your selfie"
                    className="w-32 h-32 object-cover rounded-2xl mx-auto border-2 border-volt/50"
                  />
                  <button
                    onClick={e => { e.stopPropagation(); setSelfie(null); setResults(null) }}
                    className="absolute -top-2 -right-2 left-auto w-6 h-6 bg-coral rounded-full flex items-center justify-center hover:bg-coral/80 transition-colors"
                  >
                    <X size={12} className="text-white" />
                  </button>
                  <p className="text-xs text-ink-300 mt-3">Click to change photo</p>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 bg-azure/10 border border-azure/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Camera size={24} className="text-azure" />
                  </div>
                  <p className="font-display font-semibold text-white mb-1">Upload your selfie</p>
                  <p className="text-ink-400 text-sm">Drag & drop or click · JPG, PNG · Max 10MB</p>
                </>
              )}
            </div>
          )}

          {/* Sensitivity slider */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="label">Match Sensitivity</label>
              <span className="font-mono text-xs text-volt">{tolerance === 0.4 ? 'Strict' : tolerance === 0.5 ? 'Balanced' : 'Loose'}</span>
            </div>
            <input
              type="range"
              min="0.4"
              max="0.65"
              step="0.05"
              value={tolerance}
              onChange={e => setTolerance(parseFloat(e.target.value))}
              className="w-full accent-volt cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-ink-500 mt-1">
              <span>Strict</span>
              <span>Balanced</span>
              <span>Loose</span>
            </div>
          </div>

          {/* Search button */}
          <button
            onClick={handleSearch}
            disabled={!selfie || searching}
            className="w-full py-4 rounded-xl font-semibold text-base transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed bg-azure text-white hover:bg-azure-500"
          >
            {searching ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search size={18} />
                Find My Photos
              </>
            )}
          </button>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-3">
          {!results && !searching && (
            <div className="card h-full flex flex-col items-center justify-center p-16 text-center border-dashed border-2 border-ink-700/40">
              <div className="w-20 h-20 bg-ink-700/50 rounded-2xl flex items-center justify-center mb-5">
                <Search size={32} className="text-ink-500" />
              </div>
              <h3 className="font-display font-semibold text-white text-xl mb-2">Your photos will appear here</h3>
              <p className="text-ink-400 text-sm max-w-xs">Upload your selfie and hit search to find all event photos where you appear</p>
            </div>
          )}

          {searching && (
            <div className="card h-full flex flex-col items-center justify-center p-16 text-center">
              <div className="w-24 h-24 bg-azure/10 border-2 border-azure/30 rounded-full flex items-center justify-center mb-6 relative">
                <Camera size={36} className="text-azure" />
                <div className="absolute inset-0 rounded-full border-2 border-azure/20 animate-ping" />
              </div>
              <h3 className="font-display font-semibold text-white text-xl mb-2">Scanning faces...</h3>
              <p className="text-ink-400 text-sm">Comparing your face against all stored event photos</p>
              <div className="mt-6 w-48 h-1.5 bg-ink-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-azure to-volt rounded-full animate-pulse w-full" />
              </div>
            </div>
          )}

          {results && (
            <div>
              {/* Result header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-display font-semibold text-white text-xl">
                    {results.total > 0 ? `${results.total} photo${results.total !== 1 ? 's' : ''} found` : 'No photos found'}
                  </h2>
                  <p className="text-ink-400 text-sm mt-0.5">{results.message}</p>
                </div>
                {results.total > 0 && (
                  <button
                    onClick={downloadAll}
                    className="flex items-center gap-2 text-sm text-ink-300 hover:text-volt transition-colors"
                  >
                    <Download size={14} />
                    Download All
                  </button>
                )}
              </div>

              {/* Photo grid */}
              {results.total > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {results.matches.map((match, i) => (
                    <div
                      key={i}
                      className="photo-card group relative rounded-2xl overflow-hidden border border-ink-600/30 cursor-pointer"
                      onClick={() => setLightboxImg(match)}
                    >
                      <img
                        src={match.cloudinary_url}
                        alt={match.original_filename}
                        className="w-full aspect-square object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-white font-medium truncate">{match.event_name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <CheckCircle size={10} className="text-volt" />
                              <span className="text-[10px] text-volt">{match.confidence}% match</span>
                            </div>
                          </div>
                          <ZoomIn size={14} className="text-white" />
                        </div>
                      </div>
                      {/* Confidence badge */}
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-volt/90 text-ink text-[10px] font-mono font-semibold">
                        {match.confidence}%
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card p-12 text-center">
                  <p className="text-4xl mb-4">🔍</p>
                  <h3 className="font-display font-semibold text-white mb-2">No matches found</h3>
                  <p className="text-ink-400 text-sm">
                    Try increasing the sensitivity slider, or check if the event photos have been uploaded and processed.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-ink/95 backdrop-blur-xl flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxImg(null)}
              className="absolute -top-12 right-0 text-ink-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            <img
              src={lightboxImg.cloudinary_url}
              alt={lightboxImg.original_filename}
              className="w-full max-h-[80vh] object-contain rounded-2xl"
            />
            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-white font-medium">{lightboxImg.original_filename}</p>
                <p className="text-ink-400 text-sm">{lightboxImg.event_name} · {lightboxImg.confidence}% confidence</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    try {
                      // Direct blob download
                      const response = await fetch(lightboxImg.cloudinary_url)
                      const blob = await response.blob()
                      const link = document.createElement('a')
                      link.href = URL.createObjectURL(blob)
                      link.download = lightboxImg.original_filename || 'photo.jpg'
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                      URL.revokeObjectURL(link.href)
                      toast.success('Download started')
                    } catch (err) {
                      console.error('Download failed:', err)
                      toast.error('Download failed')
                    }
                  }}
                  className="btn-primary flex items-center gap-2"
                >
                  <Download size={14} /> Download
                </button>
                <a
                  href={lightboxImg.cloudinary_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline flex items-center gap-2"
                >
                  <ExternalLink size={14} /> Open
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
