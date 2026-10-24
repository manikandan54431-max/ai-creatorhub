import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { adminAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { AlertTriangle } from 'lucide-react'

export default function AdminReviews() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminAPI.getReviews()
      const data = res.data
      setReviews(Array.isArray(data) ? data : (data?.items ?? []))
    } catch (err) {
      // A failed load must not render as "no reviews".
      setError(err.response?.data?.detail || err.message || 'Could not load reviews')
      setReviews([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  const handleHide = async (id, hidden) => {
    try {
      const res = await adminAPI.hideReview(id)
      // Trust the server's resulting state, not a local guess.
      const nowHidden = res.data?.hidden ?? !hidden
      toast.success(nowHidden ? 'Review hidden' : 'Review unhidden')
      await fetchReviews()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not change this review')
    }
  }

  const handleDelete = async (id) => {
    const review = reviews.find(r => r.id === id)
    if (!window.confirm(
      `Permanently delete this review${review?.client_name ? ` by ${review.client_name}` : ''}?\n\n`
      + 'This cannot be undone and will change the creator\'s rating.'
    )) return
    try {
      await adminAPI.deleteReview(id)
      toast.success('Review deleted')
      await fetchReviews()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not delete this review')
      await fetchReviews()
    }
  }

  return (
    <div style={{ padding: '32px', background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>⭐ Review Moderation</h1>
        <p style={{ color: 'var(--text-muted)' }}>{reviews.length} reviews</p>
      </div>
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 20px', marginBottom: '20px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '14px',
        }}>
          <AlertTriangle size={20} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>Could not load reviews</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{error}</div>
          </div>
          <button onClick={fetchReviews} className="btn-gradient" style={{ padding: '9px 18px', fontSize: '13px' }}>Retry</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? Array(5).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: '90px', borderRadius: '16px' }} />)
          : reviews.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="card" style={{ padding: '20px', opacity: r.is_hidden ? 0.5 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{r.client_name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                    <span style={{ fontWeight: '700', color: 'var(--color-accent)' }}>{r.creator_name}</span>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {Array(5).fill(0).map((_, j) => <span key={j} style={{ color: j < r.rating ? '#f59e0b' : '#e5e7eb' }}>★</span>)}
                    </div>
                    {r.is_hidden && <span className="badge badge-warning">Hidden</span>}
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{r.comment}</p>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                  <button onClick={() => handleHide(r.id, r.is_hidden)}
                    style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '600', background: r.is_hidden ? 'rgba(5,150,105,0.1)' : 'rgba(245,158,11,0.1)', color: r.is_hidden ? '#059669' : '#f59e0b', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                    {r.is_hidden ? 'Show' : 'Hide'}
                  </button>
                  <button onClick={() => handleDelete(r.id)}
                    style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '600', background: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
      </div>
    </div>
  )
}
