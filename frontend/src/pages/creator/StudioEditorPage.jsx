/**
 * Video Studio — Full Editor Workspace
 * /creator/video-studio/:projectId
 *
 * Layout: Top toolbar | Left panel | Center canvas | Right properties | Bottom timeline
 *
 * Real features implemented:
 *   - Media upload (video/image/audio) + asset library
 *   - Timeline: video clips, text overlays, audio tracks, captions
 *   - Trim (numeric inputs + drag handles)
 *   - Text overlay (font size, color, alignment, position, timing)
 *   - Audio volume, mute
 *   - Caption editor (manual timed captions)
 *   - Aspect ratio selector (16:9, 9:16, 1:1)
 *   - Video preview (HTML5 video + canvas overlay for text/captions)
 *   - Autosave with debouncing
 *   - Undo/Redo history
 *   - Browser-side export via MediaRecorder + canvas
 *   - Submit exported video for admin review (existing pipeline)
 */
import {
  useState, useEffect, useRef, useCallback, useReducer
} from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import StudioNav from '../../components/layout/StudioNav'
import { motion, AnimatePresence } from 'framer-motion'
import { studioAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  Save, Undo2, Redo2, Play, Pause, SkipBack,
  Plus, Trash2, Type, Music, Image,
  Video, AlignLeft, AlignCenter, AlignRight,
  Download, Send, CheckCircle, Clapperboard,
  AlertCircle, Info, Loader, FileText
} from 'lucide-react'

// ─── Timeline state reducer ────────────────────────────────────────────────
const INITIAL_TIMELINE = {
  clips: [],         // { id, assetId, start, duration, durationKnown, trimIn, trimOut, muted, volume, type }
  textOverlays: [],  // { id, text, startTime, endTime, x, y, fontSize, color, align, bold, italic }
  audioTracks: [],   // { id, assetId, startTime, duration, volume, muted }
  captions: [],      // { id, startTime, endTime, text }
}

let _idCounter = Date.now()
const uid = () => ++_idCounter + ''

function timelineReducer(state, action) {
  switch (action.type) {
    // CLIPS
    case 'ADD_CLIP': return { ...state, clips: [...state.clips, action.clip] }
    case 'UPDATE_CLIP': return { ...state, clips: state.clips.map(c => c.id === action.id ? { ...c, ...action.changes } : c) }
    case 'REMOVE_CLIP': return { ...state, clips: state.clips.filter(c => c.id !== action.id) }
    case 'REORDER_CLIPS': return { ...state, clips: action.clips }
    // TEXT
    case 'ADD_TEXT': return { ...state, textOverlays: [...state.textOverlays, action.text] }
    case 'UPDATE_TEXT': return { ...state, textOverlays: state.textOverlays.map(t => t.id === action.id ? { ...t, ...action.changes } : t) }
    case 'REMOVE_TEXT': return { ...state, textOverlays: state.textOverlays.filter(t => t.id !== action.id) }
    // AUDIO
    case 'ADD_AUDIO': return { ...state, audioTracks: [...state.audioTracks, action.audio] }
    case 'UPDATE_AUDIO': return { ...state, audioTracks: state.audioTracks.map(a => a.id === action.id ? { ...a, ...action.changes } : a) }
    case 'REMOVE_AUDIO': return { ...state, audioTracks: state.audioTracks.filter(a => a.id !== action.id) }
    // CAPTIONS
    case 'ADD_CAPTION': return { ...state, captions: [...state.captions, action.caption] }
    case 'UPDATE_CAPTION': return { ...state, captions: state.captions.map(c => c.id === action.id ? { ...c, ...action.changes } : c) }
    case 'REMOVE_CAPTION': return { ...state, captions: state.captions.filter(c => c.id !== action.id) }
    case 'SET_TIMELINE': return action.timeline
    default: return state
  }
}

// ─── Undo/Redo stack ────────────────────────────────────────────────────────
// History and the cursor live in ONE state object so they can never drift out
// of sync. Keeping them in two separate useState (plus a render-synced ref)
// let batched updates increment the index past the end of history, which then
// fed `undefined` into functional updaters — see setTimeline(prev => ...).
const HISTORY_LIMIT = 30

