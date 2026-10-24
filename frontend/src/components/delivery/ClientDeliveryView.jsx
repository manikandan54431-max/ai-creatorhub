import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle, Download, RotateCcw, Shield, Play, Lock, RefreshCw, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import api from '../../services/api'

export default function ClientDeliveryView({ order, onRevisionRequest }) {
  const [approvedDeliveries, setApprovedDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)

  // Derive whether delivery is still awaiting approval
  const isAwaiting = ['in_progress', 'assigned', 'accepted', 'delivered', 'revision_requested'].includes(order.status)

  const loadApprovedDeliveries = useCallback(async () => {
    try {
      const res = await api.get(`/api/orders/${order.id}/approved-deliveries`)
      setApprovedDeliveries(res.data)
      setError(null)
      // Stop polling once we have an approved delivery
      if (res.data.length > 0 && pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    } catch (e) {
      // Only set error on non-404 — 404 means no approved delivery yet (normal)
      if (e.response?.status !== 404) {
        setError(e.response?.data?.detail || 'Failed to load delivery. Please retry.')
      }
    } finally {
      setLoading(false)
    }
  }, [order.id])

  useEffect(() => {
    setLoading(true)
    setError(null)
    setApprovedDeliveries([])
    loadApprovedDeliveries()

    // Poll every 15 seconds while the order is still awaiting admin approval
    // and we haven't yet received an approved delivery.
    // We check approvedDeliveries.length inside loadApprovedDeliveries and
    // self-cancel the interval once one is found.
    if (isAwaiting) {
      pollRef.current = setInterval(loadApprovedDeliveries, 15_000)
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [order.id, order.status]) // Re-run when order status changes (parent refetch)

  const latestApproved = approvedDeliveries[0]

  if (loading) {
    return (
      <div style={{ marginTop: 24 }}>
        <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
      </div>
    )
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Play size={20} color="var(--ms-blue)" />
          Project Delivery
        </h3>

        {error ? (
          // API error — never show as "Delivery Pending"
          <div style={{
            background: 'rgba(239,68,68,0.05)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 12,
            padding: '32px 24px',
            textAlign: 'center',
          }}>
            <AlertCircle size={36} color="#ef4444" style={{ marginBottom: 12 }} />
            <h4 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>Could not load delivery</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 400, margin: '0 auto 16px' }}>
              {error}
            </p>
            <button
              onClick={() => { setLoading(true); setError(null); loadApprovedDeliveries() }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
              }}
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : approvedDeliveries.length === 0 ? (
          // No approved delivery yet
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            padding: '32px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              {isAwaiting ? '🔍' : '⏳'}
            </div>
            <h4 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>
              {isAwaiting ? 'Quality Review in Progress' : 'Delivery Pending'}
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 400, margin: '0 auto' }}>
              Your project is in progress. The final video will appear here after quality review.
              All deliveries are verified by our admin team before release.
            </p>
            <div style={{
              marginTop: 16,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--info-light)',
              color: 'var(--info)',
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
            }}>
              <Shield size={14} />
              Admin-reviewed delivery
            </div>
            {isAwaiting && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                Checking for updates automatically…
              </div>
            )}
          </div>
        ) : (
          // Show latest approved delivery
          <ApprovedDeliveryPlayer
            delivery={latestApproved}
            order={order}
            onRevisionRequest={onRevisionRequest}
          />
        )}

        {/* Version history */}
        {approvedDeliveries.length > 1 && (
          <div style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>Previous Approved Versions</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {approvedDeliveries.slice(1).map(d => (
                <div key={d.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8,
                  border: '1px solid var(--border-color)',
                }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{d.title}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>v{d.version_number}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                      Delivered {new Date(d.delivered_at).toLocaleDateString()}
                    </span>
                  </div>
                  <a
                    href={`${import.meta.env.VITE_API_URL || ''}/api/deliveries/${d.id}/download${localStorage.getItem('token') ? `?token=${encodeURIComponent(localStorage.getItem('token'))}` : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}
                  >
                    <Download size={13} />
                    Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ApprovedDeliveryPlayer({ delivery: d, order, onRevisionRequest }) {
  const [accepting, setAccepting] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [revisionReason, setRevisionReason] = useState('')
  const [showRevisionForm, setShowRevisionForm] = useState(false)

  const token = localStorage.getItem('token') || ''
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : ''
  const apiBase = import.meta.env.VITE_API_URL || ''
  const streamUrl = `${apiBase}/api/deliveries/${d.id}/stream${tokenParam}`
  const downloadUrl = `${apiBase}/api/deliveries/${d.id}/download${tokenParam}`

  async function handleAccept() {
    setAccepting(true)
    try {
      await api.post(`/api/orders/${order.id}/approve`)
      toast.success('Delivery accepted! Thank you.')
      window.location.reload()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to accept delivery')
    } finally {
      setAccepting(false)
    }
  }

  async function handleRevision(e) {
    e.preventDefault()
    if (!revisionReason.trim()) { toast.error('Please describe what changes you need.'); return }
    setRequesting(true)
    try {
      await api.post(`/api/orders/${order.id}/revision`, { reason: revisionReason })
      toast.success('Revision request sent.')
      if (onRevisionRequest) onRevisionRequest()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to request revision')
    } finally {
      setRequesting(false)
    }
  }

  const canAct = order.status === 'delivered' || order.status === 'in_progress'

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {/* Admin Verified Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span className="admin-verified-badge">
          <Shield size={13} />
          Admin Verified
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Delivered {new Date(d.delivered_at).toLocaleDateString()}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
          v{d.version_number}
        </span>
      </div>

      {/* Video title */}
      <h4 style={{ margin: '0 0 12px', fontSize: 16 }}>{d.title}</h4>

      {/* Secure video player */}
      <div className="video-container" style={{ marginBottom: 16 }}>
        <video
          controls
          preload="metadata"
          playsInline
          onError={() => setVideoError(true)}
          style={{ borderRadius: 8 }}
          src={streamUrl}
        >
          <p style={{ color: 'white', padding: 16 }}>
            Your browser cannot preview this video format.{' '}
            <a href={downloadUrl} style={{ color: 'var(--ms-blue)' }}>Download it here.</a>
          </p>
        </video>
      </div>
      {videoError && (
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: 'var(--text-secondary)', fontSize: 13 }}>
          This video could not be previewed in the browser. <a href={downloadUrl} style={{ color: 'var(--ms-blue)', fontWeight: 700 }}>Download the video</a> and open it with a video player.
        </div>
      )}

      {/* Delivery notes */}
      {d.description && (
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
            CREATOR DELIVERY NOTES
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
            {d.description}
          </p>
        </div>
      )}

      {/* Actions */}
      {order.status !== 'completed' && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {/* Download */}
          <a
            href={downloadUrl}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
          >
            <Download size={15} />
            Download Video
          </a>

          {/* Accept */}
          {canAct && (
            <button
              className="btn btn-success"
              onClick={handleAccept}
              disabled={accepting}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <CheckCircle size={15} />
              {accepting ? 'Accepting...' : 'Accept Delivery'}
            </button>
          )}

          {/* Request Revision */}
          {canAct && !showRevisionForm && (
            <button
              className="btn btn-secondary"
              onClick={() => setShowRevisionForm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RotateCcw size={15} />
              Request Revision
            </button>
          )}
        </div>
      )}

      {order.status === 'completed' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--success)', fontWeight: 600, fontSize: 14,
          background: 'var(--success-light)', padding: '8px 14px', borderRadius: 8, marginBottom: 16,
        }}>
          <CheckCircle size={16} />
          Delivery accepted. Order completed.
        </div>
      )}

      {/* Revision Form */}
      {showRevisionForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            padding: 16,
          }}
        >
          <h5 style={{ margin: '0 0 12px', color: 'var(--text-primary)' }}>Request Revision</h5>
          <form onSubmit={handleRevision}>
            <textarea
              className="input-base"
              value={revisionReason}
              onChange={e => setRevisionReason(e.target.value)}
              placeholder="Describe what needs to be changed and why..."
              rows={4}
              style={{ resize: 'vertical', marginBottom: 12 }}
              required
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={requesting}>
                {requesting ? 'Sending...' : 'Send Revision Request'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowRevisionForm(false); setRevisionReason('') }}>
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Note about approval */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
        <Lock size={11} />
        This delivery was reviewed and approved by the AI CreatorHub admin team before being made available to you.
      </div>
    </motion.div>
  )
}
