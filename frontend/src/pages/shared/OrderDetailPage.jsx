import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ordersAPI, paymentsAPI, reviewsAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import toast from 'react-hot-toast'
import {
  Clock, DollarSign, Package, CheckCircle, AlertTriangle, Star,
  Upload, RotateCcw, ChevronLeft, Video
} from 'lucide-react'
import CreatorDeliverySubmission from '../../components/delivery/CreatorDeliverySubmission'
import ClientDeliveryView from '../../components/delivery/ClientDeliveryView'
import { formatMoney } from '../../utils/format'

const statusMap = {
  pending: { label: 'Pending', color: '#92400e', bg: '#fef3c7', step: 0 },
  assigned: { label: 'Assigned', color: '#075985', bg: '#e0f2fe', step: 1 },
  accepted: { label: 'Accepted', color: '#1e40af', bg: '#dbeafe', step: 1 },
  in_progress: { label: 'In Progress', color: '#5b21b6', bg: 'var(--color-accent-subtle)', step: 2 },
  delivered: { label: 'Delivered', color: '#065f46', bg: '#d1fae5', step: 3 },
  revision_requested: { label: 'Revision Requested', color: '#713f12', bg: '#fef9c3', step: 2 },
  completed: { label: 'Completed ✓', color: '#065f46', bg: '#d1fae5', step: 4 },
  cancelled: { label: 'Cancelled', color: 'var(--color-danger)', bg: '#fee2e2', step: -1 },
}

const steps = ['Order Placed', 'Accepted', 'In Progress', 'Delivered', 'Completed']

