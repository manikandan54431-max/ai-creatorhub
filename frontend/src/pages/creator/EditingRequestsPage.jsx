/**
 * Creator: incoming media editing requests (Issue 5C).
 *
 * Shows only the requests addressed to the signed-in creator — the endpoint is
 * scoped server-side, so there is no view of other clients' media here.
 *
 * Accepting moves the request's order into the normal engagement flow, where
 * the existing delivery, review and release workflow takes over.
 */
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Film, ImageIcon, Download, Clock, CheckCircle, XCircle,
  AlertTriangle, RefreshCw, Clapperboard,
} from 'lucide-react'

import { editingRequestsAPI } from '../../services/api'
import { formatMoney, formatDate, formatNumber } from '../../utils/format'

const STATUS_META = {
  pending_creator_response: { label: 'Awaiting your response', bg: '#fef3c7', color: '#92400e', icon: Clock },
  accepted: { label: 'Accepted', bg: '#d1fae5', color: '#065f46', icon: CheckCircle },
  in_production: { label: 'In production', bg: '#e0f2fe', color: '#075985', icon: RefreshCw },
  delivered: { label: 'Delivered', bg: '#d1fae5', color: '#065f46', icon: CheckCircle },
  completed: { label: 'Completed', bg: '#d1fae5', color: '#065f46', icon: CheckCircle },
  declined: { label: 'You declined', bg: '#fee2e2', color: '#991b1b', icon: XCircle },
  cancelled: { label: 'Withdrawn by client', bg: '#f1f5f9', color: '#475569', icon: XCircle },
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

/** Preview of one client-supplied source file, streamed under authorisation. */
function SourceMedia({ requestId, media, closed }) {
  const [failed, setFailed] = useState(false)
  const src = editingRequestsAPI.mediaStreamUrl(requestId, media.id)

  if (closed) {
    // The backend withdraws access once a request is declined or withdrawn;
    // say so instead of showing a broken thumbnail.
    return (
      <div style={{
        width: 160, padding: '14px 12px', borderRadius: 10, fontSize: 11,
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        color: 'var(--text-muted)', textAlign: 'center',
      }}>
        <Film size={16} style={{ opacity: 0.5, marginBottom: 6 }} />
        <div>Access to this file ended when the request closed</div>
      </div>
    )
  }

  return (
    <div style={{ width: 160, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-color)', background: '#000' }}>
      {failed ? (
        <div style={{
          height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 6, color: '#fca5a5', fontSize: 10, padding: 8, textAlign: 'center',
        }}>
          <AlertTriangle size={15} />
          <span>Preview unavailable — use Download</span>
        </div>
      ) : media.media_type === 'image' ? (
        <img
          src={src} alt={media.original_filename || 'Source image'}
          style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }}
          onError={() => setFailed(true)}
        />
      ) : (
        <video
          src={src} controls preload="metadata" playsInline
          style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block', background: '#000' }}
          onError={() => setFailed(true)}
        />
      )}
      <div style={{ padding: '6px 8px', background: 'var(--bg-card)' }}>
        <div style={{
          fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3,
        }}>
          {media.media_type === 'image' ? <ImageIcon size={9} /> : <Film size={9} />} {media.original_filename}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
          {media.width && media.height ? `${media.width}×${media.height}` : 'size unknown'}
          {media.duration ? ` · ${formatNumber(media.duration)}s` : ''}
        </div>
        <a
          href={editingRequestsAPI.mediaDownloadUrl(requestId, media.id)}
          target="_blank" rel="noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 5,
            fontSize: 10, fontWeight: 700, color: 'var(--color-accent)', textDecoration: 'none',
          }}
        >
          <Download size={10} /> Download
        </a>
      </div>
    </div>
  )
}

