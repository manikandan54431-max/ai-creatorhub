/**
 * Client: media editing requests (Issue 5A).
 *
 * The client uploads their own photos/videos and asks a chosen creator to edit
 * them. Each request creates a real order behind the scenes, so the existing
 * engagement, delivery and review workflow carries it from here.
 *
 * Object URLs are used only for local thumbnails before upload; persistence is
 * entirely server-side.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Plus, Upload, X, AlertTriangle, Film, ImageIcon, Clock,
  CheckCircle, XCircle, RefreshCw, Download,
} from 'lucide-react'

import { editingRequestsAPI, creatorsAPI } from '../../services/api'
import { formatMoney, formatDate, formatNumber } from '../../utils/format'

const STATUS_META = {
  pending_creator_response: { label: 'Awaiting creator response', bg: '#fef3c7', color: '#92400e', icon: Clock },
  accepted: { label: 'Accepted', bg: '#d1fae5', color: '#065f46', icon: CheckCircle },
  in_production: { label: 'In production', bg: '#e0f2fe', color: '#075985', icon: RefreshCw },
  delivered: { label: 'Delivered', bg: '#d1fae5', color: '#065f46', icon: CheckCircle },
  completed: { label: 'Completed', bg: '#d1fae5', color: '#065f46', icon: CheckCircle },
  declined: { label: 'Declined by creator', bg: '#fee2e2', color: '#991b1b', icon: XCircle },
  cancelled: { label: 'Withdrawn', bg: '#f1f5f9', color: '#475569', icon: XCircle },
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, bg: '#f1f5f9', color: '#475569', icon: Clock }
  const Icon = meta.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, background: meta.bg, color: meta.color,
      borderRadius: 10, padding: '3px 10px', fontSize: 12, fontWeight: 700,
    }}>
      <Icon size={12} /> {meta.label}
    </span>
  )
}

const ASPECT_RATIOS = ['', '16:9', '9:16', '1:1', '4:5']
const STYLES = ['', 'Cinematic', 'Vlog', 'Fast-paced / UGC', 'Minimal', 'Documentary', 'Corporate']

export default function EditingRequestsPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [limits, setLimits] = useState(null)
  const [creators, setCreators] = useState([])
  const [creatorsError, setCreatorsError] = useState(null)

  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [files, setFiles] = useState([])        // { file, url, kind, id }
  const [formError, setFormError] = useState(null)
  const fileInputRef = useRef(null)
  const previewUrlsRef = useRef([])

  const [form, setForm] = useState({
    creator_id: '', title: '', instructions: '', preferred_style: '',
    deliverables: '', deliverable_type: 'video', output_format: '',
    aspect_ratio: '', target_duration_seconds: '', budget: '', deadline: '',
  })

  // ── Loading ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await editingRequestsAPI.getMine()
      setRequests(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      // A failed load must not render as "no requests".
      setError(err.response?.data?.detail || err.message || 'Could not load your editing requests')
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    editingRequestsAPI.getLimits().then(r => setLimits(r.data)).catch(() => setLimits(null))
    creatorsAPI.getAll({ limit: 50 })
      .then(r => {
        const data = r.data
        setCreators(Array.isArray(data) ? data : (data?.items ?? []))
        setCreatorsError(null)
      })
      .catch(err => {
        setCreators([])
        setCreatorsError(err.response?.data?.detail || 'Could not load the creator list')
      })
  }, [])

  // Release local preview URLs on unmount so blobs are not leaked.
  useEffect(() => () => {
    previewUrlsRef.current.forEach(u => URL.revokeObjectURL(u))
  }, [])

  // ── File selection ────────────────────────────────────────────────────────
  const maxFiles = limits?.max_files_per_request ?? 10
  const maxFileMb = limits?.max_file_mb ?? 500
  const minInstructions = limits?.min_instructions_chars ?? 10
  const acceptAttr = limits
    ? [...limits.allowed_video_extensions, ...limits.allowed_image_extensions].join(',')
    : '.mp4,.webm,.mov,.jpg,.jpeg,.png,.webp'

  const onPickFiles = (e) => {
    const picked = Array.from(e.target.files || [])
    if (!picked.length) return
    setFormError(null)

    const next = []
    for (const file of picked) {
      if (files.length + next.length >= maxFiles) {
        setFormError(`You can attach at most ${maxFiles} files per request.`)
        break
      }
      if (file.size > maxFileMb * 1024 * 1024) {
        setFormError(`"${file.name}" is larger than the ${maxFileMb} MB per-file limit.`)
        continue
      }
      const url = URL.createObjectURL(file)
      previewUrlsRef.current.push(url)
      next.push({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
        url,
        kind: file.type.startsWith('image/') ? 'image' : 'video',
      })
    }
    setFiles(f => [...f, ...next])
    e.target.value = ''
  }

  const removeFile = (id) => {
    setFiles(f => {
      const target = f.find(x => x.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return f.filter(x => x.id !== id)
    })
  }

  const resetForm = () => {
    files.forEach(f => URL.revokeObjectURL(f.url))
    setFiles([])
    setForm({
      creator_id: '', title: '', instructions: '', preferred_style: '',
      deliverables: '', deliverable_type: 'video', output_format: '',
      aspect_ratio: '', target_duration_seconds: '', budget: '', deadline: '',
    })
    setFormError(null)
    setUploadProgress(0)
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const submit = async (e) => {
    e.preventDefault()
    setFormError(null)

    if (!form.creator_id) return setFormError('Choose the creator you want to work with.')
    if (!form.title.trim()) return setFormError('Give the request a title.')
    if (form.instructions.trim().length < minInstructions) {
      return setFormError(`Editing instructions must be at least ${minInstructions} characters, so the creator knows what to do.`)
    }
    if (files.length === 0) return setFormError('Attach at least one photo or video to edit.')

    const fd = new FormData()
    fd.append('creator_id', form.creator_id)
    fd.append('title', form.title.trim())
    fd.append('instructions', form.instructions.trim())
    fd.append('deliverable_type', form.deliverable_type)
    if (form.preferred_style) fd.append('preferred_style', form.preferred_style)
    if (form.deliverables) fd.append('deliverables', form.deliverables)
    if (form.output_format) fd.append('output_format', form.output_format)
    if (form.aspect_ratio) fd.append('aspect_ratio', form.aspect_ratio)
    if (form.target_duration_seconds) fd.append('target_duration_seconds', form.target_duration_seconds)
    if (form.budget) fd.append('budget', form.budget)
    if (form.deadline) fd.append('deadline', new Date(form.deadline).toISOString())
    files.forEach(f => fd.append('files', f.file))

    setSubmitting(true)
    setUploadProgress(0)
    try {
      await editingRequestsAPI.create(fd, setUploadProgress)
      // Deliberate wording: the request was sent, not accepted.
      toast.success('Request sent — the creator has been notified and will accept or decline it')
      resetForm()
      setShowForm(false)
      await load()
    } catch (err) {
      setFormError(err.response?.data?.detail || err.message || 'Could not send the request')
    } finally {
      setSubmitting(false)
    }
  }

  const cancelRequest = async (req) => {
    if (!window.confirm(`Withdraw the request "${req.title}"? The creator will be notified.`)) return
    try {
      await editingRequestsAPI.cancel(req.id)
      toast.success('Request withdrawn')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not withdraw this request')
    }
  }

  const label = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingTop: 70 }}>
      <div className="container-custom" style={{ padding: '32px 24px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
              🎞️ Media Editing Requests
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              Upload your own photos or videos and ask a creator to edit them
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={load}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '11px 18px', borderRadius: 10,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13,
                cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={() => setShowForm(v => !v)}
              className="btn-gradient"
              style={{ padding: '12px 22px', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Plus size={16} /> {showForm ? 'Close form' : 'New editing request'}
            </button>
          </div>
        </div>

        {/* ── Create form ───────────────────────────────────────────────── */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="card" style={{ padding: 28, marginBottom: 32 }}
          >
            <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>
              New editing request
            </h2>

            {creatorsError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', marginBottom: 18,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10, fontSize: 13, color: 'var(--text-secondary)',
              }}>
                <AlertTriangle size={16} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                {creatorsError}
              </div>
            )}

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 18 }}>
                <div>
                  <label style={label}>Creator *</label>
                  <select
                    value={form.creator_id}
                    onChange={e => setForm({ ...form, creator_id: e.target.value })}
                    className="input-base" required
                  >
                    <option value="">
                      {creators.length === 0 ? 'No eligible creators available' : 'Choose a creator'}
                    </option>
                    {creators.map(c => (
                      <option key={c.user_id} value={c.user_id}>
                        {c.name}{c.category ? ` — ${c.category}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={label}>Request title *</label>
                  <input
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Edit my product launch clips"
                    className="input-base" required
                  />
                </div>
              </div>

              {/* ── Source media ──────────────────────────────────────── */}
              <div>
                <label style={label}>
                  Your photos / videos *
                  <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>
                    {' '}— up to {formatNumber(maxFiles)} files, {formatNumber(maxFileMb)} MB each
                  </span>
                </label>
                <input
                  ref={fileInputRef} type="file" multiple accept={acceptAttr}
                  onChange={onPickFiles} style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={files.length >= maxFiles}
                  style={{
                    width: '100%', padding: '22px', borderRadius: 12, cursor: files.length >= maxFiles ? 'default' : 'pointer',
                    background: 'var(--color-accent-subtle)', border: '1px dashed var(--color-accent)',
                    color: 'var(--color-accent)', fontWeight: 700, fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    opacity: files.length >= maxFiles ? 0.5 : 1,
                  }}
                >
                  <Upload size={18} />
                  {files.length >= maxFiles ? 'File limit reached' : 'Choose photos or videos'}
                </button>

                {files.length > 0 && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: 12, marginTop: 14,
                  }}>
                    {files.map(f => (
                      <div key={f.id} style={{
                        position: 'relative', borderRadius: 10, overflow: 'hidden',
                        border: '1px solid var(--border-color)', background: '#000',
                      }}>
                        {/* Local preview only — the stored copy is server-side. */}
                        {f.kind === 'image'
                          ? <img src={f.url} alt={f.file.name} style={{ width: '100%', height: 96, objectFit: 'cover', display: 'block' }} />
                          : <video src={f.url} style={{ width: '100%', height: 96, objectFit: 'cover', display: 'block' }} muted preload="metadata" />}
                        <button
                          type="button" onClick={() => removeFile(f.id)} aria-label={`Remove ${f.file.name}`}
                          style={{
                            position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%',
                            background: 'rgba(0,0,0,0.65)', border: 'none', color: '#fff', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <X size={12} />
                        </button>
                        <div style={{
                          padding: '5px 7px', fontSize: 10, color: 'var(--text-secondary)',
                          background: 'var(--bg-card)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {f.kind === 'image' ? <ImageIcon size={9} /> : <Film size={9} />} {f.file.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label style={label}>Editing instructions *</label>
                <textarea
                  value={form.instructions}
                  onChange={e => setForm({ ...form, instructions: e.target.value })}
                  placeholder="What should the creator do? Cuts, pacing, colour, music, captions, anything to avoid…"
                  className="input-base" rows={4} style={{ resize: 'vertical' }} required
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {formatNumber(form.instructions.trim().length)} / {formatNumber(minInstructions)} characters minimum
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 18 }}>
                <div>
                  <label style={label}>Deliverable type</label>
                  <select
                    value={form.deliverable_type}
                    onChange={e => setForm({ ...form, deliverable_type: e.target.value })}
                    className="input-base"
                  >
                    <option value="video">Video</option>
                    <option value="photo">Photos</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div>
                  <label style={label}>Preferred style</label>
                  <select
                    value={form.preferred_style}
                    onChange={e => setForm({ ...form, preferred_style: e.target.value })}
                    className="input-base"
                  >
                    {STYLES.map(s => <option key={s} value={s}>{s || 'No preference'}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Aspect ratio</label>
                  <select
                    value={form.aspect_ratio}
                    onChange={e => setForm({ ...form, aspect_ratio: e.target.value })}
                    className="input-base"
                  >
                    {ASPECT_RATIOS.map(r => <option key={r} value={r}>{r || 'No preference'}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Output format</label>
                  <input
                    value={form.output_format}
                    onChange={e => setForm({ ...form, output_format: e.target.value })}
                    placeholder="e.g. MP4 1080p"
                    className="input-base"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 18 }}>
                <div>
                  <label style={label}>Target duration (seconds)</label>
                  <input
                    type="number" min="1"
                    value={form.target_duration_seconds}
                    onChange={e => setForm({ ...form, target_duration_seconds: e.target.value })}
                    placeholder="e.g. 30"
                    className="input-base"
                  />
                </div>
                <div>
                  <label style={label}>Budget (₹)</label>
                  <input
                    type="number" min="0"
                    value={form.budget}
                    onChange={e => setForm({ ...form, budget: e.target.value })}
                    placeholder="e.g. 5000"
                    className="input-base"
                  />
                </div>
                <div>
                  <label style={label}>Deadline</label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={e => setForm({ ...form, deadline: e.target.value })}
                    className="input-base"
                  />
                </div>
              </div>

              <div>
                <label style={label}>Deliverables expected</label>
                <textarea
                  value={form.deliverables}
                  onChange={e => setForm({ ...form, deliverables: e.target.value })}
                  placeholder="e.g. one 30s cut for Reels plus three stills"
                  className="input-base" rows={2} style={{ resize: 'vertical' }}
                />
              </div>

              {/* Upload progress / errors */}
              {submitting && (
                <div>
                  <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: 6, width: `${uploadProgress}%`, background: 'var(--color-accent)',
                      borderRadius: 3, transition: 'width 0.25s',
                    }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    {uploadProgress < 100
                      ? `Uploading your media… ${formatNumber(uploadProgress)}%`
                      : 'Finishing up — validating and storing your files…'}
                  </div>
                </div>
              )}

              {formError && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '13px 15px',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 10, fontSize: 13, color: 'var(--text-secondary)',
                }}>
                  <AlertTriangle size={16} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 1 }} />
                  <span>{formError}</span>
                </div>
              )}

              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Your files stay private. Only the creator you choose, and platform
                admins for moderation, can open them. Sending a request does not
                commit the creator — they will accept or decline it.
              </p>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => { resetForm(); setShowForm(false) }}
                  disabled={submitting}
                  style={{
                    flex: 1, padding: 13, background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)', borderRadius: 12,
                    color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-gradient" style={{ flex: 2, padding: 13, fontSize: 15 }}>
                  {submitting ? 'Sending…' : 'Send request to creator'}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* ── History ───────────────────────────────────────────────────── */}
        <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>
          Your requests {!loading && !error && `(${formatNumber(requests.length)})`}
        </h2>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />
            ))}
          </div>
        ) : error ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: 26,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16,
          }}>
            <AlertTriangle size={22} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                Could not load your editing requests
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{error}</p>
            </div>
            <button onClick={load} className="btn-gradient" style={{ padding: '10px 20px', fontSize: 13 }}>Retry</button>
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 70, color: 'var(--text-muted)' }}>
            <Film size={44} style={{ opacity: 0.3, marginBottom: 16 }} />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              You have not sent any editing requests yet
            </p>
            <p style={{ fontSize: 13 }}>Upload your footage and pick a creator to get started.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {requests.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.05 }}
                className="card" style={{ padding: 22 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                      <h3 style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>{r.title}</h3>
                      <StatusBadge status={r.status} />
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 680, lineHeight: 1.6 }}>
                      {r.instructions}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>
                    <div>Creator: <strong style={{ color: 'var(--text-primary)' }}>{r.creator_name || '-'}</strong></div>
                    <div>Budget: <strong style={{ color: 'var(--color-accent)' }}>{formatMoney(r.budget)}</strong></div>
                    <div>Sent {formatDate(r.created_at)}</div>
                  </div>
                </div>

                {/* Creator's decline reason, shown plainly */}
                {r.status === 'declined' && r.creator_response_note && (
                  <div style={{
                    padding: '10px 14px', marginBottom: 12, borderRadius: 10, fontSize: 13,
                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                    color: 'var(--text-secondary)',
                  }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Creator's reason:</strong> {r.creator_response_note}
                  </div>
                )}

                {/* Source media the client supplied */}
                {r.media?.length > 0 && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                    {r.media.map(m => (
                      <a
                        key={m.id}
                        href={editingRequestsAPI.mediaDownloadUrl(r.id, m.id)}
                        target="_blank" rel="noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7, padding: '7px 11px',
                          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                          borderRadius: 9, fontSize: 12, color: 'var(--text-secondary)',
                          textDecoration: 'none', fontWeight: 600,
                        }}
                      >
                        {m.media_type === 'image' ? <ImageIcon size={13} /> : <Film size={13} />}
                        {m.original_filename}
                        <Download size={12} style={{ opacity: 0.6 }} />
                      </a>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  {r.order_id && (
                    <Link
                      to={`/client/orders/${r.order_id}`}
                      style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-accent)', textDecoration: 'none' }}
                    >
                      Open order #{r.order_id} →
                    </Link>
                  )}
                  {r.status === 'pending_creator_response' && (
                    <button
                      onClick={() => cancelRequest(r)}
                      style={{
                        padding: '7px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: 'pointer',
                        background: 'rgba(239,68,68,0.08)', border: 'none', color: 'var(--color-danger)',
                      }}
                    >
                      Withdraw request
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