function useUndoRedo(initial) {
  const [stack, setStack] = useState({ history: [initial], index: 0 })

  const present = stack.history[stack.index] ?? initial

  const set = useCallback((newStateOrFn) => {
    setStack(({ history, index }) => {
      // Resolve functional updates (setTimeline(prev => ...)) against the
      // current snapshot, exactly as useState would. `current` is always a
      // real entry because index is kept within bounds here.
      const current = history[index] ?? initial
      const newState = typeof newStateOrFn === 'function' ? newStateOrFn(current) : newStateOrFn
      // Drop any redo branch, append, and cap the stack length.
      const next = [...history.slice(0, index + 1), newState].slice(-HISTORY_LIMIT)
      return { history: next, index: next.length - 1 }
    })
  }, [initial])

  const undo = useCallback(() => {
    setStack(({ history, index }) => ({ history, index: Math.max(0, index - 1) }))
  }, [])

  const redo = useCallback(() => {
    setStack(({ history, index }) => ({ history, index: Math.min(history.length - 1, index + 1) }))
  }, [])

  const canUndo = stack.index > 0
  const canRedo = stack.index < stack.history.length - 1

  return { state: present, set, undo, redo, canUndo, canRedo }
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function StudioEditorPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('saved') // 'saving' | 'saved' | 'unsaved' | 'error'

  // Timeline state with undo/redo
  const { state: timeline, set: setTimeline, undo, redo, canUndo, canRedo } = useUndoRedo(INITIAL_TIMELINE)

  // Assets
  const [assets, setAssets] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Player
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [totalDuration, setTotalDuration] = useState(0)
  const videoRef = useRef(null)
  const playTimerRef = useRef(null)
  /**
   * What the <video> element is actually doing.
   * 'idle' | 'loading' | 'ready' | 'buffering' | 'error'
   *
   * The playhead below is a timeline clock, not the video's own clock, so it
   * would otherwise keep counting while nothing renders. This state is what
   * makes a failure visible instead of looking like silent playback.
   */
  const [videoState, setVideoState] = useState('idle')
  const [videoError, setVideoError] = useState(null)
  /** Intrinsic size reported by the element, for the real aspect ratio. */
  const [videoSize, setVideoSize] = useState(null)

  // Panel tabs
  const [leftTab, setLeftTab] = useState('media') // media | text | audio | captions
  const [selectedClipId, setSelectedClipId] = useState(null)
  const [selectedTextId, setSelectedTextId] = useState(null)
  const [selectedAudioId, setSelectedAudioId] = useState(null)

  // Export / render
  const [renderJob, setRenderJob] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitTitle, setSubmitTitle] = useState('')
  const [submitNotes, setSubmitNotes] = useState('')
  const [showSubmitModal, setShowSubmitModal] = useState(false)

  // AI panel

  // Debounce autosave
  const saveTimerRef = useRef(null)
  const latestTimelineRef = useRef(timeline)
  latestTimelineRef.current = timeline

  // ── Load project ─────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await studioAPI.getProject(projectId)
        const p = res.data
        setProject(p)
        setSubmitTitle(p.title)

        // Parse saved timeline — merge with INITIAL_TIMELINE so that fields
        // added after a project was saved (clips, audioTracks, captions…) always
        // have a valid array rather than undefined.
        if (p.timeline_json && p.timeline_json !== '{}') {
          try {
            const tl = JSON.parse(p.timeline_json)
            setTimeline({ ...INITIAL_TIMELINE, ...tl })
          } catch {}
        }

        setAssets(p.assets || [])

        // Load latest render job
        const jobsRes = await studioAPI.listRenderJobs({ project_id: projectId })
        const jobs = jobsRes.data || []
        if (jobs.length > 0) setRenderJob(jobs[0])

      } catch {
        toast.error('Failed to load project')
        navigate('/creator/video-studio')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  // ── Autosave on timeline changes ─────────────────────────────────────────
  useEffect(() => {
    setSaveStatus('unsaved')
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        const dur = computeTotalDuration(latestTimelineRef.current)
        await studioAPI.updateProject(projectId, {
          timeline_json: latestTimelineRef.current,
          duration: dur,
        })
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      }
    }, 1500)
    return () => clearTimeout(saveTimerRef.current)
  }, [timeline])

  // ── Compute total duration ────────────────────────────────────────────────
  function computeTotalDuration(tl) {
    const clipEnd = tl.clips.reduce((max, c) => {
      const end = (c.start || 0) + (c.duration || 0)
      return end > max ? end : max
    }, 0)
    const textEnd = tl.textOverlays.reduce((max, t) => {
      return (t.endTime || 0) > max ? (t.endTime || 0) : max
    }, 0)
    // No floor. A previous `Math.max(..., 5)` reported a 5-second timeline for
    // an empty project, so Play appeared to work with nothing to show - the
    // phantom "video plays but the picture is blank" symptom.
    return Math.max(clipEnd, textEnd)
  }

  useEffect(() => {
    setTotalDuration(computeTotalDuration(timeline))
  }, [timeline])

  // ── Preview playhead ─────────────────────────────────────────────────────
  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false)
      clearInterval(playTimerRef.current)
      return
    }
    // Never run the clock over an empty timeline or a failed video.
    if (timeline.clips.length === 0) {
      toast.error('Add a clip to the timeline before playing')
      return
    }
    if (videoState === 'error') {
      toast.error(videoError || 'This clip cannot be played')
      return
    }
    setIsPlaying(true)
    playTimerRef.current = setInterval(() => {
      setCurrentTime(t => {
        const next = t + 0.1
        if (next >= totalDuration) {
          setIsPlaying(false)
          clearInterval(playTimerRef.current)
          return totalDuration
        }
        return next
      })
    }, 100)
  }

  // Stop the clock if the current clip fails, so the timer can never advance
  // over a blank preview.
  useEffect(() => {
    if (videoState === 'error' && isPlaying) {
      setIsPlaying(false)
      clearInterval(playTimerRef.current)
    }
  }, [videoState, isPlaying])

  // Clear the player's error/ready state when the clip under the playhead changes.
  // A clip with duration===null has not been measured yet; still show it from its
  // start position so the <video> element can fire onLoadedMetadata and fill it in.
  const currentClipId = timeline.clips.find(c => {
    const s = c.start || 0
    return c.duration == null ? currentTime >= s : (currentTime >= s && currentTime < s + c.duration)
  })?.id || null
  useEffect(() => {
    setVideoState('idle')
    setVideoError(null)
    setVideoSize(null)
  }, [currentClipId])

  // Sync video element
  useEffect(() => {
    const currentClip = timeline.clips.find(c => {
      const s = c.start || 0
      return c.duration == null ? currentTime >= s : (currentTime >= s && currentTime < s + c.duration)
    })
    if (videoRef.current && currentClip && (currentClip.assetId || currentClip.assetUrl)) {
      const clipTime = currentTime - (currentClip.start || 0) + (currentClip.trimIn || 0)
      if (Math.abs(videoRef.current.currentTime - clipTime) > 0.5) {
        videoRef.current.currentTime = clipTime
      }
      if (isPlaying) {
        videoRef.current.play().catch(err => {
          // Previously `.catch(() => {})`, which hid every genuine failure.
          // NotAllowedError is just the browser's autoplay policy, not a broken
          // file, so it is reported separately.
          if (err?.name === 'NotAllowedError') {
            setVideoError('The browser blocked playback. Click the preview to start it.')
          } else {
            setVideoState('error')
            setVideoError(err?.message || 'The browser could not play this clip.')
          }
          setIsPlaying(false)
          clearInterval(playTimerRef.current)
        })
      } else {
        videoRef.current.pause()
      }
    }
  }, [currentTime, isPlaying, timeline.clips])

  // ── Media URL resolution ─────────────────────────────────────────────────
  /**
   * Stream URL for a clip or audio track.
   *
   * Resolved from `assetId` every time it is used, because the URL carries a
   * short-lived auth token. Projects saved before this change still have a
   * stale tokenised `assetUrl` baked into timeline_json; `assetId` is preferred
   * so those projects start working again, with the old field kept only as a
   * fallback for any clip that predates assetId.
   */
  const clipSrc = useCallback((clip) => {
    if (!clip) return null
    if (clip.assetId) return studioAPI.assetStreamUrl(clip.assetId)
    return clip.assetUrl || null
  }, [])

  // ── Leaving the editor ───────────────────────────────────────────────────
  /**
   * Called before any in-app navigation away from the editor.
   * Returns false to cancel.
   *
   * Two things can be lost by leaving: an autosave still in flight (the editor
   * saves on a 1.5s debounce) and a browser-side export. The export runs in this
   * page via canvas + MediaRecorder, so it genuinely cannot continue in the
   * background - we say so plainly rather than implying it survives.
   */
  const confirmLeave = useCallback(() => {
    if (exporting) {
      return window.confirm(
        'An export is still running.\n\n'
        + 'The export runs inside this page, so leaving will cancel it - it does '
        + 'not continue in the background. You would need to export again.\n\n'
        + 'Leave and cancel the export?'
      )
    }
    if (saveStatus === 'unsaved' || saveStatus === 'saving') {
      return window.confirm(
        'You have changes that have not finished saving.\n\n'
        + 'Leaving now may lose your most recent edit.\n\n'
        + 'Leave anyway?'
      )
    }
    if (saveStatus === 'error') {
      return window.confirm(
        'The last save failed, so recent changes are not stored.\n\n'
        + 'Leaving now will lose them. Leave anyway?'
      )
    }
    return true
  }, [exporting, saveStatus])

  // Same protection for closing the tab or using browser Back/refresh.
  useEffect(() => {
    const atRisk = exporting || saveStatus === 'unsaved' || saveStatus === 'saving' || saveStatus === 'error'
    if (!atRisk) return
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [exporting, saveStatus])

  // ── Asset upload ─────────────────────────────────────────────────────────
  const handleUpload = async (e, mediaType) => {
    const file = e.target.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    form.append('media_type', mediaType)
    form.append('project_id', projectId)
    setUploading(true)
    setUploadProgress(0)
    try {
      const res = await studioAPI.uploadAsset(form, p => setUploadProgress(p))
      const asset = res.data
      setAssets(a => [asset, ...a])

      // Put it straight on the timeline. Uploading used to only fill the asset
      // library, so a creator saw a "successful" upload and a still-blank
      // preview with no hint that a second click was needed.
      if (asset.media_type === 'video' || asset.media_type === 'image') {
        addClipFromAsset(asset, { silent: true })
        toast.success('Uploaded and added to the timeline')
      } else {
        toast.success('Audio uploaded - add it from the Audio tab')
      }

      if (asset.probe_note) {
        // Be candid when the file's metadata could not be read.
        toast(asset.probe_note, { icon: 'ℹ️', duration: 6000 })
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // Default on-screen time for a still image, which has no intrinsic duration.
  const IMAGE_CLIP_SECONDS = 5

  /**
   * Add an asset to the video track.
   *
   * The clip length comes from the duration the backend probed out of the file.
   * It used to fall back to a hardcoded 10 seconds, so the timeline and the
   * playback controls disagreed with the actual media. When the duration is
   * genuinely unknown the element reports it via onLoadedMetadata and the clip
   * is corrected then - nothing is silently invented.
   */
  const addClipFromAsset = (asset, { silent = false } = {}) => {
    if (asset.media_type !== 'video' && asset.media_type !== 'image') {
      toast.error('Add images and videos only to the video track')
      return
    }
    if (asset.media_type === 'video' && asset.has_video_track === false) {
      toast.error('This file has no video track, so it cannot show a picture. Add it under Audio instead.')
      return
    }

    const probed = Number(asset.duration)
    const hasProbedDuration = Number.isFinite(probed) && probed > 0
    const duration = asset.media_type === 'image'
      ? IMAGE_CLIP_SECONDS
      : (hasProbedDuration ? probed : null)

    const lastEnd = timeline.clips.reduce((m, c) => Math.max(m, (c.start || 0) + (c.duration || 0)), 0)
    const clip = {
      id: uid(),
      assetId: asset.id,
      // The stream URL is deliberately NOT stored here. It carries a short-lived
      // token, and persisting it into timeline_json meant a reopened project
      // served 401s into a muted catch. It is resolved at render time instead.
      type: asset.media_type,
      start: lastEnd,
      // null means "not known yet" - filled in from the element's metadata.
      duration,
      durationKnown: duration !== null,
      trimIn: 0,
      trimOut: duration,
      volume: 1,
      muted: false,
      label: asset.original_filename,
    }
    setTimeline({ ...timeline, clips: [...timeline.clips, clip] })
    setCurrentTime(lastEnd)
    if (!silent) {
      toast.success(
        hasProbedDuration || asset.media_type === 'image'
          ? 'Added to the timeline'
          : 'Added to the timeline - reading its length from the file'
      )
    }
  }

  /**
   * Correct a clip once the element reports the true duration. This is the only
   * path that can set a duration we did not get from the file itself.
   */
  const applyMeasuredDuration = (clipId, measured) => {
    if (!Number.isFinite(measured) || measured <= 0) return
    setTimeline(prev => {
      const clips = prev.clips.map(c => {
        if (c.id !== clipId || c.durationKnown) return c
        return { ...c, duration: measured, trimOut: c.trimOut ?? measured, durationKnown: true }
      })
      // Re-pack so later clips keep butting up against their predecessor.
      let cursor = 0
      const packed = clips.map(c => {
        const next = { ...c, start: cursor }
        cursor += c.duration || 0
        return next
      })
      return { ...prev, clips: packed }
    })
  }

  const addAudioFromAsset = (asset) => {
    if (asset.media_type !== 'audio') {
      toast.error('Select an audio file')
      return
    }
    const track = {
      id: uid(),
      assetId: asset.id,
      // Resolved via clipSrc() at use time - see the note there.
      startTime: 0,
      duration: asset.duration || 30,
      volume: 0.8,
      muted: false,
      label: asset.original_filename,
    }
    const next = { ...timeline, audioTracks: [...timeline.audioTracks, track] }
    setTimeline(next)
  }

  // ── Export (browser-side via MediaRecorder) ───────────────────────────────
  const handleExport = async () => {
    if (timeline.clips.length === 0) {
      toast.error('Add at least one video clip before exporting')
      return
    }
    setExporting(true)
    setExportProgress(0)
    try {
      // Create a render job record on the backend
      const jobRes = await studioAPI.startRenderJob({ project_id: parseInt(projectId) })
      const job = jobRes.data
      setRenderJob(job)

      toast('Exporting… this may take a moment', { icon: '⏳' })

      // Use canvas + MediaRecorder for browser-side export
      const canvas = document.createElement('canvas')
      const [w, h] = project?.aspect_ratio === '9:16' ? [720, 1280] :
                      project?.aspect_ratio === '1:1'  ? [720, 720]  : [1280, 720]
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')

      const stream = canvas.captureStream(25) // 25fps
      // Set up AudioContext to mix audio tracks into stream
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      let audioCtx = null
      let audioDest = null
      if (AudioContextClass) {
        try {
          audioCtx = new AudioContextClass()
          audioDest = audioCtx.createMediaStreamDestination()
          audioDest.stream.getAudioTracks().forEach(track => stream.addTrack(track))
        } catch (e) {
          console.warn('AudioContext not available for export:', e)
        }
      }

      // Detect genuinely supported MIME type
      let chosenMime = 'video/webm'
      const candidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4',
      ]
      for (const cand of candidates) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(cand)) {
          chosenMime = cand
          break
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType: chosenMime })
      const chunks = []
      recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data) }

      // Setup background audio elements
      const bgAudios = []
      if (audioCtx && audioDest && timeline.audioTracks && timeline.audioTracks.length > 0) {
        for (const track of timeline.audioTracks) {
          const trackSrc = clipSrc(track)
          if (!trackSrc) continue
          try {
            const a = new Audio()
            a.crossOrigin = 'anonymous'
            a.src = trackSrc
            const srcNode = audioCtx.createMediaElementSource(a)
            const gainNode = audioCtx.createGain()
            gainNode.gain.value = track.muted ? 0 : (track.volume ?? 1)
            srcNode.connect(gainNode)
            gainNode.connect(audioDest)
            bgAudios.push({ el: a, startTime: track.startTime || 0, started: false })
          } catch (e) {
            console.warn('Could not connect audio track to destination:', e)
          }
        }
      }

      // Render each clip sequentially
      let totalFrames = 0
      for (const clip of timeline.clips) {
        totalFrames += Math.round((clip.duration || 5) * 25)
      }
      let renderedFrames = 0
      let currentTimelineTime = 0

      recorder.start()
      for (const clip of timeline.clips) {
        const clipDur = clip.duration || 5
        const fps = 25
        const frames = Math.round(clipDur * fps)

        // Setup clip audio if video has sound and is unmuted
        let clipAudioEl = null
        const srcUrl = clipSrc(clip)
        if (clip.type !== 'image' && audioCtx && audioDest && !clip.muted && srcUrl) {
          try {
            clipAudioEl = new Audio()
            clipAudioEl.crossOrigin = 'anonymous'
            clipAudioEl.src = srcUrl
            clipAudioEl.currentTime = clip.trimIn || 0
            const cSrc = audioCtx.createMediaElementSource(clipAudioEl)
            const cGain = audioCtx.createGain()
            cGain.gain.value = clip.volume ?? 1
            cSrc.connect(cGain)
            cGain.connect(audioDest)
            clipAudioEl.play().catch(() => {})
          } catch (e) {
            console.warn('Clip audio attach error:', e)
          }
        }

        if (clip.type === 'image') {
          // Draw image for the clip duration
          const img = new window.Image()
          img.crossOrigin = 'anonymous'
          await new Promise(res => { img.onload = res; img.src = srcUrl })
          for (let f = 0; f < frames; f++) {
            ctx.fillStyle = '#000'
            ctx.fillRect(0, 0, w, h)
            const scale = Math.min(w / img.width, h / img.height)
            const sw = img.width * scale, sh = img.height * scale
            ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh)
            _drawOverlays(ctx, currentTimelineTime + f / fps, timeline, w, h)

            // Trigger background audio if reached start time
            for (const bg of bgAudios) {
              if (!bg.started && (currentTimelineTime + f / fps) >= bg.startTime) {
                bg.started = true
                bg.el.play().catch(() => {})
              }
            }

            await _sleep(1000 / fps)
            renderedFrames++
            setExportProgress(Math.round((renderedFrames / totalFrames) * 90))
          }
        } else {
          // Video clip
          const vid = document.createElement('video')
          vid.src = srcUrl
          vid.crossOrigin = 'anonymous'
          vid.muted = true
          await new Promise(res => { vid.onloadedmetadata = res })
          vid.currentTime = clip.trimIn || 0
          await _sleep(200)

          for (let f = 0; f < frames; f++) {
            ctx.fillStyle = '#000'
            ctx.fillRect(0, 0, w, h)
            ctx.drawImage(vid, 0, 0, w, h)
            _drawOverlays(ctx, currentTimelineTime + f / fps, timeline, w, h)

            // Trigger background audio if reached start time
            for (const bg of bgAudios) {
              if (!bg.started && (currentTimelineTime + f / fps) >= bg.startTime) {
                bg.started = true
                bg.el.play().catch(() => {})
              }
            }

            vid.currentTime = (clip.trimIn || 0) + f / fps
            await _sleep(1000 / fps)
            renderedFrames++
            setExportProgress(Math.round((renderedFrames / totalFrames) * 90))
          }
        }

        if (clipAudioEl) {
          clipAudioEl.pause()
        }
        currentTimelineTime += clipDur
      }

      // Stop any lingering background audio
      for (const bg of bgAudios) {
        bg.el.pause()
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {})
      }

      recorder.stop()
      await new Promise(res => { recorder.onstop = res })

      const outExt = chosenMime.startsWith('video/mp4') ? '.mp4' : '.webm'
      const blob = new Blob(chunks, { type: chosenMime })
      setExportProgress(95)

      // Upload to backend
      const formData = new FormData()
      formData.append('file', blob, `studio_export${outExt}`)
      await studioAPI.uploadRenderOutput(job.id, formData, p => setExportProgress(95 + Math.round(p * 0.05)))

      // Refresh job
      const refreshed = await studioAPI.getRenderJob(job.id)
      setRenderJob(refreshed.data)
      setExportProgress(100)
      toast.success('Export complete! Ready to submit for review.')
    } catch (err) {
      toast.error('Export failed: ' + (err.message || 'Unknown error'))
      if (renderJob?.id) {
        await studioAPI.failRenderJob(renderJob.id, err.message || 'Browser export failed').catch(() => {})
      }
    } finally {
      setExporting(false)
    }
  }

  function _drawOverlays(ctx, time, tl, w, h) {
    // Text overlays
    for (const t of tl.textOverlays) {
      if (time < t.startTime || time >= t.endTime) continue
      ctx.save()
      ctx.font = `${t.bold ? 'bold ' : ''}${t.fontSize || 32}px Inter, sans-serif`
      ctx.fillStyle = t.color || '#ffffff'
      ctx.textAlign = t.align || 'center'
      const x = t.align === 'left' ? (t.x || 0.05) * w :
                 t.align === 'right' ? (t.x || 0.95) * w : (t.x || 0.5) * w
      const y = (t.y || 0.85) * h
      ctx.shadowColor = 'rgba(0,0,0,0.8)'
      ctx.shadowBlur = 6
      ctx.fillText(t.text || '', x, y)
      ctx.restore()
    }
    // Captions
    for (const c of tl.captions) {
      if (time < c.startTime || time >= c.endTime) continue
      ctx.save()
      ctx.font = '24px Inter, sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.shadowColor = 'rgba(0,0,0,0.9)'
      ctx.shadowBlur = 8
      ctx.fillText(c.text || '', w / 2, h - 60)
      ctx.restore()
    }
  }

  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

  // ── Submit for admin review ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!renderJob || renderJob.status !== 'completed') {
      toast.error('Export your video first before submitting')
      return
    }
    if (renderJob.delivery_submission_id) {
      toast.error('This render has already been submitted for review')
      return
    }
    if (!project?.order_id) {
      toast.error('Link this project to an order before submitting for review')
      return
    }
    if (!submitTitle.trim()) {
      toast.error('Enter a title for the submission')
      return
    }
    setSubmitting(true)
    try {
      const res = await studioAPI.submitForReview(renderJob.id, {
        title: submitTitle,
        description: submitNotes,
      })
      toast.success('Submitted for admin review! 🎉')
      setRenderJob(j => ({ ...j, delivery_submission_id: res.data.delivery_submission_id }))
      setShowSubmitModal(false)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Helpers for selected item editing ────────────────────────────────────
  const selectedClip  = timeline.clips.find(c => c.id === selectedClipId) || null
  const selectedText  = timeline.textOverlays.find(t => t.id === selectedTextId) || null
  const selectedAudio = timeline.audioTracks.find(a => a.id === selectedAudioId) || null

  const updateClip  = (changes) => setTimeline({ ...timeline, clips: timeline.clips.map(c => c.id === selectedClipId ? { ...c, ...changes } : c) })
  const updateText  = (changes) => setTimeline({ ...timeline, textOverlays: timeline.textOverlays.map(t => t.id === selectedTextId ? { ...t, ...changes } : t) })
  const updateAudio = (changes) => setTimeline({ ...timeline, audioTracks: timeline.audioTracks.map(a => a.id === selectedAudioId ? { ...a, ...changes } : a) })

  const addText = () => {
    const t = {
      id: uid(), text: 'Your text here',
      startTime: currentTime, endTime: currentTime + 5,
      x: 0.5, y: 0.85, fontSize: 36, color: '#ffffff',
      align: 'center', bold: false,
    }
    const next = { ...timeline, textOverlays: [...timeline.textOverlays, t] }
    setTimeline(next)
    setSelectedTextId(t.id)
    setLeftTab('text')
  }

  const addCaption = () => {
    const c = { id: uid(), text: 'Caption text', startTime: currentTime, endTime: currentTime + 3 }
    const next = { ...timeline, captions: [...timeline.captions, c] }
    setTimeline(next)
    setLeftTab('captions')
  }

  const fmt = (s) => {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#14191E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'white' }}>
        <Loader size={36} style={{ animation: 'spin 1s linear infinite', marginBottom: 16 }} />
        <p>Loading Studio…</p>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="dark studio-layout" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#14191E', color: '#e2e8f0', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>

      {/* ── TOP TOOLBAR ──────────────────────────────────────────────────── */}
      <div style={{
        height: 52, background: '#191F24', borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', flexShrink: 0,
      }}>
        {/* Back / Creator Dashboard / Home. Guarded so an unsaved edit or a
            running export is never dropped silently. */}
        <StudioNav variant="dark" confirmLeave={confirmLeave}>
          <button
            type="button"
            onClick={() => { if (confirmLeave()) navigate('/creator/video-studio') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
              borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#e2e8f0', whiteSpace: 'nowrap',
            }}
          >
            <Clapperboard size={15} /> My Projects
          </button>
        </StudioNav>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />

        {/* Project title */}
        <input
          value={project?.title || ''}
          onChange={e => setProject(p => ({ ...p, title: e.target.value }))}
          onBlur={e => studioAPI.updateProject(projectId, { title: e.target.value }).catch(() => {})}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: '#f1f5f9', fontWeight: 700, fontSize: 14, minWidth: 160, maxWidth: 240,
          }}
        />

        {/* Save status */}
        <div style={{ fontSize: 12, color: saveStatus === 'saved' ? '#4ade80' : saveStatus === 'saving' ? '#fbbf24' : saveStatus === 'error' ? '#f87171' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {saveStatus === 'saving' && <Loader size={11} />}
          {saveStatus === 'saved' && <CheckCircle size={11} />}
          {saveStatus === 'error' && <AlertCircle size={11} />}
          {{ saving: 'Saving…', saved: 'Saved', unsaved: 'Unsaved changes', error: 'Save failed' }[saveStatus]}
        </div>

        <div style={{ flex: 1 }} />

        {/* Undo/Redo */}
        <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={_tbBtn(!canUndo)}>
          <Undo2 size={15} />
        </button>
        <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" style={_tbBtn(!canRedo)}>
          <Redo2 size={15} />
        </button>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />

        {/* Export */}
        <button
          onClick={handleExport}
          disabled={exporting || timeline.clips.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            background: '#222A31',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F2F4F7', cursor: 'pointer',
            fontWeight: 700, fontSize: 13, opacity: (exporting || timeline.clips.length === 0) ? 0.5 : 1,
          }}
        >
          {exporting ? <><Loader size={13} /> Exporting {exportProgress}%</> : <><Download size={13} /> Export</>}
        </button>

        {/* Submit for review */}
        <button
          onClick={() => setShowSubmitModal(true)}
          disabled={!renderJob || renderJob.status !== 'completed'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            background: renderJob?.status === 'completed' && !renderJob?.delivery_submission_id
              ? 'linear-gradient(135deg, #059669, #047857)'
              : '#222A31',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
            color: renderJob?.status === 'completed' ? 'white' : '#94a3b8',
            cursor: 'pointer',
            fontWeight: 700, fontSize: 13,
            opacity: (!renderJob || renderJob.status !== 'completed') ? 0.5 : 1,
          }}
        >
          {renderJob?.delivery_submission_id
            ? <><CheckCircle size={13} /> Submitted</>
            : <><Send size={13} /> Submit for Review</>
          }
        </button>
      </div>

      {/* ── MAIN AREA ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT PANEL */}
        <div style={{ width: 240, background: '#191F24', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', overflowX: 'auto' }}>
            {[
              { id: 'media', icon: <Video size={13} />, label: 'Media' },
              { id: 'text', icon: <Type size={13} />, label: 'Text' },
              { id: 'audio', icon: <Music size={13} />, label: 'Audio' },
              { id: 'captions', icon: <FileText size={13} />, label: 'Captions' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setLeftTab(tab.id)}
                style={{
                  flex: 1, padding: '10px 4px', fontSize: 10, fontWeight: 700,
                  background: leftTab === tab.id ? 'var(--color-accent-subtle)' : 'transparent',
                  border: 'none', color: leftTab === tab.id ? '#a78bfa' : 'var(--color-text-muted)',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  borderBottom: leftTab === tab.id ? '2px solid #7c3aed' : '2px solid transparent',
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {/* MEDIA TAB */}
            {leftTab === 'media' && (
              <div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {[
                    { type: 'video', label: '+ Video', accept: '.mp4,.webm,.mov' },
                    { type: 'image', label: '+ Image', accept: '.jpg,.jpeg,.png,.webp' },
                  ].map(u => (
                    <label key={u.type} style={{ flex: 1 }}>
                      <input type="file" accept={u.accept} style={{ display: 'none' }} onChange={e => handleUpload(e, u.type)} disabled={uploading} />
                      <div style={{ textAlign: 'center', padding: '7px 4px', background: 'var(--color-accent-subtle)', border: '1px dashed #7c3aed', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>
                        {uploading ? '…' : u.label}
                      </div>
                    </label>
                  ))}
                </div>
                {uploading && (
                  <div style={{ height: 4, background: 'var(--color-surface-muted)', borderRadius: 2, marginBottom: 12 }}>
                    <div style={{ height: 4, width: `${uploadProgress}%`, background: 'var(--color-accent)', borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>
                )}
                {assets.filter(a => a.media_type !== 'audio').map(asset => (
                  <div key={asset.id} style={{
                    background: '#14191E', borderRadius: 8, marginBottom: 8, overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                    <div style={{ height: 60, background: 'var(--color-surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {asset.media_type === 'video'
                        ? <Video size={20} color="#64748b" />
                        : <Image size={20} color="#64748b" />
                      }
                    </div>
                    <div style={{ padding: '6px 8px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>
                        {asset.original_filename}
                      </div>
                      <button
                        onClick={() => addClipFromAsset(asset)}
                        style={{ width: '100%', padding: '5px', background: 'var(--color-accent)', border: 'none', borderRadius: 5, color: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                      >
                        + Add to Timeline
                      </button>
                    </div>
                  </div>
                ))}
                {assets.filter(a => a.media_type !== 'audio').length === 0 && !uploading && (
                  <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, padding: '20px 0' }}>
                    Upload videos or images to get started
                  </div>
                )}
              </div>
            )}

            {/* TEXT TAB */}
            {leftTab === 'text' && (
              <div>
                <button
                  onClick={addText}
                  style={{ width: '100%', padding: '10px', background: 'var(--color-accent)', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Plus size={14} /> Add Text Overlay
                </button>
                {timeline.textOverlays.map(t => (
                  <div
                    key={t.id}
                    onClick={() => { setSelectedTextId(t.id); setSelectedClipId(null); setSelectedAudioId(null) }}
                    style={{
                      padding: '8px 10px', background: selectedTextId === t.id ? 'var(--color-accent-subtle)' : '#14191E',
                      borderRadius: 8, marginBottom: 6, cursor: 'pointer', border: selectedTextId === t.id ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.text}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{fmt(t.startTime)} – {fmt(t.endTime)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* AUDIO TAB */}
            {leftTab === 'audio' && (
              <div>
                <label>
                  <input type="file" accept=".mp3,.wav,.ogg,.aac,.m4a" style={{ display: 'none' }} onChange={e => handleUpload(e, 'audio')} disabled={uploading} />
                  <div style={{ textAlign: 'center', padding: '10px', background: 'var(--color-accent-subtle)', border: '1px dashed #7c3aed', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 14 }}>
                    {uploading ? '…' : '+ Upload Audio'}
                  </div>
                </label>
                {assets.filter(a => a.media_type === 'audio').map(asset => (
                  <div key={asset.id} style={{ padding: '8px 10px', background: '#14191E', borderRadius: 8, marginBottom: 6, border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Music size={11} style={{ marginRight: 4 }} />{asset.original_filename}
                    </div>
                    <button onClick={() => addAudioFromAsset(asset)} style={{ width: '100%', padding: '5px', background: 'var(--color-accent)', border: 'none', borderRadius: 5, color: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                      + Add to Timeline
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* CAPTIONS TAB */}
            {leftTab === 'captions' && (
              <div>
                <button onClick={addCaption} style={{ width: '100%', padding: '10px', background: 'var(--color-accent)', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Plus size={14} /> Add Caption
                </button>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 10, padding: '8px', background: '#14191E', borderRadius: 6 }}>
                  <Info size={11} style={{ marginRight: 4 }} />
                  Add and time your captions manually below.
                </div>
                {timeline.captions.map((c, i) => (
                  <div key={c.id} style={{ marginBottom: 8, background: '#14191E', borderRadius: 8, padding: '8px', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{fmt(c.startTime)} – {fmt(c.endTime)}</span>
                      <button onClick={() => setTimeline({ ...timeline, captions: timeline.captions.filter(x => x.id !== c.id) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 11 }}>✕</button>
                    </div>
                    <input
                      value={c.text}
                      onChange={e => setTimeline({ ...timeline, captions: timeline.captions.map(x => x.id === c.id ? { ...x, text: e.target.value } : x) })}
                      style={{ width: '100%', background: 'var(--color-surface-muted)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, padding: '5px', color: '#e2e8f0', fontSize: 12 }}
                    />
                    <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                      {['startTime', 'endTime'].map(field => (
                        <input
                          key={field}
                          type="number"
                          min={0}
                          step={0.1}
                          value={c[field]}
                          onChange={e => setTimeline({ ...timeline, captions: timeline.captions.map(x => x.id === c.id ? { ...x, [field]: parseFloat(e.target.value) || 0 } : x) })}
                          style={{ flex: 1, background: 'var(--color-surface-muted)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, padding: '4px', color: '#e2e8f0', fontSize: 11 }}
                          title={field === 'startTime' ? 'Start (s)' : 'End (s)'}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CENTER — Canvas + Controls */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#0d1422', overflow: 'hidden' }}>
          {/* Aspect ratio selector */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {['16:9', '9:16', '1:1'].map(r => (
              <button
                key={r}
                onClick={() => { setProject(p => ({ ...p, aspect_ratio: r })); studioAPI.updateProject(projectId, { aspect_ratio: r }) }}
                style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: 'pointer',
                  background: project?.aspect_ratio === r ? 'var(--color-accent)' : 'rgba(255,255,255,0.05)',
                  border: project?.aspect_ratio === r ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  color: project?.aspect_ratio === r ? 'white' : 'var(--color-text-muted)',
                }}
              >
                {ASPECT_ICONS[r]} {r}
              </button>
            ))}
          </div>

          {/* Preview canvas */}
          {(() => {
            const ar = project?.aspect_ratio || '16:9'
            const maxW = 520, maxH = 320
            const [sw, sh] = ar === '9:16' ? [maxH * 9/16, maxH] : ar === '1:1' ? [maxH, maxH] : [maxW, maxW * 9/16]
            const currentClip = timeline.clips.find(c => { const s = c.start || 0; return c.duration == null ? currentTime >= s : (currentTime >= s && currentTime < s + c.duration) })
            const activeCaptions = timeline.captions.filter(c => currentTime >= c.startTime && currentTime < c.endTime)
            const activeTexts = timeline.textOverlays.filter(t => currentTime >= t.startTime && currentTime < t.endTime)
            return (
              <div style={{ width: sw, height: sh, background: '#000', borderRadius: 8, position: 'relative', overflow: 'hidden', boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}>
{/* The media source is resolved here from assetId, not read from the
                    saved timeline, so a reopened project always gets a fresh token. */}
                {currentClip ? (
                  currentClip.type === 'image' ? (
                    <img
                      src={clipSrc(currentClip)}
                      alt={currentClip.label || 'Preview'}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                      onLoad={() => { setVideoState('ready'); setVideoError(null) }}
                      onError={() => {
                        setVideoState('error')
                        setVideoError('This image could not be loaded. It may have been removed from storage.')
                      }}
                    />
                  ) : (
                    <video
                      ref={videoRef}
                      key={currentClip.id}
                      src={clipSrc(currentClip)}
                      /* An explicit size guarantees the element is never laid
                         out at 0x0 - a zero-height video renders as nothing
                         while its timer still runs. */
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
                      muted={currentClip.muted}
                      playsInline
                      preload="metadata"
                      onLoadStart={() => setVideoState('loading')}
                      onLoadedMetadata={e => {
                        const el = e.currentTarget
                        setVideoSize({ w: el.videoWidth, h: el.videoHeight })
                        // videoWidth 0 with a readable duration means there is
                        // no picture to show - an audio-only file.
                        if (!el.videoWidth || !el.videoHeight) {
                          setVideoState('error')
                          setVideoError('This file has no video picture (audio only). Add it under the Audio tab instead.')
                          return
                        }
                        setVideoState('ready')
                        setVideoError(null)
                        applyMeasuredDuration(currentClip.id, el.duration)
                      }}
                      onCanPlay={() => setVideoState(v => (v === 'error' ? v : 'ready'))}
                      onWaiting={() => setVideoState(v => (v === 'error' ? v : 'buffering'))}
                      onPlaying={() => setVideoState('ready')}
                      onStalled={() => setVideoState(v => (v === 'error' ? v : 'buffering'))}
                      onError={e => {
                        // MediaError tells us *why*, so say so rather than
                        // leaving a silent black rectangle.
                        const code = e.currentTarget?.error?.code
                        const messages = {
                          1: 'Loading was aborted.',
                          2: 'A network error interrupted the video. Check your connection and retry.',
                          3: 'The video is corrupt or incompletely uploaded, so it cannot be decoded.',
                          4: 'This video format or codec is not supported by your browser. Re-export it as H.264 MP4.',
                        }
                        setVideoState('error')
                        setVideoError(messages[code] || 'The video could not be loaded.')
                        setIsPlaying(false)
                      }}
                    />
                  )
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', flexDirection: 'column', gap: 8, padding: 16, textAlign: 'center' }}>
                    <Video size={32} />
                    <span style={{ fontSize: 13 }}>
                      {timeline.clips.length === 0
                        ? 'Upload a video or image to start - it is added to the timeline automatically'
                        : 'No clip at this point on the timeline'}
                    </span>
                  </div>
                )}

                {/* Loading / buffering / error overlays. Without these a failure
                    is indistinguishable from a video that is simply dark. */}
                {currentClip && (videoState === 'loading' || videoState === 'buffering') && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: 8, background: 'rgba(0,0,0,0.45)', color: '#e2e8f0', pointerEvents: 'none',
                  }}>
                    <Loader size={22} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>
                      {videoState === 'loading' ? 'Loading video…' : 'Buffering…'}
                    </span>
                  </div>
                )}
                {currentClip && videoState === 'error' && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: 10, background: 'rgba(0,0,0,0.82)', color: '#fecaca',
                    padding: 20, textAlign: 'center',
                  }}>
                    <AlertCircle size={26} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, maxWidth: 330 }}>
                      {videoError || 'This clip could not be played.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setVideoState('loading')
                        setVideoError(null)
                        if (videoRef.current) videoRef.current.load()
                      }}
                      style={{
                        padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 7, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff',
                      }}
                    >
                      Retry
                    </button>
                  </div>
                )}
                {/* Text overlays */}
                {activeTexts.map(t => (
                  <div key={t.id} style={{
                    position: 'absolute',
                    left: `${(t.x || 0.5) * 100}%`,
                    top: `${(t.y || 0.85) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: Math.round((t.fontSize || 36) * sw / 1280),
                    fontWeight: t.bold ? 800 : 600,
                    color: t.color || '#fff',
                    textAlign: t.align || 'center',
                    textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                    pointerEvents: 'none', whiteSpace: 'nowrap',
                  }}>
                    {t.text}
                  </div>
                ))}
                {/* Captions */}
                {activeCaptions.map(c => (
                  <div key={c.id} style={{
                    position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                    fontSize: Math.round(18 * sw / 1280), color: '#fff', fontWeight: 600,
                    textShadow: '0 2px 6px rgba(0,0,0,0.95)', whiteSpace: 'nowrap', pointerEvents: 'none',
                    background: 'rgba(0,0,0,0.4)', padding: '3px 10px', borderRadius: 4,
                  }}>
                    {c.text}
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Playback controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <button onClick={() => { setCurrentTime(0); setIsPlaying(false) }} style={_ctrlBtn()}>
              <SkipBack size={14} />
            </button>
            <button onClick={togglePlay} style={{
              width: 38, height: 38, borderRadius: '50%', background: 'var(--color-accent)', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
            }}>
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 80, textAlign: 'center' }}>
              {fmt(currentTime)} / {fmt(totalDuration)}
            </span>
            {/* Seek bar */}
            <input
              type="range" min={0} max={Math.max(totalDuration, 0.1)} step={0.1} value={currentTime}
              disabled={totalDuration === 0}
              onChange={e => { setCurrentTime(parseFloat(e.target.value)); setIsPlaying(false) }}
              style={{ width: 200, accentColor: 'var(--color-accent)' }}
            />
          </div>

          {/* What the player is really doing, and the real file dimensions.
              A running timer alone is not evidence that anything is playing. */}
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-muted)', minHeight: 16, textAlign: 'center' }}>
            {timeline.clips.length === 0 ? (
              <span>Timeline is empty — nothing to play yet</span>
            ) : videoState === 'error' ? (
              <span style={{ color: '#f87171', fontWeight: 600 }}>Playback failed — see the message above</span>
            ) : videoSize ? (
              <span>
                {videoSize.w}×{videoSize.h}
                {Number.isFinite(Number(currentClip?.duration)) && Number(currentClip?.duration) > 0
                  ? ` · clip ${Number(currentClip.duration).toFixed(2)}s`
                  : ' · reading length…'}
                {videoState === 'ready' && ' · ready'}
              </span>
            ) : videoState === 'loading' || videoState === 'buffering' ? (
              <span>Loading media…</span>
            ) : null}
          </div>

          {/* Export status bar */}
          {renderJob && (
            <div style={{ marginTop: 12, padding: '8px 14px', background: 'var(--color-surface-muted)', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
              {renderJob.status === 'completed'
                ? <><CheckCircle size={13} color="#4ade80" /> <span style={{ color: '#4ade80', fontWeight: 700 }}>Export ready</span></>
                : renderJob.status === 'failed'
                  ? <><AlertCircle size={13} color="#f87171" /> <span style={{ color: '#f87171' }}>Export failed — {renderJob.error_message}</span></>
                  : <><Loader size={13} color="#a78bfa" /> <span style={{ color: '#a78bfa' }}>Rendering…</span></>
              }
              {renderJob.status === 'completed' && (
                <a href={studioAPI.renderDownloadUrl(renderJob.id)} target="_blank" rel="noreferrer" style={{ color: '#a78bfa', fontSize: 11, marginLeft: 4, fontWeight: 600 }}>
                  Preview export ↗
                </a>
              )}
              {renderJob.delivery_submission_id && (
                <span style={{ marginLeft: 6, color: '#4ade80', fontSize: 11, fontWeight: 700 }}>· Submitted #{renderJob.delivery_submission_id}</span>
              )}
            </div>
          )}
        </div>

        {/* RIGHT PANEL — Properties */}
        <div style={{ width: 220, background: 'var(--color-surface-muted)', borderLeft: '1px solid rgba(255,255,255,0.07)', padding: 14, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            Properties
          </div>

          {/* Clip properties */}
          {selectedClip && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 10 }}>Video Clip</div>
              <_PropRow label="Label">
                <input value={selectedClip.label || ''} onChange={e => updateClip({ label: e.target.value })} style={_propInput()} />
              </_PropRow>
              <_PropRow label="Start (s)">
                <input type="number" min={0} step={0.1} value={selectedClip.start} onChange={e => updateClip({ start: parseFloat(e.target.value) || 0 })} style={_propInput()} />
              </_PropRow>
              <_PropRow label="Duration (s)">
                <input type="number" min={0.1} step={0.1} value={selectedClip.duration} onChange={e => updateClip({ duration: parseFloat(e.target.value) || 1 })} style={_propInput()} />
              </_PropRow>
              <_PropRow label="Trim In (s)">
                <input type="number" min={0} step={0.1} value={selectedClip.trimIn || 0} onChange={e => updateClip({ trimIn: parseFloat(e.target.value) || 0 })} style={_propInput()} />
              </_PropRow>
              <_PropRow label="Volume">
                <input type="range" min={0} max={1} step={0.05} value={selectedClip.volume ?? 1} onChange={e => updateClip({ volume: parseFloat(e.target.value) })} style={{ width: '100%', accentColor: 'var(--color-accent)' }} />
              </_PropRow>
              <_PropRow label="Muted">
                <input type="checkbox" checked={selectedClip.muted} onChange={e => updateClip({ muted: e.target.checked })} />
              </_PropRow>
              <button onClick={() => { setTimeline({ ...timeline, clips: timeline.clips.filter(c => c.id !== selectedClipId) }); setSelectedClipId(null) }} style={{ width: '100%', marginTop: 10, padding: '7px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#f87171', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                Delete Clip
              </button>
            </div>
          )}

          {/* Text properties */}
          {selectedText && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 10 }}>Text Overlay</div>
              <_PropRow label="Text">
                <input value={selectedText.text} onChange={e => updateText({ text: e.target.value })} style={_propInput()} />
              </_PropRow>
              <_PropRow label="Start (s)">
                <input type="number" min={0} step={0.1} value={selectedText.startTime} onChange={e => updateText({ startTime: parseFloat(e.target.value) || 0 })} style={_propInput()} />
              </_PropRow>
              <_PropRow label="End (s)">
                <input type="number" min={0} step={0.1} value={selectedText.endTime} onChange={e => updateText({ endTime: parseFloat(e.target.value) || 0 })} style={_propInput()} />
              </_PropRow>
              <_PropRow label="Font size">
                <input type="number" min={10} max={120} value={selectedText.fontSize || 36} onChange={e => updateText({ fontSize: parseInt(e.target.value) })} style={_propInput()} />
              </_PropRow>
              <_PropRow label="Color">
                <input type="color" value={selectedText.color || '#ffffff'} onChange={e => updateText({ color: e.target.value })} style={{ border: 'none', background: 'none', cursor: 'pointer', width: 36, height: 28 }} />
              </_PropRow>
              <_PropRow label="Align">
                <div style={{ display: 'flex', gap: 4 }}>
                  {[['left', <AlignLeft size={12} />], ['center', <AlignCenter size={12} />], ['right', <AlignRight size={12} />]].map(([a, icon]) => (
                    <button key={a} onClick={() => updateText({ align: a })} style={{ padding: '4px 7px', borderRadius: 5, background: selectedText.align === a ? 'var(--color-accent)' : '#14191E', border: 'none', cursor: 'pointer', color: 'white' }}>
                      {icon}
                    </button>
                  ))}
                </div>
              </_PropRow>
              <_PropRow label="Bold">
                <input type="checkbox" checked={selectedText.bold || false} onChange={e => updateText({ bold: e.target.checked })} />
              </_PropRow>
              <_PropRow label="Y position">
                <input type="range" min={0} max={1} step={0.01} value={selectedText.y || 0.85} onChange={e => updateText({ y: parseFloat(e.target.value) })} style={{ width: '100%', accentColor: 'var(--color-accent)' }} />
              </_PropRow>
              <button onClick={() => { setTimeline({ ...timeline, textOverlays: timeline.textOverlays.filter(t => t.id !== selectedTextId) }); setSelectedTextId(null) }} style={{ width: '100%', marginTop: 10, padding: '7px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#f87171', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                Delete Text
              </button>
            </div>
          )}

          {/* Audio properties */}
          {selectedAudio && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 10 }}>Audio Track</div>
              <_PropRow label="Label">
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedAudio.label}</span>
              </_PropRow>
              <_PropRow label="Start (s)">
                <input type="number" min={0} step={0.1} value={selectedAudio.startTime} onChange={e => updateAudio({ startTime: parseFloat(e.target.value) || 0 })} style={_propInput()} />
              </_PropRow>
              <_PropRow label="Volume">
                <input type="range" min={0} max={1} step={0.05} value={selectedAudio.volume ?? 0.8} onChange={e => updateAudio({ volume: parseFloat(e.target.value) })} style={{ width: '100%', accentColor: 'var(--color-accent)' }} />
              </_PropRow>
              <_PropRow label="Muted">
                <input type="checkbox" checked={selectedAudio.muted} onChange={e => updateAudio({ muted: e.target.checked })} />
              </_PropRow>
              <button onClick={() => { setTimeline({ ...timeline, audioTracks: timeline.audioTracks.filter(a => a.id !== selectedAudioId) }); setSelectedAudioId(null) }} style={{ width: '100%', marginTop: 10, padding: '7px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#f87171', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                Delete Track
              </button>
            </div>
          )}

          {!selectedClip && !selectedText && !selectedAudio && (
            <div style={{ color: 'var(--color-border)', fontSize: 12, textAlign: 'center', marginTop: 20 }}>
              Select a clip, text, or audio track to edit its properties
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM TIMELINE ───────────────────────────────────────────── */}
      <div style={{
        height: 180, background: '#1a2235', borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
      }}>
        {/* Timeline header */}
        <div style={{ height: 28, background: '#14191E', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>Timeline</span>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
            {Array.from({ length: Math.ceil(totalDuration) }, (_, i) => (
              i % 5 === 0 ? <span key={i} style={{ fontSize: 9, color: 'var(--color-border)', position: 'absolute', left: `${(i / totalDuration) * 100}%`, transform: 'translateX(-50%)' }}>{fmt(i)}</span> : null
            ))}
          </div>
        </div>

        {/* Tracks */}
        <div className="studio-timeline-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', position: 'relative' }}>
          {/* Playhead */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: `${Math.max(0, Math.min(100, (currentTime / Math.max(totalDuration, 1)) * 100))}%`,
            width: 2, background: '#ef4444', zIndex: 10, pointerEvents: 'none',
          }} />

          {/* Video track */}
          <_TrackRow label="VIDEO" color="var(--color-accent)">
            {timeline.clips.map(clip => (
              <div
                key={clip.id}
                onClick={() => { setSelectedClipId(clip.id); setSelectedTextId(null); setSelectedAudioId(null) }}
                style={{
                  position: 'absolute',
                  left: `${((clip.start || 0) / Math.max(totalDuration, 1)) * 100}%`,
                  width: `${((clip.duration || 0) / Math.max(totalDuration, 1)) * 100}%`,
                  height: '80%', top: '10%',
                  background: selectedClipId === clip.id ? 'rgba(124,58,237,0.9)' : 'rgba(124,58,237,0.5)',
                  borderRadius: 5, cursor: 'pointer', border: selectedClipId === clip.id ? '2px solid #a78bfa' : '1px solid rgba(124,58,237,0.4)',
                  overflow: 'hidden', display: 'flex', alignItems: 'center', padding: '0 6px',
                  minWidth: 30,
                }}
              >
                <span style={{ fontSize: 10, color: 'white', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {clip.type === 'image' ? '🖼' : '🎬'} {clip.label || 'clip'}
                </span>
              </div>
            ))}
          </_TrackRow>

          {/* Text track */}
          <_TrackRow label="TEXT" color="#0891b2">
            {timeline.textOverlays.map(t => (
              <div
                key={t.id}
                onClick={() => { setSelectedTextId(t.id); setSelectedClipId(null); setSelectedAudioId(null) }}
                style={{
                  position: 'absolute',
                  left: `${(t.startTime / Math.max(totalDuration, 1)) * 100}%`,
                  width: `${((t.endTime - t.startTime) / Math.max(totalDuration, 1)) * 100}%`,
                  height: '80%', top: '10%',
                  background: selectedTextId === t.id ? 'rgba(8,145,178,0.9)' : 'rgba(8,145,178,0.5)',
                  borderRadius: 5, cursor: 'pointer', border: selectedTextId === t.id ? '2px solid #67e8f9' : '1px solid rgba(8,145,178,0.4)',
                  display: 'flex', alignItems: 'center', padding: '0 6px', minWidth: 20, overflow: 'hidden',
                }}
              >
                <span style={{ fontSize: 10, color: 'white', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  T {t.text}
                </span>
              </div>
            ))}
          </_TrackRow>

          {/* Audio track */}
          <_TrackRow label="AUDIO" color="#059669">
            {timeline.audioTracks.map(a => (
              <div
                key={a.id}
                onClick={() => { setSelectedAudioId(a.id); setSelectedClipId(null); setSelectedTextId(null) }}
                style={{
                  position: 'absolute',
                  left: `${(a.startTime / Math.max(totalDuration, 1)) * 100}%`,
                  width: `${(a.duration / Math.max(totalDuration, 1)) * 100}%`,
                  height: '80%', top: '10%',
                  background: selectedAudioId === a.id ? 'rgba(5,150,105,0.9)' : 'rgba(5,150,105,0.5)',
                  borderRadius: 5, cursor: 'pointer', border: selectedAudioId === a.id ? '2px solid #4ade80' : '1px solid rgba(5,150,105,0.4)',
                  display: 'flex', alignItems: 'center', padding: '0 6px', minWidth: 20, overflow: 'hidden',
                }}
              >
                <span style={{ fontSize: 10, color: 'white', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ♫ {a.label}
                </span>
              </div>
            ))}
          </_TrackRow>

          {/* Captions track */}
          <_TrackRow label="CAPTIONS" color="#d97706">
            {timeline.captions.map(c => (
              <div key={c.id} style={{
                position: 'absolute',
                left: `${(c.startTime / Math.max(totalDuration, 1)) * 100}%`,
                width: `${((c.endTime - c.startTime) / Math.max(totalDuration, 1)) * 100}%`,
                height: '80%', top: '10%',
                background: 'rgba(217,119,6,0.5)', borderRadius: 5,
                border: '1px solid rgba(217,119,6,0.4)',
                display: 'flex', alignItems: 'center', padding: '0 6px', minWidth: 20, overflow: 'hidden',
              }}>
                <span style={{ fontSize: 10, color: 'white', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  💬 {c.text}
                </span>
              </div>
            ))}
          </_TrackRow>
        </div>
      </div>

      {/* ── SUBMIT MODAL ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSubmitModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              style={{ background: '#191F24', borderRadius: 16, padding: 32, width: '100%', maxWidth: 440, border: '1px solid #343E47' }}
            >
              <h2 style={{ color: '#F2F4F7', fontWeight: 800, marginBottom: 8, fontSize: 20 }}>Submit for Admin Review</h2>
              {!project?.order_id && (
                <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 14, fontSize: 13, color: '#f87171' }}>
                  ⚠️ This project is not linked to an order. Go to the projects list and link it to an order first.
                </div>
              )}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#9AA7B2', display: 'block', marginBottom: 6 }}>Submission Title</label>
                <input value={submitTitle} onChange={e => setSubmitTitle(e.target.value)} style={{ width: '100%', background: '#14191E', border: '1px solid #343E47', borderRadius: 8, padding: '9px 12px', color: '#F2F4F7', fontSize: 14 }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#9AA7B2', display: 'block', marginBottom: 6 }}>Delivery Notes (optional)</label>
                <textarea value={submitNotes} onChange={e => setSubmitNotes(e.target.value)} rows={3} style={{ width: '100%', background: '#14191E', border: '1px solid #343E47', borderRadius: 8, padding: '9px 12px', color: '#F2F4F7', fontSize: 14, resize: 'vertical' }} placeholder="Describe what you've included in this delivery…" />
              </div>
              <div style={{ fontSize: 12, color: '#9AA7B2', marginBottom: 20, padding: '10px 12px', background: '#14191E', border: '1px solid #343E47', borderRadius: 8 }}>
                The exported video will go through admin review before the client can see it. This follows the existing AI CreatorHub approval workflow.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowSubmitModal(false)} style={{ flex: 1, padding: '11px', background: '#222A31', border: '1px solid #343E47', borderRadius: 10, cursor: 'pointer', color: '#BDC6CE', fontWeight: 600 }}>
                  Cancel
                </button>
                <button onClick={handleSubmit} disabled={submitting || !project?.order_id} style={{ flex: 2, padding: '11px', background: 'linear-gradient(135deg, #059669, #047857)', border: 'none', borderRadius: 10, cursor: 'pointer', color: 'white', fontWeight: 700, opacity: (!project?.order_id || submitting) ? 0.5 : 1 }}>
                  {submitting ? 'Submitting…' : 'Submit for Review'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────
const ASPECT_ICONS = { '16:9': '🖥️', '9:16': '📱', '1:1': '⬛' }

function _tbBtn(disabled) {
  return {
    padding: '5px 8px', background: disabled ? 'transparent' : 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: disabled ? 'var(--color-border)' : 'var(--color-text-muted)',
    cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
  }
}

function _ctrlBtn() {
  return {
    padding: '7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center',
  }
}

function _propInput() {
  return {
    width: '100%', background: '#14191E', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 5, padding: '5px 7px', color: '#e2e8f0', fontSize: 12,
  }
}

function _PropRow({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 10, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

function _TrackRow({ label, color, children }) {
  return (
    <div style={{ height: 36, display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', position: 'relative' }}>
      <div style={{ width: 70, fontSize: 9, fontWeight: 800, color, paddingLeft: 12, flexShrink: 0, letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        {children}
      </div>
    </div>
  )
}
