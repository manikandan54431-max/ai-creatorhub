/**
 * Creator-only AI Generator (PixVerse text-to-video).
 *
 * A separate page from Video Studio. The creator writes a prompt, picks a few
 * supported options, and generates a draft video. Generation is asynchronous:
 * the backend submits the task and a worker polls to completion, so this page
 * polls the job status and does not depend on staying open.
 *
 * Generated videos are PRIVATE DRAFTS. Saving to My Media or opening in Video
 * Studio never submits to a client or bypasses the delivery/review workflow.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Sparkles, Wand2, Download, Save, Clapperboard, ArrowLeft, Home,
  Loader, AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw,
} from 'lucide-react'

import { aiGeneratorAPI, aiAPI } from '../../services/api'
import { formatDate } from '../../utils/format'

const ACTIVE = ['queued', 'generating', 'saving_output']

const STATUS_META = {
  queued:        { label: 'Queued',        bg: '#fef3c7', color: '#92400e', icon: Clock },
  generating:    { label: 'Generating',    bg: '#e0f2fe', color: '#075985', icon: Loader },
  saving_output: { label: 'Saving Output', bg: '#e0f2fe', color: '#075985', icon: Loader },
  completed:     { label: 'Completed',     bg: '#d1fae5', color: '#065f46', icon: CheckCircle },
  failed:        { label: 'Failed',        bg: '#fee2e2', color: '#991b1b', icon: XCircle },
}

export default function AIGeneratorPage() {
  const navigate = useNavigate()

  const [config, setConfig] = useState(null)
  const [configError, setConfigError] = useState(null)
  const [loadingConfig, setLoadingConfig] = useState(true)

  const [prompt, setPrompt] = useState('')
  const [improvingPrompt, setImprovingPrompt] = useState(false)
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [quality, setQuality] = useState('540p')
  const [duration, setDuration] = useState(5)

  const [submitting, setSubmitting] = useState(false)
  const [activeJob, setActiveJob] = useState(null)
  const [jobs, setJobs] = useState([])
  const [jobsError, setJobsError] = useState(false)
  const [busyAction, setBusyAction] = useState(false)

  const pollRef = useRef(null)

  const loadConfig = useCallback(async () => {
    setLoadingConfig(true)
    setConfigError(null)
    try {
      const res = await aiGeneratorAPI.getConfig()
      setConfig(res.data)
      const d = res.data?.defaults || {}
      if (d.aspect_ratio) setAspectRatio(d.aspect_ratio)
      if (d.quality) setQuality(d.quality)
      if (d.duration) setDuration(d.duration)
    } catch {
      setConfigError('Could not load the AI Generator. Please retry.')
    } finally {
      setLoadingConfig(false)
    }
  }, [])

  const loadJobs = useCallback(async () => {
    try {
      const res = await aiGeneratorAPI.listJobs()
      setJobs(res.data || [])
      setJobsError(false)
      // Resume tracking an in-flight job after a refresh.
      const inflight = (res.data || []).find(j => ACTIVE.includes(j.status))
      if (inflight && !activeJob) setActiveJob(inflight)
    } catch {
      setJobsError(true)
    }
  }, [activeJob])

  useEffect(() => { loadConfig(); loadJobs() }, [loadConfig, loadJobs])

  // Poll the active job until it leaves an active state.
  useEffect(() => {
    if (!activeJob || !ACTIVE.includes(activeJob.status)) return
    pollRef.current = setInterval(async () => {
      try {
        const res = await aiGeneratorAPI.getJob(activeJob.id)
        const j = res.data
        setActiveJob(j)
        setJobs(prev => prev.map(p => p.id === j.id ? j : p))
        if (!ACTIVE.includes(j.status)) {
          clearInterval(pollRef.current)
          if (j.status === 'completed') toast.success('Your AI video is ready.')
          else if (j.status === 'failed') toast.error(j.error_message || 'Generation failed.')
        }
      } catch { /* keep trying on next tick */ }
    }, 4000)
    return () => clearInterval(pollRef.current)
  }, [activeJob?.id, activeJob?.status])

  const handleGenerate = async () => {
    const p = prompt.trim()
    if (p.length < 3) { toast.error('Please enter a longer prompt.'); return }
    if (submitting || (activeJob && ACTIVE.includes(activeJob.status))) return
    setSubmitting(true)
    try {
      const res = await aiGeneratorAPI.generate({ prompt: p, aspect_ratio: aspectRatio, quality, duration })
      const job = res.data.job
      setActiveJob(job)
      setJobs(prev => [job, ...prev.filter(x => x.id !== job.id)])
      if (res.data.deduplicated) toast('Using your recent identical request.', { icon: 'ℹ️' })
      else toast.success('Generation started.')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not start generation.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleImprovePrompt = async () => {
    const p = prompt.trim()
    if (p.length < 3) { toast.error('Enter a rough idea first.'); return }
    setImprovingPrompt(true)
    try {
      const res = await aiAPI.improvePrompt(p)
      if (res.data?.result) {
        setPrompt(res.data.result)
        toast.success('Gemini improved your video prompt.')
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not improve the prompt.')
    } finally {
      setImprovingPrompt(false)
    }
  }

  const handleSaveToMedia = async (job) => {
    setBusyAction(true)
    try {
      await aiGeneratorAPI.saveToMedia(job.id)
      toast.success('Saved to My Media (Video Studio library).')
      loadJobs()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not save to My Media.')
    } finally { setBusyAction(false) }
  }

  const handleOpenInStudio = async (job) => {
    setBusyAction(true)
    try {
      const res = await aiGeneratorAPI.openInStudio(job.id)
      toast.success('Opening in Video Studio…')
      navigate(`/creator/video-studio/${res.data.project_id}`)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not open in Video Studio.')
    } finally { setBusyAction(false) }
  }

  const handleRetrySave = async (job) => {
    setBusyAction(true)
    try {
      const res = await aiGeneratorAPI.retrySave(job.id)
      setActiveJob(res.data.job)
      toast('Retrying output retrieval…', { icon: '🔄' })
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not retry.')
    } finally { setBusyAction(false) }
  }

  const generating = activeJob && ACTIVE.includes(activeJob.status)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Nav */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
          <Link to="/creator/dashboard" style={navBtn}><ArrowLeft size={16} /> Creator Dashboard</Link>
          <Link to="/creator/video-studio" style={navBtn}><Clapperboard size={16} /> Video Studio</Link>
          <Link to="/" style={navBtn}><Home size={16} /> Home</Link>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            <Sparkles size={26} color="var(--color-accent)" /> AI Generator
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
            Describe a scene and generate a short video with PixVerse. Generated clips are
            private drafts you can preview, download, save to My Media, or open in Video Studio.
            They are not sent to clients and do not bypass the normal review workflow.
          </p>
        </div>

        {loadingConfig ? (
          <div style={card}><Loader size={20} className="spin" /> <span style={{ marginLeft: 8 }}>Loading…</span></div>
        ) : configError ? (
          <div style={{ ...card, borderColor: 'var(--color-danger)' }}>
            <AlertTriangle size={18} color="var(--color-danger)" />
            <span style={{ marginLeft: 8 }}>{configError}</span>
            <button style={{ ...primaryBtn, marginLeft: 12 }} onClick={loadConfig}><RefreshCw size={14} /> Retry</button>
          </div>
        ) : !config?.available ? (
          <div style={{ ...card, flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--text-primary)' }}>
              <AlertTriangle size={18} color="var(--color-warning)" /> AI generation is currently unavailable
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
              The platform owner has not configured the video provider yet. Please check back later.
            </p>
          </div>
        ) : (
          <>
            {/* Generator form */}
            <div style={{ ...card, flexDirection: 'column', alignItems: 'stretch', gap: 16 }}>
              <label style={labelStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span>Prompt</span>
                  <button
                    type="button"
                    onClick={handleImprovePrompt}
                    disabled={improvingPrompt || prompt.trim().length < 3}
                    style={{ ...secondaryBtn, padding: '6px 10px', fontSize: 12, opacity: improvingPrompt || prompt.trim().length < 3 ? 0.55 : 1 }}
                  >
                    {improvingPrompt ? <><Loader size={13} className="spin" /> Improving…</> : <><Sparkles size={13} /> Improve with Gemini</>}
                  </button>
                </div>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  maxLength={config.limits?.max_prompt_chars || 2000}
                  placeholder="e.g. A cinematic drone shot flying over misty mountains at sunrise"
                  rows={4}
                  style={textareaStyle}
                />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', alignSelf: 'flex-end' }}>
                  {prompt.length}/{config.limits?.max_prompt_chars || 2000}
                </span>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <label style={labelStyle}>
                  Aspect ratio
                  <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} style={selectStyle}>
                    {(config.supported_aspect_ratios || []).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label style={labelStyle}>
                  Quality
                  <select value={quality} onChange={e => setQuality(e.target.value)} style={selectStyle}>
                    {(config.supported_qualities || []).map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </label>
                <label style={labelStyle}>
                  Duration
                  <select value={duration} onChange={e => setDuration(Number(e.target.value))} style={selectStyle}>
                    {(config.supported_durations || []).map(d => <option key={d} value={d}>{d}s</option>)}
                  </select>
                </label>
              </div>

              {config.cost_note && (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>ℹ️ {config.cost_note}</p>
              )}

              <button
                onClick={handleGenerate}
                disabled={submitting || generating || prompt.trim().length < 3}
                style={{ ...primaryBtn, opacity: (submitting || generating || prompt.trim().length < 3) ? 0.6 : 1,
                         cursor: (submitting || generating || prompt.trim().length < 3) ? 'not-allowed' : 'pointer', justifyContent: 'center' }}
              >
                {submitting ? <><Loader size={16} className="spin" /> Starting…</>
                 : generating ? <><Loader size={16} className="spin" /> Generation in progress…</>
                 : <><Wand2 size={16} /> Generate Video</>}
              </button>
            </div>

            {/* Active job result */}
            {activeJob && <JobCard
              job={activeJob}
              onSave={handleSaveToMedia}
              onOpenStudio={handleOpenInStudio}
              onRetry={handleRetrySave}
              busy={busyAction}
              highlight
            />}

            {/* History */}
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '28px 0 12px' }}>
              Generation history
            </h2>
            {jobsError ? (
              <div style={{ ...card, borderColor: 'var(--color-danger)' }}>
                <AlertTriangle size={16} color="var(--color-danger)" />
                <span style={{ marginLeft: 8 }}>Could not load history.</span>
                <button style={{ ...primaryBtn, marginLeft: 12 }} onClick={loadJobs}><RefreshCw size={14} /> Retry</button>
              </div>
            ) : jobs.filter(j => j.id !== activeJob?.id).length === 0 ? (
              <div style={{ ...card, color: 'var(--text-secondary)' }}>
                No generations yet. Your past AI videos will appear here.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {jobs.filter(j => j.id !== activeJob?.id).map(j => (
                  <JobCard key={j.id} job={j} onSave={handleSaveToMedia}
                           onOpenStudio={handleOpenInStudio} onRetry={handleRetrySave} busy={busyAction} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function JobCard({ job, onSave, onOpenStudio, onRetry, busy, highlight }) {
  const meta = STATUS_META[job.status] || STATUS_META.failed
  const StatusIcon = meta.icon
  const spinning = ['generating', 'saving_output', 'queued'].includes(job.status)
  const [videoError, setVideoError] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ ...card, flexDirection: 'column', alignItems: 'stretch', gap: 12,
               border: highlight ? '2px solid var(--color-accent)' : '1px solid var(--border-color)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20,
                       fontSize: 12, fontWeight: 700, background: meta.bg, color: meta.color }}>
          <StatusIcon size={13} className={spinning ? 'spin' : ''} /> {meta.label}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {job.aspect_ratio} · {job.quality} · {job.duration}s · {formatDate(job.created_at)}
        </span>
      </div>

      <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{job.prompt}</p>

      {job.status === 'failed' && (
        <div style={{ fontSize: 13, color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} /> {job.error_message || 'Generation failed.'}
          {job.provider_status === 1 || job.error_code === 'download_failed' || job.error_code === 'store_failed' ? (
            <button style={{ ...primaryBtn, marginLeft: 8 }} disabled={busy} onClick={() => onRetry(job)}>
              <RefreshCw size={13} /> Retry save
            </button>
          ) : null}
        </div>
      )}

      {job.output_ready && (
        <>
          <video
            key={job.id}
            src={aiGeneratorAPI.jobStreamUrl(job.id)}
            controls
            playsInline
            preload="metadata"
            onError={() => setVideoError(true)}
            style={{ width: '100%', maxHeight: 420, borderRadius: 10, background: '#000' }}
          />
          {videoError && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Preview failed. Use the Download button below to open the generated video locally.
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={aiGeneratorAPI.jobDownloadUrl(job.id)} style={secondaryBtn}><Download size={15} /> Download</a>
            <button style={secondaryBtn} disabled={busy} onClick={() => onSave(job)}><Save size={15} /> Save to My Media</button>
            <button style={primaryBtn} disabled={busy} onClick={() => onOpenStudio(job)}>
              <Clapperboard size={15} /> Open in Video Studio
            </button>
          </div>
        </>
      )}
    </motion.div>
  )
}

const card = {
  display: 'flex', alignItems: 'center', background: 'var(--bg-card)',
  border: '1px solid var(--border-color)', borderRadius: 16, padding: 20, marginBottom: 12,
}
const labelStyle = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }
const textareaStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color)',
  background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, resize: 'vertical', fontFamily: 'inherit',
}
const selectStyle = {
  padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-color)',
  background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14,
}
const primaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10,
  border: 'none', background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontSize: 13,
  cursor: 'pointer', textDecoration: 'none',
}
const secondaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10,
  border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)',
  fontWeight: 600, fontSize: 13, cursor: 'pointer', textDecoration: 'none',
}
const navBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
  border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)',
  fontWeight: 600, fontSize: 13, textDecoration: 'none',
}
