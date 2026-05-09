import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Upload, X, CheckCircle, AlertCircle, Image,
  Plus, FolderOpen, ChevronDown, AlertTriangle,
  SkipForward, RefreshCw, Eye
} from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || ''

// ─── tiny helper ─────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function UploadPage() {
  const [files, setFiles] = useState([])          // { id, file, preview, status: 'pending'|'duplicate'|'new' }
  const [uploading, setUploading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [results, setResults] = useState(null)
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(1)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [newEventName, setNewEventName] = useState('')
  const [progress, setProgress] = useState(0)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [duplicateInfo, setDuplicateInfo] = useState({}) // filename → existing record
  const [checked, setChecked] = useState(false)   // have we run the duplicate check?

  // ── fetch events ────────────────────────────────────────────────────────────
  const fetchEvents = async () => {
    try {
      const res = await axios.get(`${API}/api/upload/events`)
      setEvents(res.data.events || [])
    } catch { /* silent */ }
  }
  useEffect(() => { fetchEvents() }, [])

  // reset check state when event changes
  useEffect(() => {
    setChecked(false)
    setDuplicateInfo({})
    setFiles(prev => prev.map(f => ({ ...f, status: 'pending' })))
  }, [selectedEvent])

  // ── create event ────────────────────────────────────────────────────────────
  const createEvent = async () => {
    if (!newEventName.trim()) return
    try {
      const fd = new FormData()
      fd.append('name', newEventName)
      const res = await axios.post(`${API}/api/upload/event`, fd, { withCredentials: true })
      toast.success(`Event "${newEventName}" created!`)
      setNewEventName('')
      setShowNewEvent(false)
      await fetchEvents()
      setSelectedEvent(res.data.event_id)
    } catch { toast.error('Failed to create event') }
  }

  // ── dropzone ────────────────────────────────────────────────────────────────
  const onDrop = useCallback((acceptedFiles, rejected) => {
    if (rejected.length) toast.error(`${rejected.length} file(s) rejected. Only images under 20MB.`)
    const newFiles = acceptedFiles.map(f => ({
      file: f,
      id: Math.random().toString(36).substr(2, 9),
      preview: URL.createObjectURL(f),
      status: 'pending',
    }))
    setFiles(prev => [...prev, ...newFiles])
    setChecked(false)          // new files added → need re-check
    setDuplicateInfo({})
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxSize: 20 * 1024 * 1024,
    multiple: true,
  })

  const removeFile = (id) => {
    setFiles(prev => {
      const f = prev.find(f => f.id === id)
      if (f) URL.revokeObjectURL(f.preview)
      return prev.filter(f => f.id !== id)
    })
    setChecked(false)
  }

  // ── duplicate check ─────────────────────────────────────────────────────────
  const checkDuplicates = async () => {
    if (!files.length) return
    setChecking(true)
    try {
      const filenames = files.map(f => f.file.name)
      const res = await axios.post(
        `${API}/api/upload/check-duplicates?event_id=${selectedEvent}`,
        filenames,
        {
          headers: { 'Content-Type': 'application/json' },
          withCredentials: true,
        }
      )
      const dupes = res.data.duplicates  // { filename: { ... } }
      setDuplicateInfo(dupes)
      setFiles(prev => prev.map(f => ({
        ...f,
        status: dupes[f.file.name] ? 'duplicate' : 'new',
      })))
      setChecked(true)

      const dupeCount = Object.keys(dupes).length
      if (dupeCount === 0) {
        toast.success('No duplicates found — all files are new!')
      } else {
        toast(`${dupeCount} duplicate${dupeCount !== 1 ? 's' : ''} found.`, { icon: '⚠️' })
      }
    } catch (e) {
      toast.error('Duplicate check failed: ' + (e.response?.data?.detail || e.message))
    } finally {
      setChecking(false)
    }
  }

  // ── remove all duplicates from selection ────────────────────────────────────
  const removeDuplicates = () => {
    setFiles(prev => prev.filter(f => f.status !== 'duplicate'))
    setChecked(false)
    setDuplicateInfo({})
    toast.success('Duplicate files removed from selection')
  }

  // ── upload ──────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!files.length) return toast.error('No files selected')

    // If duplicates exist and user hasn't decided, warn them
    const dupeFiles = files.filter(f => f.status === 'duplicate')
    if (dupeFiles.length > 0 && skipDuplicates) {
      toast(`${dupeFiles.length} duplicate(s) will be skipped automatically.`, { icon: 'ℹ️' })
    }

    setUploading(true)
    setResults(null)
    setProgress(0)

    const BATCH_SIZE = 10
    let allResults = [], allErrors = [], allSkipped = []
    const batches = []
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      batches.push(files.slice(i, i + BATCH_SIZE))
    }

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b]
      const formData = new FormData()
      batch.forEach(({ file }) => formData.append('files', file))
      formData.append('event_id', selectedEvent)
      formData.append('event_folder', `facevent/event-${selectedEvent}`)
      formData.append('skip_duplicates', skipDuplicates)

      try {
        const res = await axios.post(`${API}/api/upload/photos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          withCredentials: true,
        })
        allResults  = [...allResults,  ...(res.data.results       || [])]
        allErrors   = [...allErrors,   ...(res.data.error_details || [])]
        allSkipped  = [...allSkipped,  ...(res.data.skipped_details || [])]
      } catch (e) {
        toast.error(`Batch ${b + 1} failed: ${e.message}`)
      }
      setProgress(Math.round(((b + 1) / batches.length) * 100))
    }

    setResults({
      success: allResults.length,
      errors: allErrors.length,
      skipped: allSkipped.length,
      results: allResults,
      error_details: allErrors,
      skipped_details: allSkipped,
    })
    setFiles([])
    setChecked(false)
    setDuplicateInfo({})
    setUploading(false)

    if (allResults.length) toast.success(`${allResults.length} photo(s) uploaded successfully!`)
    if (allSkipped.length) toast(`${allSkipped.length} duplicate(s) skipped.`, { icon: '⏭️' })
    if (allErrors.length)  toast.error(`${allErrors.length} file(s) failed`)
  }

  // ── computed ─────────────────────────────────────────────────────────────────
  const dupeCount = files.filter(f => f.status === 'duplicate').length
  const newCount  = files.filter(f => f.status === 'new').length

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <p className="label mb-2">Photographer Portal</p>
        <h1 className="text-4xl font-display font-semibold text-white mb-3">Upload Event Photos</h1>
        <p className="text-ink-300">Upload photos in bulk. Duplicate detection runs before upload so nothing is doubled up.</p>
      </div>

      {/* Event selector */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-white flex items-center gap-2">
            <FolderOpen size={18} className="text-volt" />
            Select Event
          </h2>
          <button
            onClick={() => setShowNewEvent(!showNewEvent)}
            className="flex items-center gap-1.5 text-xs text-volt hover:text-volt-400 transition-colors"
          >
            <Plus size={14} /> New Event
          </button>
        </div>

        {showNewEvent && (
          <div className="flex gap-3 mb-4 p-4 bg-ink-700/40 rounded-xl border border-ink-600/30">
            <input
              value={newEventName}
              onChange={e => setNewEventName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createEvent()}
              placeholder="Event name (e.g. College Fest 2025)"
              className="flex-1 bg-transparent text-white placeholder-ink-500 text-sm outline-none"
              autoFocus
            />
            <button onClick={createEvent} className="btn-primary py-1.5 px-4 text-xs">Create</button>
            <button onClick={() => setShowNewEvent(false)} className="text-ink-400 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        )}

        <div className="relative">
          <select
            value={selectedEvent}
            onChange={e => setSelectedEvent(Number(e.target.value))}
            className="w-full bg-ink-700/50 border border-ink-600/50 text-white rounded-xl px-4 py-3 text-sm appearance-none cursor-pointer focus:outline-none focus:border-volt/50"
          >
            {events.map(ev => (
              <option key={ev.id} value={ev.id} className="bg-ink-800">
                {ev.name} ({ev.photo_count} photos)
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        </div>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`card p-12 text-center cursor-pointer border-2 border-dashed transition-all duration-300 mb-6 ${
          isDragActive
            ? 'border-volt/60 bg-volt/5 glow-volt'
            : 'border-ink-600/40 hover:border-volt/30'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
            isDragActive ? 'bg-volt/20 scale-110' : 'bg-ink-700/50'
          }`}>
            <Upload size={28} className={isDragActive ? 'text-volt' : 'text-ink-400'} />
          </div>
          <div>
            <p className="font-display font-semibold text-white text-lg mb-1">
              {isDragActive ? 'Drop your photos here' : 'Drag & drop event photos'}
            </p>
            <p className="text-ink-400 text-sm">
              or <span className="text-volt underline">browse files</span> · JPG, PNG, WebP · Max 20MB each
            </p>
          </div>
          <div className="flex gap-4 text-xs text-ink-500">
            <span>✓ Bulk upload</span>
            <span>✓ Duplicate detection</span>
            <span>✓ Auto face indexing</span>
          </div>
        </div>
      </div>

      {/* File preview grid */}
      {files.length > 0 && (
        <div className="mb-6">
          {/* Summary bar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <p className="label">{files.length} file{files.length !== 1 ? 's' : ''} selected</p>
              {checked && (
                <div className="flex items-center gap-2 text-xs">
                  {newCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-volt/10 border border-volt/20 text-volt">
                      {newCount} new
                    </span>
                  )}
                  {dupeCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      {dupeCount} duplicate{dupeCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => setFiles([])} className="text-xs text-ink-400 hover:text-coral transition-colors">
              Clear all
            </button>
          </div>

          {/* Duplicate warning banner */}
          {checked && dupeCount > 0 && (
            <div className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-start gap-3 flex-1">
                <AlertTriangle size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-300">
                    {dupeCount} photo{dupeCount !== 1 ? 's' : ''} already exist in this event
                  </p>
                  <p className="text-xs text-amber-400/70 mt-0.5">
                    Files with a yellow border were previously uploaded. Choose an action below.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={removeDuplicates}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs hover:bg-amber-500/20 transition-all"
                >
                  <SkipForward size={12} /> Remove dupes
                </button>
                <button
                  onClick={() => setSkipDuplicates(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                    !skipDuplicates
                      ? 'bg-coral/20 border border-coral/40 text-coral'
                      : 'border border-ink-600/50 text-ink-400 hover:text-white'
                  }`}
                >
                  <RefreshCw size={12} /> Re-upload all
                </button>
              </div>
            </div>
          )}

          {/* Photo grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-72 overflow-y-auto pr-1">
            {files.map(({ id, preview, file, status }) => (
              <div key={id} className="relative group aspect-square">
                <img
                  src={preview}
                  alt={file.name}
                  className={`w-full h-full object-cover rounded-xl border-2 transition-all ${
                    status === 'duplicate'
                      ? 'border-amber-500/70 opacity-60'
                      : status === 'new'
                      ? 'border-volt/50'
                      : 'border-ink-600/30'
                  }`}
                />

                {/* Status badge */}
                {status === 'duplicate' && (
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-amber-500/90 text-amber-900 text-[9px] font-semibold leading-none">
                    DUP
                  </div>
                )}
                {status === 'new' && (
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-volt/90 text-ink text-[9px] font-semibold leading-none">
                    NEW
                  </div>
                )}

                {/* Hover: preview of existing duplicate */}
                {status === 'duplicate' && duplicateInfo[file.name] && (
                  <div className="absolute inset-0 rounded-xl bg-ink/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                    <Eye size={12} className="text-amber-400" />
                    <p className="text-[9px] text-amber-300 text-center leading-tight">
                      Uploaded {fmtDate(duplicateInfo[file.name].created_at)}
                    </p>
                    <p className="text-[9px] text-ink-400 text-center truncate w-full px-1">
                      {duplicateInfo[file.name].event_name}
                    </p>
                  </div>
                )}

                {/* Remove button */}
                <button
                  onClick={() => removeFile(id)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-ink/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-coral"
                >
                  <X size={10} />
                </button>

                <div className="absolute bottom-1 left-1 right-1">
                  <p className="text-[9px] text-ink-300 truncate bg-ink/70 rounded px-1 py-0.5 backdrop-blur-sm">
                    {file.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {files.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Check duplicates */}
          <button
            onClick={checkDuplicates}
            disabled={checking || uploading}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              checked
                ? 'border border-volt/30 text-volt bg-volt/5 hover:bg-volt/10'
                : 'border border-ink-500/50 text-white bg-ink-700/50 hover:bg-ink-700'
            }`}
          >
            {checking ? (
              <div className="w-4 h-4 border-2 border-volt/30 border-t-volt rounded-full animate-spin" />
            ) : (
              <AlertTriangle size={16} className={checked ? 'text-volt' : 'text-ink-300'} />
            )}
            {checking ? 'Checking...' : checked ? `Re-check (${dupeCount} dupes)` : 'Check Duplicates'}
          </button>

          {/* Skip duplicates toggle */}
          {checked && dupeCount > 0 && (
            <label className="flex items-center gap-2 px-4 py-3 rounded-xl border border-ink-600/50 cursor-pointer hover:border-ink-500/50 transition-colors select-none">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={e => setSkipDuplicates(e.target.checked)}
                className="accent-volt w-4 h-4 cursor-pointer"
              />
              <span className="text-sm text-ink-200">Skip duplicates on upload</span>
            </label>
          )}

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={uploading || checking}
            className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-volt text-ink hover:bg-volt-400"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />
                Uploading... {progress}%
              </>
            ) : (
              <>
                <Upload size={16} />
                {checked && skipDuplicates && dupeCount > 0
                  ? `Upload ${files.length - dupeCount} New Photo${(files.length - dupeCount) !== 1 ? 's' : ''}`
                  : `Upload ${files.length} Photo${files.length !== 1 ? 's' : ''}`
                }
              </>
            )}
          </button>
        </div>
      )}

      {/* Progress bar */}
      {uploading && (
        <div className="mb-6">
          <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-volt to-azure rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-ink-400 mt-2 text-center">
            Uploading batch... face indexing runs automatically in the background.
          </p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="card p-6">
          <h2 className="font-display font-semibold text-white mb-4">Upload Results</h2>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-volt/10 border border-volt/20 rounded-xl p-4 text-center">
              <div className="text-3xl font-display font-semibold text-volt mb-1">{results.success}</div>
              <div className="label text-volt/70">Uploaded</div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
              <div className="text-3xl font-display font-semibold text-amber-400 mb-1">{results.skipped}</div>
              <div className="label text-amber-400/70">Skipped</div>
            </div>
            <div className="bg-coral/10 border border-coral/20 rounded-xl p-4 text-center">
              <div className="text-3xl font-display font-semibold text-coral mb-1">{results.errors}</div>
              <div className="label text-coral/70">Errors</div>
            </div>
          </div>

          {results.results.length > 0 && (
            <div className="mb-4">
              <p className="label mb-3">Successfully Uploaded</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {results.results.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm p-2 rounded-lg bg-ink-700/30">
                    <CheckCircle size={14} className="text-volt flex-shrink-0" />
                    <span className="text-ink-200 truncate flex-1">{r.filename}</span>
                    <span className="text-ink-500 text-xs">Processing faces...</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.skipped_details.length > 0 && (
            <div className="mb-4">
              <p className="label mb-3">Skipped (already existed)</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {results.skipped_details.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <SkipForward size={14} className="text-amber-400 flex-shrink-0" />
                    <span className="text-ink-200 truncate flex-1">{s.filename}</span>
                    <span className="text-amber-400/70 text-xs">{s.event_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.error_details.length > 0 && (
            <div>
              <p className="label mb-3">Errors</p>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {results.error_details.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm p-2 rounded-lg bg-coral/5">
                    <AlertCircle size={14} className="text-coral flex-shrink-0" />
                    <span className="text-ink-200 truncate flex-1">{e.filename}</span>
                    <span className="text-coral text-xs">{e.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}