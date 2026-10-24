import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Video, CheckCircle, XCircle, Clock, Eye, Search, Filter, Shield,
  FileVideo, User, ShoppingBag, Calendar, ChevronRight, AlertCircle,
  RotateCcw, Check, X, MessageSquare, Download, ExternalLink
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'

const TABS = [
  { key: 'pending_review', label: 'Pending Review', icon: Clock },
  { key: 'changes_requested', label: 'Changes Requested', icon: AlertCircle },
  { key: 'approved', label: 'Approved', icon: CheckCircle },
  { key: '', label: 'All Submissions', icon: Video },
]

const STATUS_COLORS = {
  draft: 'badge-neutral',
  pending_review: 'badge-warning',
  changes_requested: 'badge-error',
  approved: 'badge-success',
  superseded: 'badge-neutral',
}

const STATUS_LABELS = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  superseded: 'Superseded',
}

export default function AdminVideoApprovals() {
  const [activeTab, setActiveTab] = useState('pending_review')
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedSubmission, setSelectedSubmission] = useState(null)

  useEffect(() => {
    loadSubmissions()
  }, [activeTab])

  async function loadSubmissions() {
    setLoading(true)
    try {
      const params = {}
      if (activeTab) params.status = activeTab
      if (search) params.search = search
      const res = await api.get('/api/admin/video-approvals', { params })
      setSubmissions(res.data)
    } catch (err) {
      toast.error('Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }

  const pendingCount = submissions.filter(s => s.status === 'pending_review').length

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40,
            background: 'var(--gradient-hero)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Video size={20} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>Video Approvals</h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
              Review creator video submissions before client delivery
            </p>
          </div>
          {pendingCount > 0 && activeTab === 'pending_review' && (
            <span className="badge badge-warning" style={{ marginLeft: 'auto' }}>
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedSubmission && (
          <SubmissionDetailModal
            deliveryId={selectedSubmission}
            onClose={() => setSelectedSubmission(null)}
            onAction={loadSubmissions}
          />
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 10,
        padding: 4,
        marginBottom: 20,
        width: 'fit-content',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px',
              borderRadius: 7,
              border: 'none',
              background: activeTab === tab.key ? 'var(--ms-blue)' : 'transparent',
              color: activeTab === tab.key ? 'white' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input-base"
            style={{ paddingLeft: 36 }}
            placeholder="Search by project, creator, or order..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadSubmissions()}
          />
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadSubmissions}>Search</button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 72 }} />)}
        </div>
      ) : submissions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎬</div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>No submissions found</h3>
          <p>No video submissions match the current filter.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="ms-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Project / Order</th>
                  <th>Creator</th>
                  <th>Client</th>
                  <th>Version</th>
                  <th>Upload Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(sub => (
                  <motion.tr
                    key={sub.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedSubmission(sub.id)}
                  >
                    <td style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 13 }}>
                      #{sub.id}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {sub.order_title || sub.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Order #{sub.order_id}
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'var(--gradient-hero)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontSize: 11, fontWeight: 700, flexShrink: 0
                        }}>
                          {(sub.creator_name || 'C')[0].toUpperCase()}
                        </div>
                        {sub.creator_name}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {sub.client_name}
                    </td>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>
                      v{sub.version_number}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[sub.status] || 'badge-neutral'}`}>
                        {STATUS_LABELS[sub.status] || sub.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={e => { e.stopPropagation(); setSelectedSubmission(sub.id) }}
                      >
                        <Eye size={13} />
                        Review
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Submission Detail Modal ───────────────────────────────────────────────────

function SubmissionDetailModal({ deliveryId, onClose, onAction }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showChangesForm, setShowChangesForm] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')
  const [feedback, setFeedback] = useState('')

  const token = localStorage.getItem('token') || ''
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : ''
  const streamUrl = `/api/deliveries/${deliveryId}/stream${tokenParam}`
  const downloadUrl = `/api/deliveries/${deliveryId}/download${tokenParam}`

  useEffect(() => {
    loadDetail()
  }, [deliveryId])

  async function loadDetail() {
    setLoading(true)
    try {
      const res = await api.get(`/api/admin/video-approvals/${deliveryId}`)
      setDetail(res.data)
      setAdminNotes(res.data.internal_admin_notes || '')
    } catch (err) {
      toast.error('Failed to load submission detail')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove() {
    setApproving(true)
    try {
      await api.post(`/api/admin/video-approvals/${deliveryId}/approve`, {
        internal_notes: adminNotes,
      })
      toast.success('Video approved and delivered to client!')
      onAction()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Approval failed')
    } finally {
      setApproving(false)
    }
  }

  async function handleRequestChanges(e) {
    e.preventDefault()
    if (!feedback.trim()) { toast.error('Please provide feedback'); return }
    setRejecting(true)
    try {
      await api.post(`/api/admin/video-approvals/${deliveryId}/request-changes`, {
        feedback,
        internal_notes: adminNotes,
      })
      toast.success('Change request sent to creator')
      onAction()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to request changes')
    } finally {
      setRejecting(false)
    }
  }

  const isPendingReview = detail?.status === 'pending_review'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="modal-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 800,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-dialog)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--gradient-hero)',
          color: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={20} />
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: 'white' }}>Admin Review</h3>
              {detail && (
                <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>
                  {detail.order_title} · v{detail.version_number}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'white', padding: '4px 8px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
            </div>
          ) : !detail ? (
            <p style={{ color: 'var(--error)' }}>Could not load submission.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Info row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {[
                  { icon: ShoppingBag, label: 'Order', value: `#${detail.order_id} — ${detail.order_title}` },
                  { icon: User, label: 'Creator', value: detail.creator_name },
                  { icon: User, label: 'Client', value: detail.client_name },
                  { icon: Video, label: 'Version', value: `v${detail.version_number}` },
                ].map(item => (
                  <div key={item.label} style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: '10px 14px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <item.icon size={13} color="var(--text-muted)" />
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {item.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className={`badge ${STATUS_COLORS[detail.status] || 'badge-neutral'}`} style={{ fontSize: 13, padding: '4px 12px' }}>
                  {STATUS_LABELS[detail.status] || detail.status}
                </span>
                {detail.submitted_at && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Submitted: {new Date(detail.submitted_at).toLocaleString()}
                  </span>
                )}
                {detail.release_method && (
                  <span style={{
                    fontSize: 11, padding: '2px 10px', borderRadius: '20px',
                    background: detail.release_method === 'admin_approved' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                    color: detail.release_method === 'admin_approved' ? '#10b981' : '#d97706',
                    fontWeight: 600,
                  }}>
                    {detail.release_method === 'admin_approved' ? '✓ Admin Approved' : '⏱ Auto-Released'}
                  </span>
                )}
              </div>

              {/* Review deadline */}
              {detail.review_due_at && detail.status === 'pending_review' && (() => {
                const due = new Date(detail.review_due_at)
                const now = new Date()
                const diffMs = due - now
                const overdue = diffMs < 0
                const absDiff = Math.abs(diffMs)
                const hoursLeft = Math.floor(absDiff / 3600000)
                const minsLeft = Math.floor((absDiff % 3600000) / 60000)
                return (
                  <div style={{
                    background: overdue ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                    border: `1px solid ${overdue ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    borderRadius: 8, padding: '10px 14px', fontSize: 12,
                    color: overdue ? '#ef4444' : '#d97706',
                  }}>
                    <strong>⏰ Review Deadline:</strong> {due.toLocaleString()}
                    <br />
                    {overdue
                      ? `⚠️ OVERDUE by ${hoursLeft}h ${minsLeft}m — will be auto-released on next scheduler run`
                      : `Time remaining: ${hoursLeft}h ${minsLeft}m — auto-releases if no decision made`
                    }
                  </div>
                )
              })()}

              {/* Video player */}
              <div>
                <h4 style={{ fontSize: 14, marginBottom: 10, color: 'var(--text-secondary)' }}>Secure Video Preview</h4>
                <div className="video-container">
                  <video controls preload="metadata" src={streamUrl} style={{ borderRadius: 8 }}>
                    <p style={{ color: 'white', padding: 16 }}>
                      Your browser cannot preview this video.{' '}
                      <a href={downloadUrl} style={{ color: 'var(--ms-blue)' }}>Download to review.</a>
                    </p>
                  </video>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  {detail.original_filename && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      📁 {detail.original_filename} ·{' '}
                      {detail.file_size ? (detail.file_size / 1024 / 1024).toFixed(1) + ' MB' : ''} ·{' '}
                      {detail.detected_content_type}
                    </span>
                  )}
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginLeft: 'auto' }}>
                    <Download size={13} />
                    Download
                  </a>
                </div>
              </div>

              {/* Creator delivery notes */}
              {detail.description && (
                <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                    Creator Delivery Notes
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                    {detail.description}
                  </p>
                </div>
              )}

              {/* Original brief */}
              {detail.order_brief && (
                <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                    Original Project Brief
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                    {detail.order_brief}
                  </p>
                </div>
              )}

              {/* Requirements */}
              {detail.order_requirements && (
                <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                    Requirements
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                    {detail.order_requirements}
                  </p>
                </div>
              )}

              {/* Version history */}
              {detail.all_versions && detail.all_versions.length > 1 && (
                <div>
                  <h4 style={{ fontSize: 14, marginBottom: 10, color: 'var(--text-secondary)' }}>
                    All Versions ({detail.all_versions.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {detail.all_versions.map(v => (
                      <div key={v.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', background: v.id === deliveryId ? 'var(--ms-blue-light)' : 'var(--bg-primary)',
                        border: `1px solid ${v.id === deliveryId ? 'var(--ms-blue)' : 'var(--border-color)'}`,
                        borderRadius: 8
                      }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>v{v.version_number}</span>
                          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                            {v.submitted_at ? new Date(v.submitted_at).toLocaleDateString() : 'Draft'}
                          </span>
                        </div>
                        <span className={`badge ${STATUS_COLORS[v.status] || 'badge-neutral'}`} style={{ fontSize: 11 }}>
                          {STATUS_LABELS[v.status] || v.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Internal notes */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  Internal Admin Notes (private — not visible to creator or client)
                </label>
                <textarea
                  className="input-base"
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  placeholder="Add private notes for the admin team..."
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Existing feedback */}
              {detail.creator_visible_feedback && (
                <div style={{ background: 'var(--warning-light)', border: '1px solid var(--ms-yellow)', borderRadius: 8, padding: '12px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', marginBottom: 6 }}>
                    PREVIOUS FEEDBACK TO CREATOR
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                    {detail.creator_visible_feedback}
                  </p>
                </div>
              )}

              {/* Request changes form */}
              <AnimatePresence>
                {showChangesForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ background: 'var(--error-light)', border: '1px solid var(--error)', borderRadius: 10, padding: 16 }}>
                      <h5 style={{ margin: '0 0 12px', color: 'var(--error)' }}>Request Changes — Provide Feedback</h5>
                      <form onSubmit={handleRequestChanges}>
                        <textarea
                          className="input-base"
                          value={feedback}
                          onChange={e => setFeedback(e.target.value)}
                          placeholder="Describe what needs to be changed and why (required)..."
                          rows={4}
                          style={{ resize: 'vertical', marginBottom: 12 }}
                          required
                        />
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button type="submit" className="btn btn-danger btn-sm" disabled={rejecting}>
                            {rejecting ? 'Sending...' : 'Send Change Request'}
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowChangesForm(false); setFeedback('') }}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Approve dialog */}
              <AnimatePresence>
                {showApproveDialog && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    style={{
                      background: 'var(--success-light)',
                      border: '2px solid var(--success)',
                      borderRadius: 12,
                      padding: 20,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <CheckCircle size={20} color="var(--success)" />
                      <h4 style={{ margin: 0, color: 'var(--success)' }}>Confirm Approval</h4>
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.6 }}>
                      You are about to approve <strong>version {detail.version_number}</strong> of "{detail.order_title}".
                      This specific version will be delivered to the client immediately.
                      All other versions for this order will be marked as superseded.
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn btn-success" onClick={handleApprove} disabled={approving}>
                        {approving ? 'Approving...' : '✅ Confirm Approve & Deliver'}
                      </button>
                      <button className="btn btn-ghost" onClick={() => setShowApproveDialog(false)}>
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!loading && detail && isPendingReview && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            gap: 10,
            background: 'var(--bg-secondary)',
          }}>
            {!showApproveDialog && !showChangesForm && (
              <>
                <button
                  className="btn btn-success"
                  onClick={() => { setShowApproveDialog(true); setShowChangesForm(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <CheckCircle size={16} />
                  Approve & Deliver to Client
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => { setShowChangesForm(true); setShowApproveDialog(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <AlertCircle size={16} />
                  Request Changes
                </button>
              </>
            )}
            <button className="btn btn-ghost" onClick={onClose} style={{ marginLeft: 'auto' }}>
              Close
            </button>
          </div>
        )}

        {!loading && detail && !isPendingReview && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
