import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { reviewsAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import { Star, MessageSquare, Calendar, TrendingUp } from 'lucide-react'

export default function CreatorReviewsPage() {
  const { user } = useAuthStore()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reviewsAPI.getMyReviews()
      .then(r => setReviews(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : 0
  const dist = [5, 4, 3, 2, 1].map(n => ({ n, count: reviews.filter(r => r.rating === n).length }))

  if (loading) return (
    <div style={{ padding: '100px 24px' }}>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '14px', marginBottom: '16px', maxWidth: '800px', margin: '0 auto 16px' }} />)}
    </div>
  )

  return (
    <div style={{ padding: '100px 24px 60px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '30px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>
            ⭐ My Reviews
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Client feedback and ratings for your work</p>
        </motion.div>

        {reviews.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>💬</div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>No reviews yet</h3>
            <p style={{ color: 'var(--text-muted)' }}>Complete orders to start receiving client reviews</p>
          </motion.div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="card" style={{ padding: '28px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '40px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '52px', fontWeight: '900', color: 'var(--color-warning)', lineHeight: 1 }}>{avg}</div>
                  <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', margin: '8px 0' }}>
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} size={18} fill={n <= Math.round(avg) ? '#f59e0b' : 'transparent'} color="#f59e0b" />
                    ))}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{reviews.length} reviews</div>
                </div>
                <div style={{ flex: 1 }}>
                  {dist.map(({ n, count }) => (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', minWidth: '14px' }}>{n}</span>
                      <Star size={12} fill="#f59e0b" color="#f59e0b" />
                      <div style={{ flex: 1, height: '6px', borderRadius: '4px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: '4px', background: '#f59e0b',
                          width: reviews.length ? `${(count / reviews.length) * 100}%` : '0%', transition: 'width 0.6s' }} />
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '18px' }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {reviews.map((review, i) => (
                <motion.div key={review.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-surface-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-primary)', fontWeight: '700', fontSize: '16px' }}>
                        {review.client_name?.[0] || '?'}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '14px' }}>{review.client_name || 'Client'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {review.created_at ? new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} size={14} fill={n <= review.rating ? '#f59e0b' : 'transparent'} color="#f59e0b" />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                      "{review.comment}"
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}