export default function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [deliveryUrl, setDeliveryUrl] = useState('')
  const [revisionReason, setRevisionReason] = useState('')
  const [disputeReason, setDisputeReason] = useState('')
  const [showRevision, setShowRevision] = useState(false)
  const [showDispute, setShowDispute] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' })

  useEffect(() => {
    ordersAPI.getById(id)
      .then(r => setOrder(r.data))
      .catch(() => { toast.error('Order not found'); navigate(-1) })
      .finally(() => setLoading(false))
  }, [id])

  const doAction = async (fn, successMsg, updateFn) => {
    setActionLoading(true)
    try {
      const res = await fn()
      toast.success(successMsg)
      if (updateFn) updateFn(res)
    } catch (err) {
      const msg = typeof err.response?.data?.detail === 'string'
        ? err.response.data.detail
        : (err.response?.data?.message || err.message || 'Action failed')
      toast.error(msg)
    } finally { setActionLoading(false) }
  }

  const handleAccept = () => doAction(
    () => ordersAPI.updateStatus(id, 'accepted'),
    'Order accepted!',
    () => setOrder(o => ({ ...o, status: 'accepted' }))
  )

  const handleStartWork = () => doAction(
    () => ordersAPI.updateStatus(id, 'in_progress'),
    'Started working!',
    () => setOrder(o => ({ ...o, status: 'in_progress' }))
  )

  const handleDeliver = () => {
    if (!deliveryUrl.trim()) { toast.error('Enter delivery URL or notes'); return }
    doAction(
      () => ordersAPI.uploadDelivery(id, { delivery_url: deliveryUrl }),
      'Delivery uploaded! 🎉',
      () => setOrder(o => ({ ...o, status: 'delivered', delivery_url: deliveryUrl }))
    )
  }

  const handleApprove = () => doAction(
    () => ordersAPI.approveDelivery(id),
    'Delivery approved! Order completed.',
    () => setOrder(o => ({ ...o, status: 'completed' }))
  )

  const handleRevision = () => {
    if (!revisionReason.trim()) { toast.error('Explain what needs revision'); return }
    doAction(
      () => ordersAPI.requestRevision(id, revisionReason),
      'Revision requested',
      () => { setOrder(o => ({ ...o, status: 'revision_requested' })); setShowRevision(false) }
    )
  }

  const handleDispute = () => {
    if (!disputeReason.trim()) { toast.error('Explain the dispute reason'); return }
    doAction(
      () => ordersAPI.raiseDispute(id, disputeReason),
      'Dispute raised. Admin will review.',
      () => setShowDispute(false)
    )
  }

  const handleReview = async () => {
    if (!reviewForm.comment.trim()) { toast.error('Write a review comment'); return }
    doAction(
      () => reviewsAPI.create({ order_id: parseInt(id), creator_id: order.creator_id, rating: reviewForm.rating, comment: reviewForm.comment }),
      'Review submitted! ⭐',
      () => setShowReview(false)
    )
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingTop: '90px', padding: '90px 24px 40px' }}>
      <div className="container-custom">
        <div className="skeleton" style={{ height: '60px', borderRadius: '12px', marginBottom: '20px' }} />
        <div className="skeleton" style={{ height: '400px', borderRadius: '16px' }} />
      </div>
    </div>
  )

  if (!order) return null

  const statusInfo = statusMap[order.status] || { label: order.status, color: '#475569', bg: '#f1f5f9', step: 0 }
  const isClient = user?.role === 'client'
  const isCreator = user?.role === 'creator'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingTop: '70px' }}>
      {/* Back button */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '12px 24px' }}>
        <div className="container-custom">
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '14px' }}>
            <ChevronLeft size={16} /> Back
          </button>
        </div>
      </div>

      <div className="container-custom" style={{ padding: '32px 24px' }}>
        {/* Progress Steps */}
        <div className="card" style={{ padding: '24px 20px', marginBottom: '24px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ minWidth: '460px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', marginBottom: '16px' }}>
            <div style={{ position: 'absolute', top: '16px', left: '5%', right: '5%', height: '2px', background: 'var(--border-color)', zIndex: 0 }} />
            <div style={{ position: 'absolute', top: '16px', left: '5%', height: '2px', background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))', zIndex: 1, width: `${Math.max(0, Math.min(100, statusInfo.step / 4 * 100))}%`, transition: 'width 1s ease' }} />
            {steps.map((step, i) => (
              <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 2, minWidth: '80px' }}>
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: i <= statusInfo.step ? 1.1 : 1 }}
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: i < statusInfo.step ? 'var(--color-primary)' : i === statusInfo.step ? 'var(--color-accent)' : 'var(--bg-secondary)',
                    border: `2px solid ${i <= statusInfo.step ? 'var(--color-accent)' : 'var(--border-color)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: i <= statusInfo.step ? 'white' : 'var(--text-muted)',
                    fontWeight: '800', fontSize: '13px'
                  }}
                >
                  {i < statusInfo.step ? '✓' : i + 1}
                </motion.div>
                <span style={{ fontSize: '11px', fontWeight: i === statusInfo.step ? '700' : '500', color: i <= statusInfo.step ? 'var(--color-accent)' : 'var(--text-muted)', textAlign: 'center' }}>{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="order-detail-grid">
          {/* Left: Order Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Order Header */}
            <div className="card" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    #{order.id} — {order.title}
                  </h1>
                  <span style={{ background: statusInfo.bg, color: statusInfo.color, borderRadius: '10px', padding: '5px 14px', fontSize: '13px', fontWeight: '700' }}>
                    {statusInfo.label}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--color-accent)' }}>{formatMoney(order.budget)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Project Budget</div>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '16px' }}>{order.description}</p>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <Clock size={14} /> Deadline: <strong style={{ color: 'var(--text-primary)' }}>{order.deadline ? new Date(order.deadline).toLocaleDateString() : 'Not set'}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <Package size={14} /> Category: <strong style={{ color: 'var(--text-primary)' }}>{order.category}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  📅 Created: <strong style={{ color: 'var(--text-primary)' }}>{new Date(order.created_at).toLocaleDateString()}</strong>
                </div>
              </div>
            </div>

            {/* Participants */}
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>Participants</h3>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {[
                  { label: '🏢 Client', person: order.client },
                  { label: '🎨 Creator', person: order.creator },
                ].map(({ label, person }) => person ? (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={person.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(person.name)}&background=0F766E&color=fff`}
                      alt="" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{label}</div>
                      <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{person.name}</div>
                    </div>
                  </div>
                ) : (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '18px' }}>?</div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{label}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Not assigned yet</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── Video Delivery Sections ─────────────────────────────────── */}
            {/* Creator: upload and submit video for admin review */}
            {isCreator && order.creator_id === user?.id && (
              <CreatorDeliverySubmission
                order={order}
                onDeliveryChange={() => {
                  ordersAPI.getById(id).then(r => setOrder(r.data)).catch(() => {})
                }}
              />
            )}

            {/* Client: view only admin-approved deliveries */}
            {isClient && order.client_id === user?.id && (
              <ClientDeliveryView
                order={order}
                onRevisionRequest={() => {
                  ordersAPI.getById(id).then(r => setOrder(r.data)).catch(() => {})
                }}
              />
            )}

            {/* Revision/Dispute Modals */}
            {showRevision && (
              <div className="card" style={{ padding: '24px', border: '1px solid var(--color-warning)' }}>
                <h3 style={{ fontWeight: '700', color: 'var(--color-warning)', marginBottom: '14px' }}>📝 Request Revision</h3>
                <textarea value={revisionReason} onChange={e => setRevisionReason(e.target.value)}
                  placeholder="Describe what needs to be changed or improved..."
                  className="input-base" rows={4} style={{ marginBottom: '12px', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowRevision(false)} style={{ flex: 1, padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-secondary)', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleRevision} disabled={actionLoading} className="btn-gradient" style={{ flex: 2, padding: '10px' }}>Submit Revision Request</button>
                </div>
              </div>
            )}

            {showDispute && (
              <div className="card" style={{ padding: '24px', border: '1px solid var(--color-danger)' }}>
                <h3 style={{ fontWeight: '700', color: 'var(--color-danger)', marginBottom: '14px' }}>⚠️ Raise Dispute</h3>
                <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
                  placeholder="Explain the issue in detail..."
                  className="input-base" rows={4} style={{ marginBottom: '12px', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowDispute(false)} style={{ flex: 1, padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-secondary)', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleDispute} disabled={actionLoading} style={{ flex: 2, padding: '10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Submit Dispute</button>
                </div>
              </div>
            )}

            {showReview && (
              <div className="card" style={{ padding: '24px', border: '1px solid var(--color-warning)' }}>
                <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>⭐ Leave a Review</h3>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setReviewForm(f => ({ ...f, rating: n }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '28px', color: n <= reviewForm.rating ? '#f59e0b' : 'var(--border-color)', transition: 'all 0.1s' }}>
                      ★
                    </button>
                  ))}
                </div>
                <textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
                  placeholder="Share your experience with this creator..."
                  className="input-base" rows={4} style={{ marginBottom: '12px', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowReview(false)} style={{ flex: 1, padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-secondary)', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleReview} disabled={actionLoading} className="btn-gradient" style={{ flex: 2, padding: '10px' }}>Submit Review ⭐</button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Actions Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '90px' }}>
            {/* Creator Actions */}
            {isCreator && (
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px', fontSize: '16px' }}>Creator Actions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {order.status === 'pending' && (
                    <button onClick={handleAccept} disabled={actionLoading} className="btn-gradient" style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <CheckCircle size={16} /> Accept Order
                    </button>
                  )}
                  {order.status === 'accepted' && (
                    <button onClick={handleStartWork} disabled={actionLoading} className="btn-gradient" style={{ padding: '12px' }}>
                      🚀 Start Working
                    </button>
                  )}
                  {['in_progress', 'revision_requested'].includes(order.status) && (
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Delivery URL / Notes
                      </label>
                      <input value={deliveryUrl} onChange={e => setDeliveryUrl(e.target.value)}
                        placeholder="Google Drive / Dropbox link..."
                        className="input-base" style={{ marginBottom: '10px' }} />
                      <button onClick={handleDeliver} disabled={actionLoading} className="btn-gradient" style={{ padding: '12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <Upload size={16} /> Submit Delivery
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Client Actions */}
            {isClient && (
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px', fontSize: '16px' }}>Client Actions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {order.status === 'delivered' && (
                    <>
                      <button onClick={handleApprove} disabled={actionLoading} className="btn-gradient" style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <CheckCircle size={16} /> Approve Delivery
                      </button>
                      <button onClick={() => setShowRevision(true)}
                        style={{ padding: '12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', color: 'var(--color-warning)', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <RotateCcw size={16} /> Request Revision
                      </button>
                    </>
                  )}
                  {order.status === 'completed' && !order.has_review && (
                    <button onClick={() => setShowReview(true)}
                      style={{ padding: '12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', color: 'var(--color-warning)', fontWeight: '700', cursor: 'pointer' }}>
                      ⭐ Leave Review
                    </button>
                  )}
                  {['accepted', 'in_progress', 'delivered'].includes(order.status) && (
                    <button onClick={() => setShowDispute(true)}
                      style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', color: 'var(--color-danger)', fontWeight: '600', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <AlertTriangle size={14} /> Raise Dispute
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Order Summary */}
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px', fontSize: '16px' }}>Order Summary</h3>
              {[
                { label: 'Order ID', value: `#${order.id}` },
                { label: 'Budget', value: formatMoney(order.budget) },
                { label: 'Category', value: order.category },
                { label: 'Created', value: new Date(order.created_at).toLocaleDateString() },
                { label: 'Deadline', value: order.deadline ? new Date(order.deadline).toLocaleDateString() : 'Not set' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