export default function CreatorEditingRequestsPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await editingRequestsAPI.getAssigned()
      setRequests(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Could not load your editing requests')
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const respond = async (req, accept) => {
    let note = null
    if (!accept) {
      // The client sees this, so it is required rather than optional.
      note = window.prompt(`Why are you declining "${req.title}"? The client will see this.`)
      if (note === null) return
      if (!note.trim()) {
        toast.error('Please give the client a reason')
        return
      }
    } else if (!window.confirm(`Accept "${req.title}" and start this engagement?`)) {
      return
    }

    setBusy(b => ({ ...b, [req.id]: true }))
    try {
      const res = await editingRequestsAPI.respond(req.id, accept ? { accept: true } : { accept: false, note: note.trim() })
      toast.success(res.data?.status === 'accepted' ? 'Request accepted' : 'Request declined')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not send your response')
    } finally {
      setBusy(b => {
        const next = { ...b }
        delete next[req.id]
        return next
      })
    }
  }

  const pending = requests.filter(r => r.status === 'pending_creator_response')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingTop: 70 }}>
      <div className="container-custom" style={{ padding: '32px 24px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
              🎞️ Client Editing Requests
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              Clients who sent you their own footage to edit
              {!loading && !error && pending.length > 0 && (
                <strong style={{ color: 'var(--color-warning)' }}>
                  {' '}· {formatNumber(pending.length)} awaiting your response
                </strong>
              )}
            </p>
          </div>
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
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 160, borderRadius: 16 }} />
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
                Could not load editing requests
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{error}</p>
            </div>
            <button onClick={load} className="btn-gradient" style={{ padding: '10px 20px', fontSize: 13 }}>Retry</button>
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 70, color: 'var(--text-muted)' }}>
            <Film size={44} style={{ opacity: 0.3, marginBottom: 16 }} />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              No editing requests yet
            </p>
            <p style={{ fontSize: 13 }}>
              When a client sends you their own photos or videos to edit, the request appears here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {requests.map((r, i) => {
              const closed = r.status === 'declined' || r.status === 'cancelled'
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.05 }}
                  className="card" style={{ padding: 24 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                        <h3 style={{ fontWeight: 800, fontSize: 17, color: 'var(--text-primary)' }}>{r.title}</h3>
                        <StatusBadge status={r.status} />
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        From <strong style={{ color: 'var(--text-primary)' }}>{r.client_name || 'Unknown client'}</strong>
                        {' · '}{formatDate(r.created_at)}
                        {' · '}{formatNumber(r.media_count)} source file{r.media_count === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>
                      <div>Budget: <strong style={{ color: 'var(--color-accent)' }}>{formatMoney(r.budget)}</strong></div>
                      {r.deadline && <div>Deadline: <strong style={{ color: 'var(--text-primary)' }}>{formatDate(r.deadline)}</strong></div>}
                    </div>
                  </div>

                  {/* The brief */}
                  <div style={{
                    padding: '14px 16px', marginBottom: 16, borderRadius: 10,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                      Editing instructions
                    </div>
                    <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                      {r.instructions}
                    </p>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>Deliverable: <strong style={{ color: 'var(--text-primary)' }}>{r.deliverable_type}</strong></span>
                      {r.preferred_style && <span>Style: <strong style={{ color: 'var(--text-primary)' }}>{r.preferred_style}</strong></span>}
                      {r.aspect_ratio && <span>Aspect: <strong style={{ color: 'var(--text-primary)' }}>{r.aspect_ratio}</strong></span>}
                      {r.output_format && <span>Format: <strong style={{ color: 'var(--text-primary)' }}>{r.output_format}</strong></span>}
                      {r.target_duration_seconds && <span>Target: <strong style={{ color: 'var(--text-primary)' }}>{formatNumber(r.target_duration_seconds)}s</strong></span>}
                    </div>
                    {r.deliverables && (
                      <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>Expected deliverables:</strong> {r.deliverables}
                      </div>
                    )}
                  </div>

                  {/* Client's source media */}
                  {r.media?.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                        Client's source media
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                        {r.media.map(m => (
                          <SourceMedia key={m.id} requestId={r.id} media={m} closed={closed} />
                        ))}
                      </div>
                    </>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    {r.status === 'pending_creator_response' ? (
                      <>
                        <button
                          onClick={() => respond(r, true)}
                          disabled={busy[r.id]}
                          className="btn-gradient"
                          style={{ padding: '11px 22px', fontSize: 14, opacity: busy[r.id] ? 0.6 : 1 }}
                        >
                          {busy[r.id] ? 'Working…' : 'Accept request'}
                        </button>
                        <button
                          onClick={() => respond(r, false)}
                          disabled={busy[r.id]}
                          style={{
                            padding: '11px 20px', fontSize: 14, fontWeight: 700, borderRadius: 10,
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                            color: 'var(--color-danger)', cursor: busy[r.id] ? 'default' : 'pointer',
                            opacity: busy[r.id] ? 0.6 : 1,
                          }}
                        >
                          Decline
                        </button>
                      </>
                    ) : r.status === 'accepted' || r.status === 'in_production' ? (
                      <>
                        {r.order_id && (
                          <Link
                            to={`/creator/orders/${r.order_id}`}
                            className="btn-gradient"
                            style={{ padding: '11px 22px', fontSize: 14, textDecoration: 'none' }}
                          >
                            Open order & submit deliverable →
                          </Link>
                        )}
                        <Link
                          to="/creator/video-studio"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px',
                            fontSize: 13, fontWeight: 700, borderRadius: 10, textDecoration: 'none',
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <Clapperboard size={15} /> Open Video Studio
                        </Link>
                      </>
                    ) : (
                      r.order_id && (
                        <Link
                          to={`/creator/orders/${r.order_id}`}
                          style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-accent)', textDecoration: 'none' }}
                        >
                          Open order #{r.order_id} →
                        </Link>
                      )
                    )}
                  </div>

                  {closed && r.creator_response_note && (
                    <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Your note to the client: {r.creator_response_note}
                    </div>
                  )}

                  {r.status === 'accepted' && (
                    <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      Download the source files, edit them in the Video Studio or your own tools, then
                      submit the result on the order. It goes through the normal admin review before
                      the client receives it.
                    </p>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
